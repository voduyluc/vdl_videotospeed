#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
nvidia-smi
ffmpeg -version | head -n 1
export HF_HOME="$ROOT/models/huggingface"
.venv-tts/bin/python -c 'import torch; print("Torch:", torch.__version__, "CUDA:", torch.version.cuda); assert torch.cuda.is_available(); print(torch.cuda.get_device_name()); x=torch.ones(1024,device="cuda"); print("CUDA tensor:", x.sum().item())'
CUDA_LIBS="$(find "$ROOT/.venv-stt/lib" -type d \( -path '*/nvidia/cublas/lib' -o -path '*/nvidia/cudnn/lib' \) -print | paste -sd: -)"
export LD_LIBRARY_PATH="${CUDA_LIBS}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
.venv-stt/bin/python -c 'import ctranslate2; print("CTranslate2:", ctranslate2.__version__); print("GPU types:", ctranslate2.get_supported_compute_types("cuda"))'
test -x vendor/llama.cpp/build/bin/llama-server
test -s models/Qwen3-8B-Q4_K_M.gguf
echo 'Basic GPU/runtime checks passed. A real short-video job is still required to validate all models.'
