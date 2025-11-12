# 🚀 Sistema de Sincronización Multi-Usuario - MEG Sistema

## ✅ IMPLEMENTACIÓN COMPLETADA

He implementado todo el sistema de sincronización para que múltiples usuarios puedan trabajar offline y sincronizar datos cuando se conectan a internet.

---

## 📦 ARCHIVOS CREADOS

### 1. **Frontend (Aplicación Electron)**

```
src/
├── config/
│   └── sync.js                      ← Configuración de sincronización
├── utils/
│   └── SyncManager.js               ← Motor de sincronización
├── components/
│   └── SyncStatus.jsx               ← Indicador visual online/offline
└── pages/
    ├── CotizacionesPage.jsx        ← (Modificado) Agregado indicador
    └── CreacionPage.jsx             ← (Modificado) Agregado indicador

.env.local                           ← Configuración local (URL del VPS)
.env.local.example                   ← Ejemplo de configuración
```

### 2. **Backend (VPS Ubuntu)**

```
vps-backend/
├── server.js                        ← Servidor Express + PostgreSQL
├── package.json                     ← Dependencias
├── .env.example                     ← Variables de entorno
├── setup-vps.sh                     ← Script de instalación automática
└── INSTALACION-VPS.md               ← Guía completa de instalación
```

---

## 🎯 CARACTERÍSTICAS IMPLEMENTADAS

### ✅ En la Aplicación (Electron)

1. **Indicador de Estado Online/Offline**
   - 🟢 Verde: Conectado y sincronizado
   - 🔵 Azul: Sincronizando...
   - 🔴 Gris: Sin conexión (modo offline)
   - 🟡 Amarillo: Error al sincronizar

2. **Sincronización Automática**
   - Cada 30 segundos (configurable)
   - Al abrir la aplicación
   - Al reconectar a internet
   - Botón de sincronización manual

3. **Modo Offline Completo**
   - Funciona sin internet
   - Guarda cambios localmente
   - Cola de cambios pendientes
   - Se sincroniza automáticamente al conectar

4. **Detección de Conexión**
   - Monitorea eventos de red
   - Ping al servidor cada 30 segundos
   - Reintentos automáticos (máx 3)

### ✅ En el Backend (VPS)

1. **API REST Completa**
   - `GET /api/health` - Health check
   - `GET /api/sync/pull?userKey=X` - Descargar datos
   - `POST /api/sync/push` - Subir datos
   - `POST /api/login` - Autenticación

2. **Base de Datos PostgreSQL**
   - Tabla `sync_data` - Datos sincronizados
   - Tabla `sync_log` - Auditoría
   - Índices optimizados
   - Versionado automático

