#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
SERVICE=vietvoice
if [[ $EUID -eq 0 ]]; then SUDO=(); else SUDO=(sudo); fi
require_user() {
  if [[ $EUID -eq 0 ]]; then echo 'Run as your normal Ubuntu user; the script uses sudo when needed.' >&2; exit 1; fi
}
