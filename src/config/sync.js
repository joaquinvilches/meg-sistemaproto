/**
 * Configuración de Sincronización con VPS
 *
 * INSTRUCCIONES:
 * 1. Reemplaza SYNC_API_URL con tu dominio real
 * 2. Ejemplo: 'https://api.tudominio.com'
 * 3. NO uses 'http://' - debe ser 'https://'
 */

export const SYNC_CONFIG = {
  // URL del API - Usa el backend Electron local que se conecta al VPS
  // En Electron: localhost:3001 (Express local que hace bridge al VPS)
  // En desarrollo web: https://mayorganic.cl (directo al VPS)
  SYNC_API_URL: import.meta.env.VITE_SYNC_API_URL || 'http://localhost:3001',

  // Intervalo de sincronización automática (en milisegundos)
  SYNC_INTERVAL: 30000, // 30 segundos

  // Timeout para requests (en milisegundos)
  REQUEST_TIMEOUT: 60000, // 60 segundos (aumentado por PDFs grandes)

  // Reintentos en caso de error
  MAX_RETRIES: 3,

  // Habilitar/deshabilitar sincronización
  SYNC_ENABLED: true,

  // Habilitar logs de debug
  DEBUG: true
};

/**
 * Verificar si la sincronización está configurada
 */
export function isSyncConfigured() {
  const url = SYNC_CONFIG.SYNC_API_URL;
  return url && url !== 'http://localhost:3002' && url.startsWith('http');
}

/**
 * Obtener URL completa del endpoint
 */
export function getSyncUrl(endpoint) {
  return `${SYNC_CONFIG.SYNC_API_URL}${endpoint}`;
}
