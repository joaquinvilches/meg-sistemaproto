# 🚀 Guía de Instalación del VPS - MEG Sistema

## ✅ Pre-requisitos

- ✅ VPS Ubuntu 20.04 o 22.04
- ✅ Dominio apuntando al IP del VPS
- ✅ Acceso SSH al VPS

---

## 📋 OPCIÓN 1: Instalación Automática (Recomendada)

### Paso 1: Conectarse al VPS

```bash
ssh root@TU_IP_VPS
```

### Paso 2: Descargar el script de instalación

```bash
# Crear directorio temporal
mkdir -p /tmp/meg-setup
cd /tmp/meg-setup

# Descargar archivos (tendrás que subirlos primero)
# Por ahora, cópialos manualmente
```

### Paso 3: Subir archivos al VPS

Desde tu PC local, sube los archivos:

```bash
# En tu PC (Windows PowerShell o CMD)
cd C:\Users\JOAQUIN\Desktop\meg-sistema\vps-backend

# Opción A: Usando SCP (si tienes SSH configurado)
scp setup-vps.sh root@TU_IP_VPS:/root/
scp package.json root@TU_IP_VPS:/root/
scp server.js root@TU_IP_VPS:/root/

# Opción B: Usar WinSCP (interfaz gráfica)
# Descarga WinSCP, conecta y arrastra los archivos
```

### Paso 4: Ejecutar el script de instalación

```bash
# En el VPS
cd /root
chmod +x setup-vps.sh

# Ejecutar (reemplaza con TU dominio y email)
sudo ./setup-vps.sh api.tudominio.com tu@email.com
```

El script instalará automáticamente:
- ✅ Node.js 20 LTS
- ✅ PostgreSQL 15
- ✅ Nginx
- ✅ Certbot (SSL gratis)
- ✅ PM2
- ✅ Firewall

### Paso 5: Subir código de la aplicación

```bash
# Copiar archivos a la carpeta de la app
cp package.json /var/www/meg-sistema/
cp server.js /var/www/meg-sistema/
cd /var/www/meg-sistema

# Instalar dependencias
npm install
```

### Paso 6: Iniciar la aplicación

```bash
# Iniciar con PM2
pm2 start server.js --name meg-sistema

# Guardar configuración de PM2
pm2 save

# Verificar que esté corriendo
pm2 status
pm2 logs meg-sistema
```

### Paso 7: Verificar que funciona

```bash
# Desde el VPS
curl https://api.tudominio.com/api/health

# Deberías ver:
# {"status":"ok","timestamp":"2025-01-...","version":"1.0.0"}
```

---

## 📋 OPCIÓN 2: Instalación Manual

Si prefieres instalar paso a paso:

### 1. Actualizar sistema

```bash
apt update && apt upgrade -y
```

### 2. Instalar Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version  # Verificar
```

### 3. Instalar PostgreSQL

```bash
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

