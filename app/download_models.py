"""Preload model assets using the actual runtime APIs, not guessed repository files."""
import os

from app.core import ROOT

if __name__ == '__main__':
    from huggingface_hub import hf_hub_download
    target = ROOT / 'models'
    target.mkdir(exist_ok=True)
    model = hf_hub_download('Qwen/Qwen3-8B-GGUF', 'Qwen3-8B-Q4_K_M.gguf', local_dir=target)
    print(f'Translation model: {model}')
    # ONNX CPU warm-up downloads default VieNeu assets without reserving GPU.
    from vieneu import Vieneu
    tts = Vieneu(mode='v3turbo', backend='onnx')
    tts.infer('Xin chào.', voice=os.getenv('TTS_VOICE', 'Hải Đăng'))
    print('VieNeu CPU assets cached. GPU-specific assets and Whisper download on first use.')
