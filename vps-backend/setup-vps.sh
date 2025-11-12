#!/bin/bash

################################################################################
# MEG Sistema - Script de Instalación Automática para VPS Ubuntu
################################################################################
#
# Este script instala y configura todo lo necesario:
# - Node.js 20 LTS
# - PostgreSQL 15
# - Nginx con SSL (Let's Encrypt)
# - PM2 para mantener el servidor corriendo
# - Firewall (UFW)
#
# USO:
#   chmod +x setup-vps.sh
#   sudo ./setup-vps.sh tudominio.com tu@email.com
#
################################################################################

set -e  # Salir si hay errores

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # Sin color

# Verificar argumentos
if [ "$#" -lt 2 ]; then
    echo -e "${RED}Error: Faltan argumentos${NC}"
    echo "Uso: sudo $0 DOMINIO EMAIL"
    echo "Ejemplo: sudo $0 api.meg-sistema.com admin@meg.com"
    exit 1
fi

DOMAIN=$1
EMAIL=$2
DB_PASSWORD=$(openssl rand -base64 32)

echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  MEG Sistema - Setup VPS Ubuntu${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "Dominio: ${YELLOW}$DOMAIN${NC}"
echo -e "Email: ${YELLOW}$EMAIL${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"

# ═══════════════════════════════════════
# 1. Actualizar sistema
# ═══════════════════════════════════════
echo -e "\n${YELLOW}[1/8] Actualizando sistema...${NC}"
apt update && apt upgrade -y

# ═══════════════════════════════════════
# 2. Instalar Node.js 20 LTS
# ═══════════════════════════════════════
echo -e "\n${YELLOW}[2/8] Instalando Node.js 20 LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo -e "${GREEN}✓ Node.js version: $(node --version)${NC}"
echo -e "${GREEN}✓ npm version: $(npm --version)${NC}"

# ═══════════════════════════════════════
# 3. Instalar PostgreSQL 15
# ═══════════════════════════════════════
echo -e "\n${YELLOW}[3/8] Instalando PostgreSQL 15...${NC}"
apt install -y postgresql postgresql-contrib

# Iniciar PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Crear usuario y base de datos
sudo -u postgres psql <<EOF
CREATE USER meg_user WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE meg_sistema OWNER meg_user;
GRANT ALL PRIVILEGES ON DATABASE meg_sistema TO meg_user;
\q
EOF

echo -e "${GREEN}✓ PostgreSQL instalado y configurado${NC}"
echo -e "${GREEN}✓ Usuario: meg_user${NC}"
echo -e "${GREEN}✓ Base de datos: meg_sistema${NC}"

# ═══════════════════════════════════════
# 4. Instalar Nginx
# ═══════════════════════════════════════
echo -e "\n${YELLOW}[4/8] Instalando Nginx...${NC}"
apt install -y nginx

# Crear configuración de Nginx
cat > /etc/nginx/sites-available/meg-sistema <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Activar sitio
ln -sf /etc/nginx/sites-available/meg-sistema /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Verificar configuración
nginx -t

# Reiniciar Nginx
systemctl restart nginx
systemctl enable nginx

echo -e "${GREEN}✓ Nginx instalado y configurado${NC}"

# ═══════════════════════════════════════
# 5. Instalar Certbot (SSL)
# ═══════════════════════════════════════
echo -e "\n${YELLOW}[5/8] Instalando Certbot para SSL...${NC}"
apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL

# Auto-renovación
systemctl enable certbot.timer

echo -e "${GREEN}✓ SSL configurado para $DOMAIN${NC}"

# ═══════════════════════════════════════
# 6. Instalar PM2
# ═══════════════════════════════════════
echo -e "\n${YELLOW}[6/8] Instalando PM2...${NC}"
npm install -g pm2

# Configurar PM2 para iniciar al arrancar
pm2 startup systemd -u root --hp /root
systemctl enable pm2-root

echo -e "${GREEN}✓ PM2 instalado${NC}"

# ═══════════════════════════════════════
# 7. Configurar Firewall
# ═══════════════════════════════════════
echo -e "\n${YELLOW}[7/8] Configurando Firewall (UFW)...${NC}"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo -e "${GREEN}✓ Firewall configurado${NC}"

# ═══════════════════════════════════════
# 8. Crear directorio de aplicación
# ═══════════════════════════════════════
echo -e "\n${YELLOW}[8/8] Configurando aplicación...${NC}"

# Crear directorio
mkdir -p /var/www/meg-sistema
cd /var/www/meg-sistema

# Crear archivo .env
cat > .env <<EOF
PORT=3002
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=meg_sistema
DB_USER=meg_user
DB_PASSWORD=$DB_PASSWORD
ALLOWED_ORIGINS=https://$DOMAIN
EOF

echo -e "${GREEN}✓ Directorio de aplicación creado${NC}"

# ═══════════════════════════════════════
# Resumen final
# ═══════════════════════════════════════
echo -e "\n${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ INSTALACIÓN COMPLETADA${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e ""
echo -e "📁 Directorio de aplicación: ${YELLOW}/var/www/meg-sistema${NC}"
echo -e "🔐 Archivo .env creado con configuración"
echo -e ""
echo -e "${YELLOW}PRÓXIMOS PASOS:${NC}"
echo -e ""
echo -e "1. Sube los archivos de la aplicación:"
echo -e "   ${YELLOW}cd /var/www/meg-sistema${NC}"
echo -e "   ${YELLOW}# Sube: package.json y server.js${NC}"
echo -e ""
echo -e "2. Instala dependencias:"
echo -e "   ${YELLOW}npm install${NC}"
echo -e ""
echo -e "3. Inicia la aplicación con PM2:"
echo -e "   ${YELLOW}pm2 start server.js --name meg-sistema${NC}"
echo -e "   ${YELLOW}pm2 save${NC}"
echo -e ""
echo -e "4. Verifica que esté corriendo:"
echo -e "   ${YELLOW}pm2 status${NC}"
echo -e "   ${YELLOW}pm2 logs meg-sistema${NC}"
echo -e ""
echo -e "5. Prueba tu API:"
echo -e "   ${YELLOW}curl https://$DOMAIN/api/health${NC}"
echo -e ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}⚠️  IMPORTANTE - Guarda esta información:${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "Base de datos: ${YELLOW}meg_sistema${NC}"
echo -e "Usuario DB: ${YELLOW}meg_user${NC}"
echo -e "Password DB: ${YELLOW}$DB_PASSWORD${NC}"
echo -e ""
echo -e "Esta password está guardada en: ${YELLOW}/var/www/meg-sistema/.env${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