3. **Seguridad**
   - HTTPS con SSL (Let's Encrypt)
   - Nginx como reverse proxy
   - CORS configurado
   - Helmet.js para headers de seguridad

4. **Alta Disponibilidad**
   - PM2 para mantener servidor corriendo
   - Auto-restart en caso de caída
   - Logs centralizados
   - Monitoreo de recursos

---

## 🔧 PRÓXIMOS PASOS (Para Ti)

### PASO 1: Configurar el VPS

Tienes 2 opciones:

#### Opción A: Instalación Automática (Recomendada)

1. Conecta a tu VPS:
   ```bash
   ssh root@TU_IP_VPS
   ```

2. Sube los archivos del backend:
   ```bash
   # Desde tu PC (PowerShell)
   cd C:\Users\JOAQUIN\Desktop\meg-sistema\vps-backend

   # Opción 1: Usar SCP
   scp setup-vps.sh root@TU_IP_VPS:/root/
   scp package.json root@TU_IP_VPS:/root/
   scp server.js root@TU_IP_VPS:/root/

   # Opción 2: Usar WinSCP (interfaz gráfica)
   # Descarga WinSCP, conecta y arrastra los archivos
   ```

3. Ejecuta el script de instalación:
   ```bash
   # En el VPS
   chmod +x setup-vps.sh
   sudo ./setup-vps.sh api.tudominio.com tu@email.com
   ```

   **Reemplaza:**
   - `api.tudominio.com` con tu dominio real
   - `tu@email.com` con tu email

4. El script instalará TODO automáticamente:
   - ✅ Node.js 20 LTS
   - ✅ PostgreSQL 15
   - ✅ Nginx
   - ✅ SSL (certificado gratis)
   - ✅ PM2
   - ✅ Firewall

5. Sube el código e inicia la app:
   ```bash
   # Copiar archivos
   cp package.json /var/www/meg-sistema/
   cp server.js /var/www/meg-sistema/
   cd /var/www/meg-sistema

   # Instalar dependencias
   npm install

   # Iniciar con PM2
   pm2 start server.js --name meg-sistema
   pm2 save
   ```

6. Verificar que funcione:
   ```bash
   curl https://api.tudominio.com/api/health
   # Debe responder: {"status":"ok",...}
   ```

#### Opción B: Instalación Manual

Lee el archivo `vps-backend/INSTALACION-VPS.md` para instrucciones paso a paso.

---

### PASO 2: Configurar la Aplicación Electron

1. Edita el archivo `.env.local` en la raíz del proyecto:
   ```env
   # Cambia esto:
   VITE_SYNC_API_URL=http://localhost:3002

   # Por esto (tu dominio real):
   VITE_SYNC_API_URL=https://api.tudominio.com
   ```

2. Reinicia la aplicación:
   ```bash
   # Detener la app actual (Ctrl+C)
   npm run dev
   ```

3. Verifica que aparezca el indicador de sincronización en la esquina superior derecha.

---

### PASO 3: Probar la Sincronización

#### Test en una sola computadora:

1. Abre la app y crea una cotización
2. Espera 30 segundos (sincronización automática)
3. Verifica que el indicador muestre "🟢 Sincronizado"
4. Cierra la app
5. Abre la app nuevamente
6. Verifica que la cotización siga ahí

#### Test en múltiples computadoras:

1. **PC 1**: Abre la app y crea un cliente llamado "Test Sync"
2. Espera que sincronice (🟢 Sincronizado)
3. **PC 2**: Abre la app (en otro computador)
4. Espera 30 segundos para que descargue datos
5. Verifica que veas el cliente "Test Sync"
6. **PC 2**: Crea una cotización
7. **PC 1**: Espera 30 segundos y verifica que veas la cotización

---

## 📊 CÓMO FUNCIONA

### Flujo de Sincronización:

```
Usuario A (PC)                    VPS PostgreSQL              Usuario B (Laptop)
     │                                   │                            │
     │ 1. Trabaja offline                │                            │
     │    Crea cliente "ABC"             │                            │
     │    (guardado local)               │                            │
     │                                   │                            │
     │ 2. Se conecta a internet          │                            │
     │ ─────[SYNC]────────────────────> │                            │
     │    Sube: cliente "ABC"            │                            │
     │                                   │ ✓ Guardado en DB           │
     │                                   │                            │
     │                                   │ 3. Usuario B abre app      │
     │                                   │ <─────[SYNC]──────────────│
     │                                   │    Descarga: cliente "ABC" │
     │                                   │                            │
     │                                   │            ✓ Ve cliente   │
     │                                   │                "ABC"       │
```

### Resolución de Conflictos:

**Estrategia: Last-Write-Wins (El más reciente gana)**

- Si el mismo registro se modifica en 2 lugares
- El cambio más reciente (por timestamp) se mantiene
- El cambio más antiguo se sobrescribe

Ejemplo:
```
Usuario A: Modifica cliente "ABC" a las 10:00 AM
Usuario B: Modifica cliente "ABC" a las 10:05 AM

Resultado final: Cambio de Usuario B (más reciente)
```

---

## 🛠️ COMANDOS ÚTILES

### En el VPS:

```bash
# Ver estado de la aplicación
pm2 status

# Ver logs en tiempo real
pm2 logs meg-sistema

# Reiniciar aplicación
pm2 restart meg-sistema

# Ver estado de servicios
systemctl status nginx
systemctl status postgresql

# Ver logs de Nginx
tail -f /var/log/nginx/error.log

# Conectar a PostgreSQL
sudo -u postgres psql meg_sistema

# Ver datos sincronizados
sudo -u postgres psql meg_sistema -c "SELECT * FROM sync_data;"
```

### En tu PC:

```bash
# Reiniciar app
npm run dev

# Ver logs de sincronización
# (abre DevTools en la app con Ctrl+Shift+I)

# Construir instalador
npm run build:win
```

---

## 📁 ESTRUCTURA DE LA BASE DE DATOS

### Tabla sync_data:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | TEXT | `meg`, `myorganic`, `meg_creacion`, `myorganic_creacion` |
| `user_key` | TEXT | `meg` o `myorganic` |
| `content` | JSONB | Datos completos (clientes, cotizaciones, etc.) |
| `version` | INTEGER | Número de versión (incrementa con cada cambio) |
| `updated_at` | TIMESTAMP | Última actualización |

### Tabla sync_log (auditoría):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL | ID autoincremental |
| `user_key` | TEXT | Usuario que hizo el cambio |
| `action` | TEXT | `PUSH` |
| `details` | JSONB | Información adicional |
| `timestamp` | TIMESTAMP | Cuándo ocurrió |

---

## 🔐 SEGURIDAD

### Implementada:

- ✅ HTTPS con SSL (Let's Encrypt)
- ✅ Nginx como reverse proxy
- ✅ CORS configurado
- ✅ Helmet.js para headers de seguridad
- ✅ Firewall (UFW) activado
- ✅ PostgreSQL con contraseña segura
- ✅ Logs de auditoría

### Recomendaciones Adicionales (Futuro):

- ⚠️ Agregar autenticación JWT (actualmente usa credenciales hardcodeadas)
- ⚠️ Implementar rate limiting
- ⚠️ Agregar encriptación de datos sensibles
- ⚠️ Backups automáticos de PostgreSQL

---

## 🐛 TROUBLESHOOTING

### Problema: Indicador muestra "🔴 Sin conexión" pero hay internet

**Solución:**
1. Verifica que el VPS esté corriendo:
   ```bash
   ssh root@TU_IP_VPS
   pm2 status
   ```

2. Verifica la URL en `.env.local`:
   ```env
   VITE_SYNC_API_URL=https://api.tudominio.com
   ```

3. Prueba manualmente:
   ```bash
   curl https://api.tudominio.com/api/health
   ```

### Problema: Sincronización falla con error

**Solución:**
1. Abre DevTools (Ctrl+Shift+I)
2. Ve a Console
3. Busca errores de [SyncManager]
4. Verifica los logs del servidor:
   ```bash
   pm2 logs meg-sistema
   ```

### Problema: No se ven los datos de otro usuario

**Solución:**
1. Verifica que ambos estén usando el mismo `userKey` (ej: `meg_creacion`)
2. Verifica que hayan sincronizado:
   - Usuario A debe ver "🟢 Sincronizado"
   - Usuario B debe sincronizar manualmente (botón ↻)

### Problema: SSL no funciona

**Solución:**
1. Verifica que el dominio apunte al IP del VPS:
   ```bash
   nslookup api.tudominio.com
   ```

2. Renueva certificado:
   ```bash
   sudo certbot renew
   sudo systemctl restart nginx
   ```

---

## 📊 MONITOREO

### Ver estadísticas de sincronización:

```bash
# En el VPS, conecta a PostgreSQL
sudo -u postgres psql meg_sistema

# Ver estadísticas
SELECT
  id,
  user_key,
  version,
  updated_at,
  jsonb_array_length(content->'clientes') as num_clientes,
  jsonb_array_length(content->'cotizaciones') as num_cotizaciones
FROM sync_data
ORDER BY updated_at DESC;

# Ver historial de cambios
SELECT * FROM sync_log ORDER BY timestamp DESC LIMIT 20;
```

### Endpoint de estadísticas (opcional):

```bash
curl https://api.tudominio.com/api/stats
```

---

## 🎯 CONFIGURACIÓN AVANZADA

### Cambiar intervalo de sincronización:

Edita `src/config/sync.js`:

```javascript
export const SYNC_CONFIG = {
  SYNC_INTERVAL: 30000, // 30 segundos (cambiar a gusto)
  // ...
};
```

### Deshabilitar sincronización temporalmente:

Opción 1: En `.env.local`:
```env
VITE_SYNC_ENABLED=false
```

Opción 2: En `src/config/sync.js`:
```javascript
export const SYNC_CONFIG = {
  SYNC_ENABLED: false,
  // ...
};
```

---

## 📞 RESUMEN DE LO QUE DEBES HACER

1. ✅ **Configurar VPS** (15-30 min)
   - Subir archivos del backend
   - Ejecutar `setup-vps.sh api.tudominio.com tu@email.com`
   - Iniciar app con PM2

2. ✅ **Configurar App** (2 min)
   - Editar `.env.local` con tu dominio
   - Reiniciar app

3. ✅ **Probar** (5 min)
   - Crear datos en PC 1
   - Verificar en PC 2

**TOTAL: ~20-40 minutos** ⏱️

---

## 🎉 ¡TODO LISTO!

El sistema está completamente implementado y listo para usar. Solo falta que configures el VPS siguiendo las instrucciones de arriba.

**Archivos clave para ti:**
- `vps-backend/INSTALACION-VPS.md` - Guía detallada del VPS
- `vps-backend/setup-vps.sh` - Script de instalación automática
- `.env.local` - Configuración de URL del VPS

**¿Necesitas ayuda?**
- Revisa los logs: `pm2 logs meg-sistema`
- Abre DevTools en la app: `Ctrl+Shift+I`
- Verifica conectividad: `curl https://api.tudominio.com/api/health`

---

## 📝 CHANGELOG

### Versión 1.1.0 (2025-01-06)

**Agregado:**
- ✅ Sistema completo de sincronización multi-usuario
- ✅ Indicador visual de estado online/offline
- ✅ Sincronización automática cada 30 segundos
- ✅ Modo offline con cola de cambios pendientes
- ✅ Backend para VPS (Express + PostgreSQL)
- ✅ Script de instalación automática del VPS
- ✅ Documentación completa

**Modificado:**
- 📝 CotizacionesPage: Agregado SyncStatus en header
- 📝 CreacionPage: Agregado SyncStatus en header

**Técnico:**
- 🔧 SyncManager con detección automática de conexión
- 🔧 Resolución de conflictos: Last-Write-Wins
- 🔧 Reintentos automáticos (máx 3)
- 🔧 PostgreSQL con versionado
- 🔧 Logs de auditoría

---

¡Éxito con la configuración! 🚀
