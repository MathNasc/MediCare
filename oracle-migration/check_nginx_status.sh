#!/usr/bin/env bash
# ==============================================================================
# MediCare — Diagnóstico Completo de Acessibilidade Nginx + SSL + DuckDNS
# ==============================================================================

echo "======================================================================"
echo " DIAGNÓSTICO DE ACESSIBILIDADE MEDICARE"
echo "======================================================================"

echo ""
echo "[1] Verificando se o backend Next.js está rodando na porta 3009:"
curl -I -s http://127.0.0.1:3009 | head -n 5 || echo "❌ Backend na porta 3009 não respondeu!"

echo ""
echo "[2] Verificando status do Nginx:"
sudo systemctl is-active nginx && echo "✓ Nginx ativo" || echo "❌ Nginx inativo!"

echo ""
echo "[3] Verificando portas 80, 443 e 3009 no netstat/ss:"
sudo ss -tulpn | grep -E ':(80|443|3009)' || true

echo ""
echo "[4] Garantindo regras do firewall iptables e ufw:"
sudo iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 3009 -j ACCEPT
sudo ufw allow 80/tcp 2>/dev/null || true
sudo ufw allow 443/tcp 2>/dev/null || true
sudo ufw allow 3009/tcp 2>/dev/null || true

if command -v netfilter-persistent >/dev/null 2>&1; then
  sudo netfilter-persistent save 2>/dev/null || true
fi

echo ""
echo "[5] Testando resposta HTTPS local do Nginx:"
curl -I -s -k https://localhost | head -n 5 || echo "❌ Resposta SSL local falhou"

echo ""
echo "======================================================================"
echo "✓ REGRAS REAPLICADAS E TESTADAS!"
echo "======================================================================"
