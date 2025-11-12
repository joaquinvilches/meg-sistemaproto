# Instrucciones para Crear Iconos de la Aplicación

## ⚠️ IMPORTANTE

Para que la aplicación instalada tenga iconos profesionales en Mac y Windows, necesitas generar archivos `.ico` y `.icns` a partir del logo actual.

## 📁 Archivos Requeridos

1. **Windows**: `build/icon.ico` (256x256px, 128x128px, 64x64px, 48x48px, 32x32px, 16x16px)
2. **Mac**: `build/icon.icns` (1024x1024px, 512x512px, 256x256px, 128x128px, 64x64px, 32x32px, 16x16px)

## 🛠️ Opción 1: Herramientas Online (Más Fácil)

### Para .ico (Windows):
1. Ve a: https://convertio.co/es/png-ico/
2. Sube `public/logo-meg.png`
3. Descarga el archivo `.ico` generado
4. Renombra a `icon.ico`
5. Muévelo a la carpeta `build/`

### Para .icns (Mac):
1. Ve a: https://cloudconvert.com/png-to-icns
2. Sube `public/logo-meg.png`
3. Descarga el archivo `.icns` generado
4. Renombra a `icon.icns`
5. Muévelo a la carpeta `build/`

## 🛠️ Opción 2: Herramientas Locales

### Windows (.ico):
Usa **electron-icon-maker** o **ImageMagick**:

```bash
npm install -g electron-icon-maker
electron-icon-maker --input=public/logo-meg.png --output=build
```

### Mac (.icns):
Usa **iconutil** (incluido en macOS):

```bash
# 1. Crear carpeta de iconos
mkdir icon.iconset

# 2. Generar tamaños requeridos con sips
sips -z 16 16     public/logo-meg.png --out icon.iconset/icon_16x16.png
sips -z 32 32     public/logo-meg.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     public/logo-meg.png --out icon.iconset/icon_32x32.png
sips -z 64 64     public/logo-meg.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   public/logo-meg.png --out icon.iconset/icon_128x128.png
sips -z 256 256   public/logo-meg.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   public/logo-meg.png --out icon.iconset/icon_256x256.png
sips -z 512 512   public/logo-meg.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   public/logo-meg.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 public/logo-meg.png --out icon.iconset/icon_512x512@2x.png

# 3. Convertir a .icns
iconutil -c icns icon.iconset -o build/icon.icns

# 4. Limpiar
rm -rf icon.iconset
```

## ✅ Verificación

Después de generar los iconos:

1. Crea la carpeta `build/` si no existe:
   ```bash
   mkdir build
   ```

2. Verifica que los archivos existan:
   - `build/icon.ico` (Windows)
   - `build/icon.icns` (Mac)

3. Compila la app y verifica:
   ```bash
   npm run build:win   # Windows
   npm run build:mac   # Mac
   ```

4. El instalador generado debería tener el icono correcto

## 📝 Notas

- El `package.json` ya está configurado para usar estos iconos
- Si no generas los iconos, la app usará el icono genérico de Electron
- Los iconos deben ser **cuadrados** (mismo ancho y alto)
- Recomendado: PNG con fondo transparente, mínimo 512x512px
