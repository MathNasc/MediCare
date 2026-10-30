#!/usr/bin/env bash
# ==============================================================================
# MediCare — Configuração Automática do Nginx + SSL (DuckDNS / Certbot)
# ==============================================================================

set -e

DOMAIN="${1:-medicare-cuidador.duckdns.org}"

echo "======================================================================"
echo " CONFIGURANDO NGINX + SSL PARA: $DOMAIN"
echo "======================================================================"

# 1. Instala Nginx e Certbot se não estiverem instalados
sudo apt-get update -y
sudo apt-get install -y nginx certbot python3-certbot-nginx

# 2. Escreve a configuração no Nginx
sudo bash -c "cat > /etc/nginx/sites-available/medicare" <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3009;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

# 3. Ativa o site no Nginx e recarrega
sudo ln -sf /etc/nginx/sites-available/medicare /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
sudo nginx -t
sudo systemctl reload nginx

# 4. Libera as portas 80 e 443 no firewall
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
sudo ufw allow 80/tcp 2>/dev/null || true
sudo ufw allow 443/tcp 2>/dev/null || true

echo ""
echo "======================================================================"
echo "✓ NGINX CONFIGURADO COM SUCESSO!"
echo "Agora, executando o Certbot para gerar o certificado SSL com HTTPS..."
echo "======================================================================"

sudo certbot --nginx -d "$DOMAIN"
