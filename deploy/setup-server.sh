#!/usr/bin/env bash
# Rode no servidor, dentro da pasta do projeto: ./deploy/setup-server.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f docker-compose.prod.yml ]]; then
  echo "Arquivo docker-compose.prod.yml não encontrado em $ROOT" >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  cp deploy/server.env.example .env
  echo "Criado .env a partir de deploy/server.env.example — edite as senhas antes de subir."
  echo "  nano .env"
  exit 0
fi

echo ".env já existe. Para subir:"
echo "  docker login"
echo "  docker compose -f docker-compose.prod.yml pull"
echo "  docker compose -f docker-compose.prod.yml up -d"
