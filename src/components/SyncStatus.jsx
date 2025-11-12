import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { getSyncManager } from '@/utils/SyncManager';
import { SYNC_CONFIG } from '@/config/sync';

/**
 * Componente SyncStatus - Indicador de estado de sincronización
 *
 * Muestra:
 * - Estado de conexión (online/offline)
 * - Estado de sincronización (sincronizando/sincronizado/error)
 * - Última sincronización
 * - Botón para sincronizar manualmente
 */
export function SyncStatus({ userKey, className = '' }) {
  const [status, setStatus] = useState({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: 0,
    error: null
  });

  useEffect(() => {
    if (!userKey || !SYNC_CONFIG.SYNC_ENABLED) return;

    const manager = getSyncManager(userKey);

    // Iniciar el SyncManager (esto activa la sincronización automática)
    manager.start();

    // Suscribirse a cambios de estado
    const unsubscribe = manager.subscribe((event) => {
      const newStatus = manager.getStatus();

      setStatus(prev => ({
        ...newStatus,
        error: event.type === 'sync-error' ? event.error : null
      }));
    });

    // Obtener estado inicial
    setStatus(manager.getStatus());

    return () => {
      unsubscribe();
      manager.stop();
    };
  }, [userKey]);

  if (!SYNC_CONFIG.SYNC_ENABLED) {
    return null;
  }

  const handleManualSync = async () => {
    if (!userKey) return;
    const manager = getSyncManager(userKey);
    await manager.syncNow();
  };

  const formatLastSync = (timestamp) => {
    if (!timestamp) return 'Nunca';

    const now = new Date();
    const diff = Math.floor((now - timestamp) / 1000); // segundos

    if (diff < 60) return 'Hace unos segundos';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} hrs`;
    return `Hace ${Math.floor(diff / 86400)} días`;
  };

  // Estados visuales
  const getStatusConfig = () => {
    if (!status.isOnline) {
      return {
        color: 'bg-gray-100 border-gray-300',
        textColor: 'text-gray-700',
        icon: <WifiOff className="w-4 h-4" />,
        label: 'Sin conexión',
        description: 'Trabajando offline'
      };
    }

    if (status.isSyncing) {
      return {
        color: 'bg-blue-50 border-blue-300',
        textColor: 'text-blue-700',
        icon: <RefreshCw className="w-4 h-4 animate-spin" />,
        label: 'Sincronizando',
        description: 'Actualizando datos...'
      };
    }

    if (status.error) {
      return {
        color: 'bg-yellow-50 border-yellow-300',
        textColor: 'text-yellow-700',
        icon: <AlertCircle className="w-4 h-4" />,
        label: 'Error al sincronizar',
        description: status.error
      };
    }

    return {
      color: 'bg-green-50 border-green-300',
      textColor: 'text-green-700',
      icon: <Check className="w-4 h-4" />,
      label: 'Sincronizado',
      description: `Última sync: ${formatLastSync(status.lastSyncTime)}`
    };
  };

  const config = getStatusConfig();

  return (
    <div className={`${className}`}>
      {/* Versión compacta (móvil) */}
      <div className="md:hidden">
        <button
          onClick={handleManualSync}
          disabled={status.isSyncing || !status.isOnline}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg border
            ${config.color} ${config.textColor}
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {config.icon}
          <span className="text-sm font-medium">{config.label}</span>
        </button>
      </div>

      {/* Versión completa (desktop) */}
      <div className="hidden md:block">
        <div
          className={`
            flex items-center gap-3 px-4 py-2.5 rounded-lg border shadow-sm
            ${config.color} ${config.textColor}
            transition-all duration-200
          `}
        >
          {/* Icono de estado */}
          <div className="flex-shrink-0">
            {config.icon}
          </div>

          {/* Información */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">
              {config.label}
            </div>
            <div className="text-xs opacity-80 truncate">
              {config.description}
            </div>
          </div>

          {/* Botón de sincronización manual */}
          {status.isOnline && (
            <button
              onClick={handleManualSync}
              disabled={status.isSyncing}
              className={`
                flex-shrink-0 p-1.5 rounded hover:bg-white/50
                transition-colors duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              title="Sincronizar ahora"
            >
              <RefreshCw className={`w-4 h-4 ${status.isSyncing ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Indicador de cambios pendientes */}
          {status.pendingChanges > 0 && (
            <div className="flex-shrink-0 px-2 py-0.5 rounded-full bg-white/70 text-xs font-semibold">
              {status.pendingChanges} pendiente{status.pendingChanges > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Componente compacto para header
 */
export function SyncStatusCompact({ userKey, className = '' }) {
  const [status, setStatus] = useState({
    isOnline: navigator.onLine,
    isSyncing: false
  });

  useEffect(() => {
    if (!userKey || !SYNC_CONFIG.SYNC_ENABLED) return;

    const manager = getSyncManager(userKey);

    // Iniciar el SyncManager
    manager.start();

    const unsubscribe = manager.subscribe(() => {
      setStatus(manager.getStatus());
    });

    setStatus(manager.getStatus());

    return () => {
      unsubscribe();
      manager.stop();
    };
  }, [userKey]);

  if (!SYNC_CONFIG.SYNC_ENABLED) {
    return null;
  }

  const getIcon = () => {
    if (!status.isOnline) {
      return <WifiOff className="w-4 h-4 text-gray-500" />;
    }
    if (status.isSyncing) {
      return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
    }
    return <Cloud className="w-4 h-4 text-green-500" />;
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {getIcon()}
      <span className={`text-xs ${status.isOnline ? 'text-green-600' : 'text-gray-500'}`}>
        {status.isOnline ? (status.isSyncing ? 'Sincronizando' : 'Online') : 'Offline'}
      </span>
    </div>
  );
}

export default SyncStatus;
