#!/bin/sh
set -eu
cd "$(dirname "$0")"
case "${1:-up}" in
  up|restart) export NOCTURNO_STRIPE_CLI=1 ;;
  stop) set -- down ;;
  down|status|logs) ;;
  *) echo "Uso: ./nocturno.sh [up|stop|down|restart|status|logs]" >&2; exit 2 ;;
esac
exec node scripts/local.mjs "${1:-up}"
