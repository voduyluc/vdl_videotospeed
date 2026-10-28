#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
export PATH="/usr/local/cuda-12.8/bin:$PATH"
command -v nvcc >/dev/null || { echo 'CUDA toolkit 12.8+ required. Run install.sh --install-cuda-toolkit'; exit 1; }
mkdir -p vendor
# Pin the runtime tag; app updates do not silently change the inference engine.
LLAMA_REF="${LLAMA_REF:-b6650}"
if [[ ! -d vendor/llama.cpp/.git ]]; then
  git clone --depth 1 --branch "$LLAMA_REF" https://github.com/ggml-org/llama.cpp.git vendor/llama.cpp
fi
cmake -S vendor/llama.cpp -B vendor/llama.cpp/build -DGGML_CUDA=ON \
  -DCMAKE_CUDA_ARCHITECTURES=120 -DCMAKE_BUILD_TYPE=Release -DLLAMA_CURL=OFF
cmake --build vendor/llama.cpp/build --target llama-server -j "${BUILD_JOBS:-2}"
