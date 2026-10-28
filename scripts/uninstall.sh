#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_user
"${SUDO[@]}" systemctl disable --now "$SERVICE-web" "$SERVICE-worker" || true
"${SUDO[@]}" rm -f /etc/systemd/system/vietvoice-web.service /etc/systemd/system/vietvoice-worker.service
"${SUDO[@]}" systemctl daemon-reload
# Source, videos, database, models and configuration are deliberately retained.
for name in .venv .venv-stt .venv-tts; do
  target="$(realpath -m -- "$ROOT/$name")"
  [[ "$target" == "$ROOT/$name" && ! -L "$ROOT/$name" ]] || { echo "Unsafe environment path: $target"; exit 1; }
  rm -rf -- "$target"
done
echo 'Services and Python environments removed. Source, .env, data/ and models/ retained.'
