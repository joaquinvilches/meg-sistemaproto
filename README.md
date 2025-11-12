# MEG Industrial & MyOrganic - Sistema de Gestión

Aplicación de escritorio para gestión de cotizaciones, órdenes de compra y trabajo para MEG Industrial y MyOrganic.

## 🚀 Características

- ✅ **Aplicación de escritorio nativa** para Windows y Mac
- ✅ **Funciona offline**: Base de datos SQLite local
- ✅ **Sincronización con VPS**: Respaldo automático en la nube (próximamente)
- ✅ **Gestión de cotizaciones**: Crear, editar, duplicar y exportar
- ✅ **Órdenes de compra y trabajo**: Control completo del flujo operativo
- ✅ **Gestión de clientes**: Base de datos integrada
- ✅ **Análisis financiero**: Gráficos de ingresos, costos y utilidades
- ✅ **Exportación**: PDF, Excel, JSON
- ✅ **Multi-empresa**: MEG Industrial y MyOrganic en una sola app

## 📋 Requisitos

- Node.js 18+
- npm 9+

## 🛠️ Instalación para Desarrollo

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar en modo desarrollo
npm run dev
```

Esto iniciará:
- Vite dev server en `http://localhost:5173`
- Electron con hot-reload
- Express local en puerto 3001

## 📦 Compilar para Producción

### Windows (.exe)
```bash
npm run build:win
```

### Mac (.dmg)
```bash
npm run build:mac
```

### Linux (.AppImage)
```bash
npm run build:linux
```

Los instaladores se generarán en la carpeta `release/`

### 🍎 Compilar para Mac desde Windows

**Problema**: Electron-builder no puede compilar completamente para Mac desde Windows.

**Solución Recomendada: GitHub Actions** (Automático y Gratis)

Este proyecto ya incluye GitHub Actions configurado (`.github/workflows/build.yml`):

1. **Sube tu código a GitHub**
2. **Crea un tag de versión**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. **GitHub compilará automáticamente** para Windows, Mac y Linux
4. **Descarga los instaladores** desde la página de Releases

**Alternativas**:
- MacStadium / MacinCloud (Mac remota, $20-100/mes)
- Pedir a alguien con Mac que ejecute `npm run build:mac`
- Compilación cruzada limitada (sin firma, con advertencias de seguridad)

Ver documentación completa en `build/README.md`

## 🏗️ Arquitectura

```
┌─────────────────────────────────────┐
│   Electron (Aplicación Escritorio) │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────┐     │
│  │   Renderer (UI)           │     │
│  │   React + Vite            │     │
│  │   TailwindCSS + Radix UI  │     │
│  └─────────┬─────────────────┘     │
│            │ IPC                   │
│  ┌─────────▼─────────────────┐     │
│  │   Main Process (Backend)  │     │
│  │   Express + SQLite Local  │     │
│  └─────────┬─────────────────┘     │
│            │                       │
└────────────┼───────────────────────┘
             │
             │ HTTP (futuro)
             ▼
    ┌────────────────┐
    │   VPS Remoto   │
    │   (Sync)       │
    └────────────────┘
```

## 📁 Estructura del Proyecto

```
meg-sistema/
├── electron/           # Proceso principal de Electron
│   ├── main.js        # Servidor Express + SQLite local
│   └── preload.js     # Bridge seguro IPC
│
├── src/               # Frontend React
│   ├── app/          # Estilos globales
│   ├── components/   # Componentes UI (Radix)
│   ├── pages/        # Páginas de la app
│   │   ├── CotizacionesPage.jsx
│   │   └── CreacionPage.jsx
│   ├── App.jsx       # Router principal
│   ├── main.jsx      # Entry point React
│   └── index.html    # HTML base
│
├── backend/          # Backend separado (legacy, no usado en Electron)
│   ├── server.js
│   └── data.db
│
├── public/           # Assets estáticos
├── dist/             # Build de Vite (generado)
└── release/          # Instaladores (generado)
```



## 💾 Ubicación de Datos

La base de datos local se almacena en:

- **Windows**: `C:\Users\<Usuario>\AppData\Roaming\meg-sistema-electron\data.db`
- **Mac**: `~/Library/Application Support/meg-sistema-electron/data.db`
- **Linux**: `~/.config/meg-sistema-electron/data.db`

## 🔧 Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Desarrollo con hot-reload |
| `npm run dev:vite` | Solo Vite dev server |
| `npm run dev:electron` | Solo Electron |
| `npm run build` | Build completo + empaquetado |
| `npm run build:win` | Build para Windows |
| `npm run build:mac` | Build para Mac |
| `npm run build:linux` | Build para Linux |
| `npm run preview` | Preview del build de Vite |
| `npm run electron` | Ejecutar Electron sin dev server |

## ✨ Novedades en v1.1.0

- ✅ **Sistema de notificaciones Toast**: Notificaciones visuales profesionales
- ✅ **Validación de RUT**: Componente con validación automática en tiempo real
- ✅ **Búsqueda avanzada**: Filtros por fecha, monto, cliente, RUT
- ✅ **Validaciones de formulario**: Previene errores de datos
- ✅ **Error Boundary**: Manejo robusto de errores
- ✅ **GitHub Actions**: Compilación automática multi-plataforma
- ✅ **Mejor UX**: Mensajes descriptivos y feedback visual

## 📝 Próximas Mejoras (v1.2.0)

- [ ] Sincronización automática con VPS
- [ ] Detección de conflictos en datos
- [ ] Auto-actualización de la aplicación
- [ ] Backup automático programado
- [ ] Modo oscuro
- [ ] Notificaciones de escritorio
- [ ] Sistema de permisos y roles

## 🐛 Solución de Problemas

### Error: "Cannot find module 'electron'"
```bash
npm install
```

### La aplicación no inicia
Verificar que el puerto 3001 no esté en uso:
```bash
# Windows
netstat -ano | findstr :3001

# Mac/Linux
lsof -ti:3001
```

### Errores de SQLite en Windows
Si hay problemas compilando SQLite, instalar:
```bash
npm install --global windows-build-tools
```

## 📄 Licencia

MIT - MEG Industrial

## 👥 Autores

- MEG Industrial Team
- Desarrollado con Claude Code
