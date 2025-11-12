# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [1.1.0] - 2025-01-XX

### ✨ Agregado
- Sistema de notificaciones Toast profesional (reemplazó 19 alerts)
- Componente RUTInput con validación automática en tiempo real
- Componente SearchFilters para búsqueda avanzada de cotizaciones
- Validaciones de formulario (cliente, RUT, monto, fecha)
- Error Boundary para manejo robusto de errores
- GitHub Actions para compilación multiplataforma automática
- Documentación de backend standalone (legacy)
- Archivo credentials.example.json para mejor seguridad
- .gitignore mejorado con exclusiones específicas de Electron

### 🔧 Mejorado
- Mensajes de error más descriptivos y user-friendly
- Experiencia de usuario con notificaciones visuales
- Validación de RUT chileno con dígito verificador
- Estructura de carpetas documentada (build/, backend/)
- README actualizado con estado actual del proyecto

### 🗑️ Eliminado
- Dependencia `dotenv` no utilizada
- Console.logs de debug en producción

### 🐛 Corregido
- Validación de datos antes de guardar cotizaciones
- Mensajes de error genéricos reemplazados por específicos

### 📝 Documentación
- README mejorado con instrucciones de compilación multiplataforma
- Documentación de build/ con instrucciones de iconos
- Documentación de backend/ explicando uso standalone
- CHANGELOG.md creado
- Comentarios de código mejorados

### 🔒 Seguridad
- Credenciales movidas a archivo ejemplo (no en código)
- Validaciones de entrada implementadas
- .gitignore actualizado para excluir archivos sensibles

---

## [1.0.0] - 2025-01-XX

### ✨ Lanzamiento Inicial

#### Características Principales
- Aplicación Electron de escritorio para Windows y Mac
- Base de datos SQLite local (funciona offline)
- Gestión completa de cotizaciones (crear, editar, duplicar, eliminar)
- Gestión de órdenes de compra (OC)
- Gestión de órdenes de trabajo (OT)
- Gestión de clientes
- Exportación a PDF, Excel y JSON
- Dashboard con gráficos financieros (ingresos, costos, utilidades)
- Multi-empresa (MEG Industrial y MyOrganic)
- Sistema de autenticación local
- Modo desarrollo con hot-reload

#### Stack Tecnológico
- React 19
- Electron 34
- Vite 6
- Express 5
- SQLite 3
- TailwindCSS 3
- Radix UI
- Recharts
- pdf-lib
- XLSX

#### Arquitectura
- Frontend: React + Vite
- Backend: Express integrado en Electron
- Base de datos: SQLite local
- IPC seguro con preload script

---

## Próximas Versiones

### [1.2.0] - Planificado
- [ ] Sincronización con VPS remoto
- [ ] Detección de conflictos en datos
- [ ] Auto-actualización de la aplicación
- [ ] Backup automático programado
- [ ] Modo oscuro
- [ ] Notificaciones de escritorio

### [2.0.0] - Futuro
- [ ] Sistema de permisos y roles
- [ ] Múltiples usuarios
- [ ] Historial de cambios (audit log)
- [ ] Reportes avanzados
- [ ] Integración con servicios externos
- [ ] API REST pública

---

## Notas de Versión

### Cómo actualizar

#### Desde versión 1.0.0 a 1.1.0:
1. Descargar el nuevo instalador
2. Ejecutar el instalador (sobrescribe la versión anterior)
3. Los datos se mantienen automáticamente (base de datos en userData)
4. Primera ejecución mostrará las nuevas funcionalidades

#### Compatibilidad de datos:
- ✅ Base de datos compatible entre versiones 1.x.x
- ✅ Los datos existentes se migran automáticamente
- ✅ Backup automático antes de migración

---

## Reporte de Bugs

Si encuentras un bug, por favor reporta en:
- GitHub Issues: (agregar URL cuando esté público)
- Email: (agregar email de soporte)

Incluye:
- Versión de la aplicación
- Sistema operativo
- Pasos para reproducir el error
- Screenshots si es posible
