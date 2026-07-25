#!/usr/bin/env bash
# Instala ops/crontab en el VPS de FitoLink de forma SEGURA.
#
# - Hace copia de seguridad del crontab actual antes de tocar nada.
# - Sustituye el crontab por el contenido versionado (fuente de verdad).
# - Muestra un diff para que se vea qué cambia ANTES de aplicarlo.
#
# Uso:  bash ops/install-crontab.sh [--apply]
#       (sin --apply solo enseña el diff · no toca el VPS)
set -euo pipefail

VPS="${FITOLINK_VPS:-root@100.110.52.22}"
SRC="$(cd "$(dirname "$0")" && pwd)/crontab"
APPLY="${1:-}"

echo "→ crontab actual en $VPS:"
ACTUAL="$(ssh "$VPS" 'crontab -l 2>/dev/null' || true)"
echo "${ACTUAL:-  (vacío)}"
echo
echo "→ diferencias con ops/crontab:"
diff <(printf '%s\n' "$ACTUAL") "$SRC" || true
echo

if [ "$APPLY" != "--apply" ]; then
  echo "ℹ️  Simulación. Para aplicarlo de verdad:  bash ops/install-crontab.sh --apply"
  exit 0
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
echo "→ copia de seguridad en el VPS: /root/crontab-backup-$STAMP"
ssh "$VPS" "crontab -l > /root/crontab-backup-$STAMP 2>/dev/null || true"
echo "→ instalando…"
ssh "$VPS" 'crontab -' < "$SRC"
echo "→ crontab resultante:"
ssh "$VPS" 'crontab -l'
echo "✅ Instalado. Restaurar con: ssh $VPS 'crontab /root/crontab-backup-$STAMP'"
