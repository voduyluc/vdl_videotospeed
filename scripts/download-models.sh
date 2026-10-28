#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
export HF_HOME="$ROOT/models/huggingface"
.venv-tts/bin/python -m app.download_models
