#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
"${SUDO[@]}" systemctl --no-pager --full status "$SERVICE-worker" "$SERVICE-web"
