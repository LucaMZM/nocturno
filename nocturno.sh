#!/bin/sh
set -eu
CDPATH= cd -- "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Falta Node.js en esta terminal. Activa la versión indicada en frontend/package.json." >&2
  exit 1
fi
case "${1:-up}" in
  up|restart)
    echo "Preparando NOCTURNO…" >&2
    export NOCTURNO_STRIPE_CLI=1
    ;;
  stop) set -- down ;;
  down|status|logs) ;;
  *) echo "Uso: ./nocturno.sh [up|stop|down|restart|status|logs]" >&2; exit 2 ;;
esac
exec node scripts/local.mjs "${1:-up}"
