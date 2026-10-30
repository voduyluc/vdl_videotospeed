# Third-party notices

Viet Voice Studio sử dụng các dự án và model dưới đây. Copyright của từng thành phần thuộc tác giả tương ứng; LICENSE MIT ở repository này chỉ áp dụng cho mã nguồn do Viet Voice Studio cung cấp.

| Thành phần | Nguồn và giấy phép |
| --- | --- |
| faster-whisper | [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper), [LICENSE](https://github.com/SYSTRAN/faster-whisper/blob/master/LICENSE) |
| Whisper / trọng số STT | [openai/whisper](https://github.com/openai/whisper), [LICENSE](https://github.com/openai/whisper/blob/main/LICENSE); kiểm tra thêm model card của bản trọng số được tải |
| Qwen3-8B GGUF | [Qwen/Qwen3-8B-GGUF](https://huggingface.co/Qwen/Qwen3-8B-GGUF), [Apache-2.0](https://huggingface.co/Qwen/Qwen3-8B-GGUF/blob/main/LICENSE) |
| llama.cpp | [ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp), [LICENSE](https://github.com/ggml-org/llama.cpp/blob/master/LICENSE) |
| VieNeu-TTS | [pnnbao97/VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS), [Apache-2.0](https://github.com/pnnbao97/VieNeu-TTS/blob/main/LICENSE); model, codec và tài sản giọng có điều kiện riêng theo nguồn tải |
| FFmpeg | [FFmpeg](https://ffmpeg.org/), [thông tin giấy phép](https://ffmpeg.org/legal.html); LGPL/GPL tùy cấu hình build |
| FastAPI | [fastapi/fastapi](https://github.com/fastapi/fastapi), [LICENSE](https://github.com/fastapi/fastapi/blob/master/LICENSE) |
| PyTorch | [pytorch/pytorch](https://github.com/pytorch/pytorch), [LICENSE](https://github.com/pytorch/pytorch/blob/main/LICENSE) |

Đây là ghi nhận các thành phần chính, không phải danh sách đầy đủ mọi dependency chuyển tiếp. Những package khác và NVIDIA CUDA tuân theo điều kiện của nhà cung cấp tương ứng.

Repository không đóng gói sẵn model weights, CUDA hoặc FFmpeg binary; script cài đặt tải/cài chúng từ nguồn riêng. Nếu phân phối thêm binary, model hoặc asset, giữ thông báo bản quyền và tuân thủ giấy phép của đúng phiên bản được phân phối. Không coi LICENSE MIT của ứng dụng là giấy phép thay thế cho các thành phần này.
