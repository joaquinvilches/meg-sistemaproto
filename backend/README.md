# Backend Standalone (Legacy)

Este backend es una versión standalone que **NO se usa** en la aplicación Electron.

## ¿Cuándo usar este backend?

- **Modo desarrollo web**: Si quieres correr el frontend en un navegador normal (sin Electron)
- **Testing**: Para probar la API de forma independiente
- **Migración futura**: Si decides mover a arquitectura cliente-servidor separada

## ¿Cuál se usa en producción?

La aplicación Electron usa el backend integrado en `electron/main.js`, **NO este**.

## Cómo ejecutar este backend standalone

```bash
cd backend
npm install
node server.js
```

El servidor correrá en http://localhost:3001

**Nota**: La base de datos será diferente a la de Electron (backend/data.db vs userData/data.db)
