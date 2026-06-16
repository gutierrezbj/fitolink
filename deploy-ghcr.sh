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

# ── Validación de secretos ANTES de pull/up ──────────────────────────────────
# El compose.prod resuelve las variables desde el .env del VPS. Si falta alguna
# obligatoria, abortamos aquí con un mensaje claro en vez de levantar un stack a
# medias (la API arrancaría rota o el front quedaría sin login Google). (16-jun-2026)
ENV_FILE=".env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ No existe $ENV_FILE en $(pwd). Crea el .env del VPS antes de desplegar."
  exit 1
fi

# Validamos SIN hacer `source` del .env. El .env del VPS tiene valores con
# espacios y metacaracteres (p.ej. SMTP_FROM=FitoLink Alertas <...@systemrapid.io>)
# que `source` bajo `set -e` rompería (syntax error → abortaría el deploy). Docker
# Compose ya parsea el .env con su propio parser; aquí solo comprobamos presencia.
env_val() { grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2-; }

REQUIRED=(MONGODB_URI JWT_SECRET GOOGLE_CLIENT_ID)
MISSING=()
for var in "${REQUIRED[@]}"; do
  if [[ -z "$(env_val "$var")" ]]; then
    MISSING+=("$var")
  fi
done

if (( ${#MISSING[@]} > 0 )); then
  echo "❌ Faltan variables obligatorias en $ENV_FILE: ${MISSING[*]}"
  echo "   Sin ellas el stack arrancaría roto. Aborto antes del pull/up."
  exit 1
fi

# Avisos no bloqueantes: el deploy sigue, pero degradado (email / OAuth backend).
for var in GOOGLE_CLIENT_SECRET RESEND_API_KEY; do
  if [[ -z "$(env_val "$var")" ]]; then
    echo "⚠️  $var no definida en $ENV_FILE — funcionalidad asociada desactivada."
  fi
done
echo "✓ Secretos obligatorios presentes."
# ─────────────────────────────────────────────────────────────────────────────

echo "→ git pull (compose + código actualizados)"
git pull --ff-only origin main

echo "→ docker compose pull (imágenes ya construidas en GHCR)"
$COMPOSE pull web api geo-pipeline

echo "→ docker compose up -d (web · api)"
# OJO: NO levantamos el servicio `proxy` del compose. Este VPS es compartido
# (varios proyectos) y tiene un nginx en el HOST que hace de reverse proxy
# central, enrutando fitolink.agrom.es → 127.0.0.1:3040. El proxy del compose
# chocaria en el puerto 80 contra ese nginx del host. web/api exponen sus
# puertos en 127.0.0.1 y el nginx del host los sirve. (11-jun-2026)
# --wait: el deploy no imprime "completo" hasta que la API pase su healthcheck
# (/api/health). Así el flujo real aprovecha el healthcheck, no solo el rollback.
$COMPOSE up -d --wait web api

echo "→ limpiando imágenes huérfanas"
docker image prune -f >/dev/null 2>&1 || true

echo "✅ Deploy completo SIN compilar en el VPS."
echo "   El pipeline geo se corre aparte:"
echo "   $COMPOSE run --rm geo-pipeline"
