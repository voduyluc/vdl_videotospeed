#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
# Discover pip-packaged CUDA libraries for CTranslate2 in the STT environment.
CUDA_LIBS="$(find "$ROOT/.venv-stt/lib" -type d \( -path '*/nvidia/cublas/lib' -o -path '*/nvidia/cudnn/lib' \) -print | paste -sd: -)"
export LD_LIBRARY_PATH="${CUDA_LIBS}:/usr/local/cuda-12.8/lib64${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export PYTHONUNBUFFERED=1
export HF_HOME="$ROOT/models/huggingface"
if [[ "${1:-}" == worker ]]; then
  exec "$ROOT/.venv/bin/python" -m app.runner
else
  exec "$ROOT/.venv/bin/python" -m app.serve
fi
