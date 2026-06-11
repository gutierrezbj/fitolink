#!/usr/bin/env bash
#
# Deploy de FitoLink · flujo GHCR (11-jun-2026).
#
# Las imágenes se compilan en GitHub Actions (.github/workflows/deploy.yml) y
# se publican a GHCR. Este script SOLO las baja y levanta — no compila nada en
# el VPS, así que el deploy pasa de ~30 min a segundos.
#
# Requisito (una sola vez): `docker login ghcr.io` hecho en el host con un PAT
# de scope read:packages. Ver docs/deploy-ghcr.md.
#
# Rollback: si GHCR fallara, `docker compose -f docker-compose.prod.yml up -d
# --build` vuelve a compilar localmente (el bloque build: sigue en el compose).
#
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.prod.yml"

echo "→ git pull (compose + código actualizados)"
git pull --ff-only origin main

echo "→ docker compose pull (imágenes ya construidas en GHCR)"
$COMPOSE pull web api geo-pipeline

echo "→ docker compose up -d (web · api · proxy)"
$COMPOSE up -d web api proxy

echo "→ limpiando imágenes huérfanas"
docker image prune -f >/dev/null 2>&1 || true

echo "✅ Deploy completo SIN compilar en el VPS."
echo "   El pipeline geo se corre aparte:"
echo "   $COMPOSE run --rm geo-pipeline"
