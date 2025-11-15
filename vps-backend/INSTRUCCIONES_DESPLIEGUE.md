# 📋 Instrucciones de Despliegue - MEG Sistema v1.3.0

## 🔴 **CRÍTICO - LEE COMPLETO ANTES DE EJECUTAR**

Este fix corrige la estructura de apartados que causaba:
- ✅ Datos sincronizados mal al iniciar
- ✅ Todo se elimina al borrar una cotización
- ✅ Mezcla de datos entre apartados

---

## 📦 **PASO 1: BACKUP DE DATOS ACTUALES**

### **Opción A: Backup desde PostgreSQL (RECOMENDADO)**

```bash
# Conectar al VPS
ssh -p 2232 root@179.61.200.166

# Crear backup de la base de datos
pg_dump -U meg_user -d meg_sistema > /root/backup_meg_sistema_$(date +%Y%m%d_%H%M%S).sql

# Verificar que el backup se creó
ls -lh /root/backup_meg_sistema_*
```

### **Opción B: Exportar datos a JSON**

```bash
# Conectar a PostgreSQL
psql -U meg_user -d meg_sistema

# Exportar datos a archivo
\copy (SELECT row_to_json(t) FROM sync_data t) TO '/tmp/backup_sync_data.json';

# Salir
\q

# Verificar archivo
cat /tmp/backup_sync_data.json
```

---

## 🛑 **PASO 2: DETENER EL SERVIDOR ACTUAL**

```bash
# Buscar el proceso de Node.js
ps aux | grep "node.*server.js"

# Debería mostrar algo como:
# root  67896  ... node /var/www/meg-sistema/server.js

# Detener el proceso (reemplaza 67896 con el PID real)
kill 67896

# Verificar que se detuvo
ps aux | grep "node.*server.js" | grep -v grep
# No debería mostrar nada
```

---

## 📁 **PASO 3: REEMPLAZAR server.js CON WINSCP**

### **Usando WinSCP:**

1. **Conectar al VPS:**
   - Host: `179.61.200.166`
   - Port: `2232`
   - Username: `root`
   - Password: `[tu contraseña]`

2. **Navegar a la carpeta:**
   - Ir a: `/var/www/meg-sistema/`

3. **Backup del archivo actual:**
   - Renombrar `server.js` a `server.js.bak_v1.2.8`

4. **Subir el nuevo archivo:**
   - Arrastrar `vps-backend/server.js` desde tu PC
   - Destino: `/var/www/meg-sistema/server.js`

5. **Verificar permisos:**
   ```bash
   chmod 644 /var/www/meg-sistema/server.js
   chown root:root /var/www/meg-sistema/server.js
   ```

---

## 🗄️ **PASO 4: LIMPIAR LA BASE DE DATOS**

### **Conectar a PostgreSQL:**

```bash
# Desde el VPS
psql -U meg_user -d meg_sistema
```

### **Ejecutar limpieza:**

```sql
-- Ver datos actuales
SELECT
  id,
  user_key,
  version,
  jsonb_array_length(COALESCE(content->'clientes', '[]'::jsonb)) as clientes,
  jsonb_array_length(COALESCE(content->'cotizaciones', '[]'::jsonb)) as cotizaciones,
  jsonb_array_length(COALESCE(content->'ordenesCompra', '[]'::jsonb)) as ordenes_compra,
  jsonb_array_length(COALESCE(content->'ordenesTrabajo', '[]'::jsonb)) as ordenes_trabajo
FROM sync_data
ORDER BY id;

-- Eliminar registros corruptos
DELETE FROM sync_data
WHERE id IN ('meg', 'myorganic', 'meg_creacion', 'myorganic_creacion');

-- Verificar que se eliminaron
SELECT COUNT(*) FROM sync_data;

-- Salir
\q
```

---

## ▶️ **PASO 5: INICIAR EL SERVIDOR CON LA NUEVA VERSIÓN**

### **Opción A: Iniciar manualmente (para testing)**

```bash
cd /var/www/meg-sistema
node server.js
```

**Verificar que muestre:**
```
═══════════════════════════════════════
  MEG Sistema - VPS Backend Server
  v1.3.0 - FIX ESTRUCTURA APARTADOS
═══════════════════════════════════════
✅ Servidor corriendo en puerto 3002
✅ Validación de estructura: ACTIVADA
✅ Apartados configurados: meg, myorganic, meg_creacion, myorganic_creacion
═══════════════════════════════════════
```

### **Opción B: Iniciar como servicio (producción)**

Si usas PM2:
```bash
pm2 stop meg-sistema
pm2 start /var/www/meg-sistema/server.js --name meg-sistema
pm2 save
```

Si usas systemd:
```bash
systemctl restart meg-sistema
systemctl status meg-sistema
```

---

## ✅ **PASO 6: VERIFICAR QUE FUNCIONA**

### **1. Verificar que el servidor responde:**

```bash
curl http://localhost:3002/api/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-15T...",
  "version": "1.3.0"
}
```

### **2. Verificar estructura de apartados:**

