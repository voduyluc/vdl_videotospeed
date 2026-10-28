#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
for env in .venv .venv-stt .venv-tts; do
  [[ -x "$env/bin/python" ]] || python3 -m venv "$env"
  "$env/bin/python" -m pip install --upgrade 'pip==25.1.1'
done
.venv/bin/python -m pip install -r requirements.txt
.venv-stt/bin/python -m pip install -r requirements.txt -r requirements-stt.txt \
  'nvidia-cublas-cu12==12.8.4.1' 'nvidia-cudnn-cu12==9.10.2.21'
.venv-tts/bin/python -m pip install 'torch==2.8.0' 'torchaudio==2.8.0' --index-url https://download.pytorch.org/whl/cu128
.venv-tts/bin/python -m pip install -r requirements.txt -r requirements-tts.txt
# Fail installation rather than discovering dependency conflicts during a film.
for env in .venv .venv-stt .venv-tts; do "$env/bin/python" -m pip check; done
