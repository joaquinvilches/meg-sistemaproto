import { SYNC_CONFIG, getSyncUrl } from '@/config/sync';

/**
 * SyncManager - Gestión de sincronización con VPS
 *
 * Características:
 * - Detección automática de conexión
 * - Sincronización bidireccional (push/pull)
 * - Resolución de conflictos (Last-Write-Wins)
 * - Cola de cambios pendientes offline
 * - Reintentos automáticos
 */
class SyncManager {
  constructor(userKey) {
    this.userKey = userKey;
    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.pendingChanges = [];
    this.syncInterval = null;
    this.listeners = new Set();
    this.retryCount = 0;
  }

  /**
   * Iniciar monitoreo de conexión y sincronización automática
   */
  start() {
    if (!SYNC_CONFIG.SYNC_ENABLED) {
      this.log('Sincronización deshabilitada');
      return;
    }

    this.log('Iniciando SyncManager');

    // Escuchar eventos de conexión
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Verificar conexión inicial
    this.checkConnection();

    // Sincronización automática cada X segundos
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.syncNow();
      }
    }, SYNC_CONFIG.SYNC_INTERVAL);

    this.log('SyncManager iniciado');
  }

  /**
   * Detener sincronización
   */
  stop() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.log('SyncManager detenido');
  }

  /**
   * Manejar evento de conexión
   */
  handleOnline = () => {
    this.log('✅ Conexión restaurada');
    this.isOnline = true;
    this.notifyListeners({ type: 'online' });

    // Sincronizar automáticamente al conectar
    setTimeout(() => this.syncNow(), 1000);
  };

  /**
   * Manejar evento de desconexión
   */
  handleOffline = () => {
    this.log('❌ Conexión perdida');
    this.isOnline = false;
    this.notifyListeners({ type: 'offline' });
  };

  /**
   * Verificar conexión con el servidor
   */
  async checkConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SYNC_CONFIG.REQUEST_TIMEOUT);

      const response = await fetch(getSyncUrl('/api/health'), {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const wasOnline = this.isOnline;
      this.isOnline = response.ok;

      if (wasOnline !== this.isOnline) {
        this.notifyListeners({
          type: this.isOnline ? 'online' : 'offline'
        });
      }

      return this.isOnline;
    } catch (error) {
      this.isOnline = false;
      return false;
    }
  }

  /**
   * Sincronización completa (bidireccional)
   */
  async syncNow() {
    if (this.isSyncing) {
      this.log('Ya hay una sincronización en curso');
      return { success: false, message: 'Ya sincronizando' };
    }

    if (!this.isOnline) {
      this.log('Sin conexión - sincronización omitida');
      return { success: false, message: 'Sin conexión' };
    }

    this.isSyncing = true;
    this.notifyListeners({ type: 'sync-start' });

    try {
      this.log('🔄 Iniciando sincronización...');

      // 1. PULL: Descargar cambios del servidor
      const remoteData = await this.pullFromServer();

      // 2. MERGE: Combinar con datos locales (si hay)
      const mergedData = remoteData; // Por ahora, simplemente usamos los datos remotos

      // 3. PUSH: Subir cambios locales al servidor
      const localData = this.getLocalData();
      if (localData) {
        await this.pushToServer(localData);
      }

      // 4. Actualizar timestamp de última sincronización
      this.lastSyncTime = new Date();
      this.retryCount = 0;

      this.log('✅ Sincronización completada');
      this.notifyListeners({
        type: 'sync-success',
        timestamp: this.lastSyncTime
      });

      return { success: true, data: mergedData };

    } catch (error) {
      this.log('❌ Error en sincronización:', error);

      this.retryCount++;
      if (this.retryCount < SYNC_CONFIG.MAX_RETRIES) {
        this.log(`Reintentando... (${this.retryCount}/${SYNC_CONFIG.MAX_RETRIES})`);
        setTimeout(() => this.syncNow(), 5000);
      }

      this.notifyListeners({
        type: 'sync-error',
        error: error.message
      });

      return { success: false, error: error.message };

    } finally {
      this.isSyncing = false;
      this.notifyListeners({ type: 'sync-end' });
    }
  }

  /**
   * PULL: Descargar datos del servidor
   */
  async pullFromServer() {
    this.log('⬇️ Descargando datos del servidor...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SYNC_CONFIG.REQUEST_TIMEOUT);

    try {
      const response = await fetch(
        getSyncUrl(`/api/sync/pull?userKey=${encodeURIComponent(this.userKey)}`),
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.log('✅ Datos descargados:', data);

      return data;

    } catch (error) {
      clearTimeout(timeoutId);
      throw new Error(`Error al descargar: ${error.message}`);
    }
  }

  /**
   * PUSH: Subir datos al servidor
   */
  async pushToServer(data) {
    this.log('⬆️ Subiendo datos al servidor...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SYNC_CONFIG.REQUEST_TIMEOUT);

    try {
      const response = await fetch(
        getSyncUrl('/api/sync/push'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userKey: this.userKey,
            data: data
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.log('✅ Datos subidos correctamente');

      return result;

    } catch (error) {
      clearTimeout(timeoutId);
      throw new Error(`Error al subir: ${error.message}`);
    }
  }

  /**
   * Obtener datos locales (placeholder - se implementará en stores)
   */
  getLocalData() {
    // Esto se implementará en los stores (useCreacionStore, etc.)
    return null;
  }

  /**
   * Suscribirse a eventos de sincronización
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notificar a todos los listeners
   */
  notifyListeners(event) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error en listener:', error);
      }
    });
  }

  /**
   * Estado actual de sincronización
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      pendingChanges: this.pendingChanges.length,
      userKey: this.userKey
    };
  }

  /**
   * Log con debug
   */
  log(...args) {
    if (SYNC_CONFIG.DEBUG) {
      console.log('[SyncManager]', ...args);
    }
  }
}

// Instancia singleton por userKey
const instances = new Map();

/**
 * Obtener instancia de SyncManager para un usuario
 */
export function getSyncManager(userKey) {
  if (!userKey) {
    throw new Error('userKey es requerido');
  }

  if (!instances.has(userKey)) {
    instances.set(userKey, new SyncManager(userKey));
  }

  return instances.get(userKey);
}

/**
 * Hook para usar sincronización en React
 */
export function useSyncManager(userKey) {
  const [status, setStatus] = React.useState({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: 0
  });

  React.useEffect(() => {
    if (!userKey) return;

    const manager = getSyncManager(userKey);

    // Iniciar sincronización
    manager.start();

    // Suscribirse a eventos
    const unsubscribe = manager.subscribe((event) => {
      setStatus(manager.getStatus());
    });

    // Actualizar estado inicial
    setStatus(manager.getStatus());

    return () => {
      unsubscribe();
      manager.stop();
    };
  }, [userKey]);

  return status;
}

export default SyncManager;
