#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/dev.sh [--wifi] [--vite-port <port>] [--backend-port <port>] [--no-strict-port]

Defaults:
  - local-only bind (127.0.0.1)
  - Vite port 5173, backend port 8000

Wi-Fi mode:
  --wifi binds backend + Vite to 0.0.0.0 (trusted LAN only).
EOF
}

wifi_mode=0
strict_port=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --wifi) wifi_mode=1 ;;
    --vite-port) shift; export VITE_PORT="${1:-}";;
    --backend-port) shift; export CHORE_PORT="${1:-}";;
    --strict-port) strict_port=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
  shift
done

export CHORE_VAULT_PATH="${CHORE_VAULT_PATH:-"$repo_root/vault_sample/chore_system"}"
export CHORE_DEVICE_ID="${CHORE_DEVICE_ID:-dev_desktop}"
export CHORE_BIND="${CHORE_BIND:-127.0.0.1}"
export CHORE_PORT="${CHORE_PORT:-8000}"
export VITE_PORT="${VITE_PORT:-5173}"
export VITE_HOST="${VITE_HOST:-127.0.0.1}"

if [[ "$wifi_mode" == "1" ]]; then
  export CHORE_BIND="0.0.0.0"
  export VITE_HOST="0.0.0.0"
fi

backend_dir="$repo_root/backend"
frontend_dir="$repo_root/frontend"
venv_dir="$backend_dir/.venv"

best_effort_lan_ip() {
  local ip_addr=""
  if command -v hostname >/dev/null 2>&1; then
    ip_addr="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  if [[ -z "$ip_addr" ]] && command -v ip >/dev/null 2>&1; then
    ip_addr="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i=="src") {print $(i+1); exit}}')"
  fi
  echo "$ip_addr"
}

cleanup() {
  if [[ -n "${backend_pid:-}" ]]; then
    kill "$backend_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ ! -d "$venv_dir" ]]; then
  python3 -m venv "$venv_dir"
fi

# shellcheck disable=SC1091
source "$venv_dir/bin/activate"

pip -q install -r "$backend_dir/requirements.txt"

lan_ip="$(best_effort_lan_ip)"
frontend_host_hint="$VITE_HOST"
backend_host_hint="$CHORE_BIND"
if [[ "$VITE_HOST" == "0.0.0.0" && -n "$lan_ip" ]]; then
  frontend_host_hint="$lan_ip"
fi
if [[ "$CHORE_BIND" == "0.0.0.0" && -n "$lan_ip" ]]; then
  backend_host_hint="$lan_ip"
fi

echo ""
echo "Housepage dev launcher"
echo "- Vault: $CHORE_VAULT_PATH"
echo "- Backend: http://$backend_host_hint:$CHORE_PORT"
echo "- Frontend: http://$frontend_host_hint:$VITE_PORT"
if [[ "$VITE_HOST" == "0.0.0.0" ]]; then
  echo ""
  echo "Wi-Fi mode: open the frontend URL from your phone (same LAN)."
fi
echo ""

uvicorn backend.app.main:app \
  --reload \
  --host "$CHORE_BIND" \
  --port "$CHORE_PORT" \
  --app-dir "$repo_root" &
backend_pid="$!"

cd "$frontend_dir"
npm install
vite_args=(--host "$VITE_HOST" --port "$VITE_PORT")
if [[ "$strict_port" == "1" ]]; then
  vite_args+=(--strictPort)
fi
npm run dev -- "${vite_args[@]}"
