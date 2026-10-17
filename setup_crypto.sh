#!/bin/bash
set -e

echo "=== [1/6] Restoring clean backup if needed ==="
if [ -f ~/docker-compose.yml.bak ]; then
    cp ~/docker-compose.yml.bak ~/docker-compose.yml
else
    cp ~/docker-compose.yml ~/docker-compose.yml.bak
fi
cp ~/nginx/default.conf ~/nginx/default.conf.bak 2>/dev/null || true

echo "=== [2/6] Extracting frontend and loading backend image ==="
mkdir -p ~/crypto-dist
tar -xzf ~/crypto-frontend.tar.gz -C ~/crypto-dist --strip-components=1
docker load -i ~/crypto-backend.tar

echo "=== [3/6] Adding frontend volume to Nginx service ==="
if ! grep -q "crypto-dist" ~/docker-compose.yml; then
    sed -i '/default.conf/a \      - ./crypto-dist:/var/www/crypto:ro' ~/docker-compose.yml
fi

echo "=== [4/6] Appending Postgres & Backend services to docker-compose.yml ==="
if ! grep -q "crypto-backend" ~/docker-compose.yml; then
    # Remove networks section temporarily and append services + networks + volumes
    python3 - << 'PYEOF'
with open('/root/docker-compose.yml', 'r') as f:
    text = f.read()

services_block = """
  crypto-postgres:
    image: postgres:16-alpine
    container_name: crypto_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: StrongCryptoPassword123!
      POSTGRES_DB: wallet_ledger
    volumes:
      - crypto_pgdata:/var/lib/postgresql/data
    networks:
      - geopoosh_network

  crypto-backend:
    image: crypto-backend:latest
    container_name: crypto_backend
    restart: unless-stopped
    environment:
      PORT: 8080
      HOST: 0.0.0.0
      APP_ENV: production
      LOG_LEVEL: info
      DATABASE_URL: postgres://postgres:StrongCryptoPassword123!@crypto-postgres:5432/wallet_ledger?sslmode=disable
      BSC_MASTER_MNEMONIC: ""
      TON_ENDPOINT: "https://toncenter.com/api/v2/jsonRPC"
      TON_API_KEY: ""
    depends_on:
      - crypto-postgres
    networks:
      - geopoosh_network
"""

idx = text.rfind("networks:")
if idx != -1:
    new_text = text[:idx] + services_block.strip("\n") + "\n\n" + text[idx:].strip() + "\n\nvolumes:\n  crypto_pgdata:\n"
else:
    new_text = text + "\n" + services_block + "\nvolumes:\n  crypto_pgdata:\n"

with open('/root/docker-compose.yml', 'w') as f:
    f.write(new_text)
PYEOF
fi

echo "=== [5/6] Adding crypto server block to nginx/default.conf ==="
if ! grep -q "crypto.geopooshgroup.ir" ~/nginx/default.conf; then
cat << 'NGINX_EOF' >> ~/nginx/default.conf

# ==========================================
# Crypto Service (crypto.geopooshgroup.ir)
# ==========================================
server {
    listen 80;
    server_name crypto.geopooshgroup.ir;

    location / {
        root /var/www/crypto;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://crypto-backend:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://crypto-backend:8080/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINX_EOF
fi

echo "=== [6/6] Launching containers and reloading Nginx ==="
cd ~
docker compose up -d
docker compose exec nginx nginx -s reload

echo "=========================================="
echo "✅ All done! Crypto service is up and running!"
echo "=========================================="
