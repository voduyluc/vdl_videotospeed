#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_user
[[ -z "$(git status --porcelain --untracked-files=normal)" ]] || { echo 'Commit/stash local source changes before update.'; exit 1; }
git fetch
git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null
previous="$(git rev-parse HEAD)"
was_web="$(systemctl is-active "$SERVICE-web" || true)"
was_worker="$(systemctl is-active "$SERVICE-worker" || true)"
bash scripts/stop.sh
recover() {
  echo "Update failed. Previous source commit: $previous. Services remain stopped to avoid running inconsistent dependencies." >&2
  echo "Inspect the error, then retry update or restore that commit and run scripts/dependencies.sh, scripts/start.sh." >&2
}
trap recover ERR
git pull --ff-only
bash scripts/dependencies.sh
bash scripts/build-llama.sh
.venv/bin/python -m unittest discover -s tests -v
if [[ "$was_worker" == active || "$was_web" == active ]]; then bash scripts/start.sh; fi
trap - ERR
echo 'Source updated; existing data, models and .env retained.'
