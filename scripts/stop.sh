#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
"${SUDO[@]}" systemctl stop "$SERVICE-web" "$SERVICE-worker"
