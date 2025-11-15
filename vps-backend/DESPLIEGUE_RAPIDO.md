# 🚀 Despliegue Rápido - MEG Sistema v1.3.0

**VPS: Ubuntu + PostgreSQL + PM2**

---

## ⚡ **PASOS RÁPIDOS (Sin datos importantes)**

### **1. Subir archivo con WinSCP**

Conectar:
- Host: `179.61.200.166:2232`
- Usuario: `root`

Subir:
- `vps-backend/server.js` → `/var/www/meg-sistema/server.js` (reemplazar)

---

### **2. Conectar al VPS por SSH**

```bash
ssh -p 2232 root@179.61.200.166
```

---

### **3. Ejecutar script de limpieza e instalación**

Copia y pega TODO este bloque:

```bash
# Ir a la carpeta
cd /var/www/meg-sistema

# Detener servidor PM2
pm2 stop meg-sistema

# Limpiar base de datos PostgreSQL
psql -U meg_user -d meg_sistema -c "DELETE FROM sync_data;"

# Reiniciar servidor PM2
pm2 restart meg-sistema

# Ver logs
pm2 logs meg-sistema --lines 50
```

---

### **4. Verificar que funciona**

Deberías ver en los logs:

```
═══════════════════════════════════════
  MEG Sistema - VPS Backend Server
  v1.3.0 - FIX ESTRUCTURA APARTADOS
═══════════════════════════════════════
✅ Servidor corriendo en puerto 3002
✅ Validación de estructura: ACTIVADA
✅ Apartados configurados: meg, myorganic, meg_creacion, myorganic_creacion
═══════════════════════════════════════
✅ Datos iniciales creados para: meg (estructura: cotizaciones)
✅ Datos iniciales creados para: myorganic (estructura: cotizaciones)
✅ Datos iniciales creados para: meg_creacion (estructura: clientes, cotizaciones, ordenesCompra, ordenesTrabajo)
✅ Datos iniciales creados para: myorganic_creacion (estructura: clientes, cotizaciones, ordenesCompra, ordenesTrabajo)
```

---

### **5. Probar desde la app**

1. Abrir app Electron
2. Hacer login
3. Crear una cotización
4. Sincronizar
5. Borrar la cotización
6. **Verificar que NO se borra todo** ✅

---

## 🔍 **Comandos útiles**

```bash
# Ver logs en tiempo real
pm2 logs meg-sistema

# Reiniciar si hay problemas
pm2 restart meg-sistema

# Ver estado
pm2 status

# Ver datos en PostgreSQL
psql -U meg_user -d meg_sistema -c "
SELECT
  id,
  jsonb_object_keys(content) as keys
FROM sync_data
ORDER BY id;
"
```

---

## ✅ **¡LISTO!**

El fix está aplicado. Ahora:
- ✅ Apartados tienen estructura correcta
- ✅ Validación activada
- ✅ Borrar cotización funciona sin eliminar todo
