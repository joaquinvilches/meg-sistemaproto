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

    // 🆕 SINCRONIZACIÓN INMEDIATA al iniciar (no esperar intervalo)
    if (this.isOnline && !this.isSyncing) {
      this.log('⚡ Ejecutando sincronización inicial inmediata...');
      setTimeout(() => this.syncNow(), 1000); // 1 segundo de delay para que la UI cargue
    }

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
      this.log('⚠️ Ya hay una sincronización en curso, omitiendo...');
      return { success: false, message: 'Ya sincronizando' };
    }

    if (!this.isOnline) {
      this.log('Sin conexión - sincronización omitida');
      return { success: false, message: 'Sin conexión' };
    }

    this.isSyncing = true;
    this.notifyListeners({ type: 'sync-start' });

    const startTime = Date.now();

    try {
      this.log('🔄 Iniciando sincronización bidireccional...');

      // 🆕 PASO 0: Obtener datos locales para detectar instalación nueva
      const localData = await this.getLocalDataFromBackend();
      const isNewInstallation = this.isEmptyData(localData);

      if (isNewInstallation) {
        this.log('🆕 INSTALACIÓN NUEVA DETECTADA - Saltando PUSH inicial');
        this.log('📥 Descargando todos los datos del VPS primero...');

        // SOLO PULL en instalación nueva
        const pullStart = Date.now();
        const syncResult = await this.pullFromServer();
        const pullTime = ((Date.now() - pullStart) / 1000).toFixed(2);
        this.log(`✓ PULL completado en ${pullTime}s`);

        // Actualizar timestamp y notificar
        this.lastSyncTime = new Date();
        this.retryCount = 0;

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        this.log(`✅ Sincronización inicial completada en ${totalTime}s`);

        this.notifyListeners({
          type: 'sync-success',
          timestamp: this.lastSyncTime,
          isFirstSync: true
        });

        return { success: true, data: syncResult.data, isFirstSync: true };
      }

      // ESTRATEGIA DE SINCRONIZACIÓN BIDIRECCIONAL (instalación NO nueva):
      // 1. PUSH: Subir datos locales al VPS primero (por si hay cambios nuevos)
      // 2. PULL: Descargar datos del VPS (que ahora incluye nuestros cambios + cambios de otros PCs)

      // 1. PUSH: Subir datos locales al VPS
      if (localData && Object.keys(localData).length > 0) {
        // Calcular tamaño aproximado de los datos
        const dataSize = JSON.stringify(localData).length;
        const dataSizeMB = (dataSize / 1024 / 1024).toFixed(2);
        this.log(`📤 Subiendo ${dataSizeMB} MB al VPS...`);

        const pushStart = Date.now();
        await this.pushToServer(localData);
        const pushTime = ((Date.now() - pushStart) / 1000).toFixed(2);
        this.log(`✓ PUSH completado en ${pushTime}s`);
      } else {
        this.log('⚠️ No hay datos locales para sincronizar');
      }

      // 2. PULL: Descargar datos actualizados del VPS (incluye cambios de todos los PCs)
      this.log('📥 Descargando datos actualizados del VPS...');
      const pullStart = Date.now();
      const syncResult = await this.pullFromServer();
      const pullTime = ((Date.now() - pullStart) / 1000).toFixed(2);
      this.log(`✓ PULL completado en ${pullTime}s`);

      // 3. Actualizar timestamp de última sincronización
      this.lastSyncTime = new Date();
      this.retryCount = 0;

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      this.log(`✅ Sincronización completada exitosamente en ${totalTime}s`);

      this.notifyListeners({
        type: 'sync-success',
        timestamp: this.lastSyncTime
      });

      return { success: true, data: syncResult.data };

    } catch (error) {
      this.log('❌ Error en sincronización:', error);

      this.retryCount++;
      if (this.retryCount < SYNC_CONFIG.MAX_RETRIES) {
        this.log(`Reintentando en 5 segundos... (${this.retryCount}/${SYNC_CONFIG.MAX_RETRIES})`);
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

      const result = await response.json();
      this.log('✅ Datos descargados del VPS');

      // El backend Electron devuelve { success: true, data: {...}, timestamp: ... }
      // Los datos sincronizados ya están guardados en SQLite local por el backend
      return result;

    } catch (error) {
      clearTimeout(timeoutId);
      throw new Error(`Error al descargar: ${error.message}`);
    }
  }

  /**
   * PUSH: Subir datos al servidor (CON PDFs completos)
   */
  async pushToServer(data) {
    this.log('⬆️ Subiendo datos completos al servidor (incluye PDFs)...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SYNC_CONFIG.REQUEST_TIMEOUT);

    try {
      // Calcular tamaño de datos completos (con PDFs)
      const dataSize = JSON.stringify(data).length;
      const dataSizeMB = (dataSize / 1024 / 1024).toFixed(2);

      this.log(`📦 Tamaño total: ${dataSizeMB} MB (incluye PDFs base64)`);

      if (dataSize > 100 * 1024 * 1024) {
        this.log('⚠️ ADVERTENCIA: Datos > 100 MB, la sincronización puede tardar varios minutos');
      }

      const response = await fetch(
        getSyncUrl(`/api/sync/push?userKey=${encodeURIComponent(this.userKey)}`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data), // ← Enviar DATOS COMPLETOS con PDFs
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.log('✅ Datos completos subidos correctamente (PDFs incluidos)');

      return result;

    } catch (error) {
      clearTimeout(timeoutId);
      throw new Error(`Error al subir: ${error.message}`);
    }
  }

  /**
   * Obtener datos locales desde el backend Electron (SQLite)
   */
  async getLocalDataFromBackend() {
    try {
      this.log('📂 Obteniendo datos locales del backend...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SYNC_CONFIG.REQUEST_TIMEOUT);

      const response = await fetch(
        getSyncUrl(`/api/creacion?key=${encodeURIComponent(this.userKey)}`),
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
      this.log('✅ Datos locales obtenidos:', data);

      return data;

    } catch (error) {
      this.log('❌ Error obteniendo datos locales:', error.message);
      return null;
    }
  }

  /**
   * Obtener datos locales (placeholder - para compatibilidad)
   * @deprecated Usar getLocalDataFromBackend() en su lugar
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
   * Verificar si los datos locales están vacíos (instalación nueva)
   */
  isEmptyData(data) {
    if (!data || typeof data !== 'object') return true;

    // Verificar si todos los arrays están vacíos
    const arrays = ['clientes', 'cotizaciones', 'ordenesCompra', 'ordenesTrabajo'];

    for (const key of arrays) {
      if (Array.isArray(data[key]) && data[key].length > 0) {
        // Tiene al menos un array con datos
        return false;
      }
    }

    // Todos los arrays están vacíos o no existen
    return true;
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
