#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TAG="${1:-latest}"
export IMAGE_TAG="$TAG"

if [[ -z "${DOCKERHUB_USER:-}" ]] && [[ -f .env ]]; then
  export DOCKERHUB_USER="$(grep -E '^DOCKERHUB_USER=' .env | head -1 | cut -d= -f2- | tr -d '"'"' "'"'')"
fi

if [[ -z "${DOCKERHUB_USER:-}" ]]; then
  echo "Defina DOCKERHUB_USER no arquivo .env (ex.: DOCKERHUB_USER=seu-usuario)" >&2
  exit 1
fi

echo "Build: ${DOCKERHUB_USER}/vox-script-salux:${TAG} e api..."
docker compose build

echo "Push para Docker Hub..."
docker compose push

echo "Publicado com sucesso. Tag: ${TAG}"
echo "No servidor: docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d"