```bash
psql -U meg_user -d meg_sistema -c "
SELECT
  id,
  jsonb_object_keys(content) as keys
FROM sync_data
ORDER BY id;
"
```

**Resultado esperado:**
```
     id          |     keys
-----------------+---------------
 meg             | cotizaciones
 meg_creacion    | clientes
 meg_creacion    | cotizaciones
 meg_creacion    | ordenesCompra
 meg_creacion    | ordenesTrabajo
 myorganic       | cotizaciones
 myorganic_creacion | clientes
 myorganic_creacion | cotizaciones
 myorganic_creacion | ordenesCompra
 myorganic_creacion | ordenesTrabajo
```

### **3. Probar desde un cliente Electron:**

1. Abrir la aplicación Electron
2. Hacer login
3. Verificar que sincroniza correctamente
4. Crear una cotización
5. Borrar una cotización
6. Verificar que NO se elimina todo

---

## 📊 **PASO 7: MONITOREAR LOGS**

```bash
# Si está corriendo manualmente, verás logs en tiempo real

# Si usas PM2:
pm2 logs meg-sistema --lines 100

# Buscar estas líneas en los logs:
# ✅ Datos iniciales creados para: meg (estructura: cotizaciones)
# ✅ Datos iniciales creados para: meg_creacion (estructura: clientes, cotizaciones, ordenesCompra, ordenesTrabajo)
# ✅ Datos iniciales creados para: myorganic (estructura: cotizaciones)
# ✅ Datos iniciales creados para: myorganic_creacion (estructura: clientes, cotizaciones, ordenesCompra, ordenesTrabajo)
```

---

## 🔧 **CAMBIOS REALIZADOS EN v1.3.0**

### **1. Estructura de Apartados Corregida:**

| Apartado | Antes (INCORRECTO) | Ahora (CORRECTO) |
|----------|-------------------|------------------|
| `meg` | `{ clientes: [], cotizaciones: [], ordenesCompra: [], ordenesTrabajo: [] }` | `{ cotizaciones: [] }` |
| `myorganic` | `{ clientes: [], cotizaciones: [], ordenesCompra: [], ordenesTrabajo: [] }` | `{ cotizaciones: [] }` |
| `meg_creacion` | **NO EXISTÍA** | `{ clientes: [], cotizaciones: [], ordenesCompra: [], ordenesTrabajo: [] }` |
| `myorganic_creacion` | **NO EXISTÍA** | `{ clientes: [], cotizaciones: [], ordenesCompra: [], ordenesTrabajo: [] }` |

### **2. Validación de Estructura Agregada:**

```javascript
// Antes: Aceptaba cualquier estructura
POST /api/sync/push { cualquier: "cosa" } // ✅ Se guardaba

// Ahora: Valida según apartado
POST /api/sync/push?userKey=meg { clientes: [...] } // ❌ Error: apartado principal solo debe tener cotizaciones
POST /api/sync/push?userKey=meg { cotizaciones: [...] } // ✅ Correcto
```

### **3. Función de Validación:**

- `validateDataStructure()`: Valida estructura según `userKey`
- Filtra claves no permitidas
- Loguea advertencias si recibe datos extra

---

## 🚨 **TROUBLESHOOTING**

### **Problema: "Error al conectar a PostgreSQL"**

```bash
# Verificar que PostgreSQL está corriendo
systemctl status postgresql

# Reiniciar si es necesario
systemctl restart postgresql

# Verificar credenciales en .env
cat /var/www/meg-sistema/.env
```

### **Problema: "Puerto 3002 ya en uso"**

```bash
# Buscar proceso usando el puerto
lsof -i :3002

# Matar proceso
kill -9 [PID]
```

### **Problema: "Estructura inválida al hacer PUSH"**

- Esto es NORMAL si tienes datos viejos en el cliente
- El VPS ahora rechaza estructuras incorrectas
- Solución: Limpiar datos locales del cliente (SQLite) y volver a sincronizar

---

## 📝 **NOTAS FINALES**

1. **Clientes existentes**: Necesitarán limpiar su base de datos local (SQLite) después del fix
2. **Sincronización**: La primera sincronización después del fix descargará todo desde el VPS
3. **Backup**: Mantén el backup por al menos 7 días antes de eliminarlo
4. **Monitoreo**: Revisa los logs durante las primeras 24 horas

---

## ✅ **CHECKLIST DE VERIFICACIÓN**

- [ ] Backup de base de datos creado
- [ ] Servidor detenido
- [ ] `server.js` respaldado como `server.js.bak_v1.2.8`
- [ ] Nuevo `server.js` subido
- [ ] Permisos de archivo verificados
- [ ] Base de datos limpiada
- [ ] Servidor iniciado correctamente
- [ ] Version 1.3.0 confirmada en `/api/health`
- [ ] Estructura de apartados verificada en PostgreSQL
- [ ] Cliente sincroniza correctamente
- [ ] Borrar cotización funciona sin eliminar todo

---

**¿Problemas? Contacta al desarrollador antes de continuar.**
