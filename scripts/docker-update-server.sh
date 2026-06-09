#!/usr/bin/env bash
# Rode no servidor Linux após copiar docker-compose.prod.yml e .env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

echo "Baixando imagens atualizadas..."
docker compose -f "$COMPOSE_FILE" pull

echo "Reiniciando containers..."
docker compose -f "$COMPOSE_FILE" up -d

echo "Deploy concluído."
docker compose -f "$COMPOSE_FILE" ps