# Crear usuario y base de datos
sudo -u postgres psql
```

Dentro de PostgreSQL:

```sql
CREATE USER meg_user WITH PASSWORD 'TU_PASSWORD_SEGURA';
CREATE DATABASE meg_sistema OWNER meg_user;
GRANT ALL PRIVILEGES ON DATABASE meg_sistema TO meg_user;
\q
```

### 4. Instalar Nginx

```bash
apt install -y nginx
```

Crear archivo `/etc/nginx/sites-available/meg-sistema`:

```nginx
server {
    listen 80;
    server_name api.tudominio.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activar sitio:

```bash
ln -s /etc/nginx/sites-available/meg-sistema /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

### 5. Instalar SSL con Certbot

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.tudominio.com -m tu@email.com --agree-tos
```

### 6. Instalar PM2

```bash
npm install -g pm2
pm2 startup systemd
```

### 7. Configurar aplicación

```bash
# Crear directorio
mkdir -p /var/www/meg-sistema
cd /var/www/meg-sistema

# Copiar archivos (package.json, server.js)
# Crear .env
nano .env
```

Contenido del `.env`:

```env
PORT=3002
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=meg_sistema
DB_USER=meg_user
DB_PASSWORD=TU_PASSWORD_AQUI
ALLOWED_ORIGINS=https://api.tudominio.com
```

### 8. Instalar dependencias e iniciar

```bash
npm install
pm2 start server.js --name meg-sistema
pm2 save
```

---

## 🔧 Configurar la App Electron

### 1. Crear archivo `.env.local` en la raíz del proyecto

```env
VITE_SYNC_API_URL=https://api.tudominio.com
```

### 2. Reiniciar la app

```bash
npm run dev
```

Ahora la app se conectará automáticamente a tu VPS.

---

## ✅ Verificación

### Verificar estado del servidor

```bash
pm2 status
pm2 logs meg-sistema
```

### Verificar endpoints

```bash
# Health check
curl https://api.tudominio.com/api/health

# Pull datos
curl https://api.tudominio.com/api/sync/pull?userKey=meg_creacion

# Push datos (requiere POST)
curl -X POST https://api.tudominio.com/api/sync/push \
  -H "Content-Type: application/json" \
  -d '{"userKey":"meg_creacion","data":{"clientes":[]}}'
```

### Ver logs de PostgreSQL

```bash
sudo -u postgres psql meg_sistema

# Dentro de PostgreSQL
SELECT * FROM sync_data;
SELECT * FROM sync_log ORDER BY timestamp DESC LIMIT 10;
\q
```

---

## 🛠️ Comandos Útiles

### PM2

```bash
pm2 restart meg-sistema    # Reiniciar app
pm2 stop meg-sistema        # Detener app
pm2 logs meg-sistema        # Ver logs en tiempo real
pm2 logs meg-sistema --lines 100  # Ver últimas 100 líneas
pm2 monit                    # Monitor en tiempo real
```

### Nginx

```bash
systemctl restart nginx      # Reiniciar Nginx
nginx -t                     # Verificar configuración
tail -f /var/log/nginx/error.log  # Ver logs de error
```

### PostgreSQL

```bash
systemctl status postgresql  # Estado
sudo -u postgres psql meg_sistema  # Conectar a DB
```

### Firewall

```bash
ufw status                   # Ver estado
ufw allow 80/tcp             # Permitir puerto 80
ufw allow 443/tcp            # Permitir puerto 443
```

---

## 🔐 Seguridad

### Cambiar password de PostgreSQL

```bash
sudo -u postgres psql
ALTER USER meg_user WITH PASSWORD 'NUEVA_PASSWORD_SUPER_SEGURA';
\q

# Actualizar .env
nano /var/www/meg-sistema/.env
```

### Actualizar SSL (auto-renovación)

```bash
certbot renew --dry-run      # Prueba
systemctl status certbot.timer  # Ver timer de renovación
```

---

## 🐛 Troubleshooting

### App no inicia

```bash
pm2 logs meg-sistema
# Ver errores y solucionarlos
```

### Error de conexión a DB

```bash
# Verificar que PostgreSQL esté corriendo
systemctl status postgresql

# Verificar credenciales en .env
cat /var/www/meg-sistema/.env

# Probar conexión manual
sudo -u postgres psql meg_sistema -c "SELECT version();"
```

### SSL no funciona

```bash
# Ver estado de certificados
certbot certificates

# Renovar manualmente
certbot renew
```

### Nginx error 502 Bad Gateway

```bash
# Verificar que la app esté corriendo
pm2 status

# Verificar puerto
netstat -tulpn | grep 3002

# Ver logs de Nginx
tail -f /var/log/nginx/error.log
```

---

## 📊 Monitoreo

### Ver uso de recursos

```bash
# CPU y RAM
htop

# Espacio en disco
df -h

# Procesos de Node
ps aux | grep node
```

### Backups de Base de Datos

```bash
# Crear backup
sudo -u postgres pg_dump meg_sistema > backup_$(date +%Y%m%d).sql

# Restaurar backup
sudo -u postgres psql meg_sistema < backup_20250104.sql
```

---

## 🎯 Próximos Pasos

Una vez que el VPS esté corriendo:

1. Configurar `.env.local` en la app Electron con la URL del VPS
2. Abrir la app y verificar que aparezca "🟢 Online"
3. Probar crear datos y ver que se sincronicen
4. Abrir la app en otro PC y verificar que vea los mismos datos

---

## 📞 Ayuda

Si algo no funciona:

1. Revisar logs: `pm2 logs meg-sistema`
2. Verificar conectividad: `curl https://api.tudominio.com/api/health`
3. Ver estado de servicios: `systemctl status nginx postgresql`

---

## 🎉 ¡Listo!

Tu VPS ahora está configurado y listo para sincronizar datos entre múltiples usuarios.
