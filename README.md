# Viet Voice Studio

Web app cá nhân tạo audio thuyết minh tiếng Việt từ video tiếng **Hàn (`ko`)**, **Anh (`en`)**, hoặc **Nhật (`ja`)**, chạy model local trên **Ubuntu 24.04.4 LTS x86_64 / NVIDIA RTX 5060 8 GB**.

Pipeline: FFmpeg (tách STT & background stereo) → faster-whisper large-v3 INT8 → Qwen3-8B Q4_K_M dịch sang tiếng Việt → duyệt bản dịch → VieNeu-TTS v3 Turbo (giọng preset hoặc giọng clone) → căn timeline → xuất WAV/MP3 thuyết minh → phối âm nền (sidechain ducking) → xuất bản mixed WAV/MP3.

### Tính năng mới nổi bật:
- 🌐 **Hỗ trợ đa ngôn ngữ video nguồn**: Hàn (`ko` - mặc định), Anh (`en`), Nhật (`ja`). Đầu ra luôn là thuyết minh tiếng Việt chuẩn xác theo ngữ cảnh.
- 🎙️ **Thư viện Voice Cloning cá nhân**: Tải lên mẫu giọng ngắn (khuyến nghị 3–8 giây sạch, 1 người nói), tạo câu nghe thử và chọn giọng clone đọc thuyết minh cho toàn bộ video. Tích hợp trực tiếp qua VieNeu-TTS local.
- 🎚️ **Giữ âm thanh gốc làm nền & Sidechain Ducking**: Giữ toàn bộ âm thanh nền gốc stereo (nhạc, hiệu ứng, môi trường), tự động hạ âm lượng nền mượt mà khi giọng thuyết minh phát lên và nâng nền khi thuyết minh ngừng. Cho phép tùy chỉnh âm lượng nền/thuyết minh, độ nén ducking, nghe thử 15s và phối âm lại (Remix) tức thì không cần chạy lại STT/Dịch/TTS.
- ⚡ **Ép thời lượng khi dịch & Thu gọn câu bằng LLM (AI Condensation)**:
  - *Cách 1 (Ép thời lượng khi dịch)*: Tự động tính toán số từ tối đa (`max_words`) cho từng câu theo số giây nói và yêu cầu LLM dịch cô đọng ngay từ đầu (mặc định bật).
  - *Cách 2 (AI thu gọn câu dài)*: Nút **🤖 AI thu gọn câu dài** tại màn hình duyệt cho phép dùng LLM viết lại các câu vượt thời lượng thật súc tích, giữ trọn ý chính và danh từ/hành động quan trọng, hoặc thu gọn từng câu đơn lẻ.
- 🌐 **Ngôn ngữ hiển thị giao diện (UI)**: Chuyển đổi linh hoạt giữa Tiếng Việt và Tiếng Anh ngay góc trên thanh điều hướng, tự động lưu lựa chọn vào `localStorage`.

## Cài đặt trên server

Yêu cầu: Ubuntu 24.04 LTS (bao gồm 24.04.4), Python 3.12 mặc định của hệ điều hành, tài khoản thường có sudo, NVIDIA driver hoạt động với RTX 5060 và CUDA 12.8. Chạy `nvidia-smi` trước. Installer **không cài hoặc thay driver NVIDIA**. Nên có RAM 32 GB, ổ SSD còn ít nhất 40 GB cho môi trường/model, cộng dung lượng video và audio. Lần đầu cần Internet để tải package và model.

Installer kiểm tra `VERSION_ID=24.04` trong `/etc/os-release` vì các bản cập nhật 24.04.x dùng chung giá trị này. CUDA toolkit được cài từ repository NVIDIA dành cho `ubuntu2404`. CI dùng Ubuntu 24.04 / Python 3.12.

Clone repository vào thư mục do tài khoản của bạn sở hữu, đường dẫn không có khoảng trắng hoặc ký tự `%`:

```bash
git clone <URL_REPOSITORY_CUA_BAN> ~/vdl_videotospeed
cd ~/vdl_videotospeed
bash scripts/install.sh --install-cuda-toolkit
```

Nếu đã có `nvcc` CUDA 12.8+ trong PATH, có thể dùng `bash scripts/install.sh`. Cờ `--install-cuda-toolkit` thêm repository chính thức NVIDIA và cài `cuda-toolkit-12-8`; không dùng gói driver/metapackage `cuda`.

Installer cài FFmpeg/build tools, ba Python venv, PyTorch CUDA 12.8, VieNeu, build llama-server cho kiến trúc CUDA 120, tải Qwen GGUF và warm-up VieNeu CPU. Whisper và asset riêng của VieNeu GPU được tải ở lần chạy đầu. Lỗi tải model có thể thử lại bằng `bash scripts/download-models.sh`. Không chạy installer bằng `sudo`; script tự dùng sudo cho apt/systemd.

Mật khẩu được tạo tự động, in một lần và lưu trong `.env` (quyền 600). Tên đăng nhập: **admin**. Web mặc định ở `127.0.0.1:8080`.

Từ máy cá nhân, tạo tunnel:

```bash
ssh -L 8080:127.0.0.1:8080 user@server
```

Sau đó mở <http://localhost:8080>. Nếu phục vụ qua domain, đặt reverse proxy HTTPS trước web; tăng giới hạn upload và timeout cho video lớn. HTTP Basic cần HTTPS khi truy cập qua mạng. Không mở port công khai chỉ bằng cách đổi HOST nếu chưa cấu hình lớp HTTPS.

## Quản lý dịch vụ

```bash
bash scripts/start.sh       # Khởi động web và worker
bash scripts/stop.sh        # Dừng; giữ checkpoint
bash scripts/status.sh      # Xem trạng thái
bash scripts/doctor.sh      # Kiểm tra driver, Torch CUDA, CTranslate2, GGUF
bash scripts/update.sh      # Fetch, pull --ff-only, cập nhật dependency, test, restart
bash scripts/uninstall.sh   # Gỡ service và venv; giữ source, .env, data, models
```

Hai service `vietvoice-web` và `vietvoice-worker` tự khởi động cùng server, chạy bằng tài khoản cài đặt. Chỉ cài một instance trên mỗi máy. Không di chuyển thư mục sau khi cài; nếu cần di chuyển, gỡ service rồi cài lại tại vị trí mới.

```bash
journalctl -u vietvoice-web -u vietvoice-worker -f
```

Log từng stage nằm tại `data/<project-id>/<stage>.log`. Khi update, phải commit/stash thay đổi source; `.env`, data/model/venv được gitignore. Nếu update thất bại sau khi dừng service, script để dịch vụ dừng và in commit cũ để bạn xử lý dependency/source trước khi start lại. Update không tự đổi phiên bản model hoặc nâng driver. Source mới chỉ được pull từ upstream branch đang tracking.

Uninstall không gỡ CUDA, driver hoặc apt package dùng chung; không xóa video/model/database. Có thể xóa thủ công các thư mục dữ liệu sau khi đã sao lưu nếu không còn cần.

## Cách sử dụng

1. **Upload video & chọn ngôn ngữ nguồn**: Chọn file video và chọn ngôn ngữ nguồn (**Hàn**, **Anh**, hoặc **Nhật**). Mặc định là tiếng Hàn.
2. **Theo dõi hàng đợi**: Pipeline tự động tách audio STT 16kHz mono và audio nền gốc 48kHz stereo, sau đó chạy STT bằng faster-whisper và dịch bằng LLM Qwen3-8B.
3. **Quản lý Giọng Clone**: Nhấp nút **🎙️ Giọng Clone** ở thanh trên cùng để upload mẫu giọng ngắn (3-8s WAV/MP3), tạo câu nghe thử và lưu vào thư viện.
4. **Ở trạng thái Chờ duyệt**:
   - Sửa bản dịch, nhấn timestamp để nghe lại audio gốc.
   - Chọn giọng thuyết minh: Có thể chọn giọng mẫu preset VieNeu hoặc bất kỳ giọng clone nào đã tạo.
   - Nhấn **Lưu & tạo audio** để tiến hành tổng hợp giọng nói.
5. **Căn timeline & Phối âm nền (Ducking)**:
   - Hệ thống tự động căn chỉnh khoảng lặng và xuất `narration.wav/mp3` cùng phụ đề nguồn (`ko.srt`/`en.srt`/`ja.srt`) và `vi.srt`.
   - Tiến hành bước **Phối âm nền** tự động áp dụng sidechain ducking để tạo `mixed.wav/mp3`.
   - Có thể tinh chỉnh âm lượng nền, âm lượng thuyết minh, độ nén ducking, nghe thử 15 giây preview và bấm **Phối âm lại** ngay lập tức mà không cần chạy lại các bước trước.
6. **Tải file kết quả**: Tải bản thuyết minh thuần (`narration.wav/mp3`) hoặc bản phối hoàn chỉnh (`mixed.wav/mp3`), kèm theo phụ đề song ngữ.

Nút **Nghe thử** bên cạnh mỗi câu phát audio TTS đã tạo cho câu đó; bấm **Dừng** để ngắt. Nếu chưa có audio hoặc bản dịch/giọng đã thay đổi, cần tạo lại trước khi nghe. Chỉ phát một đoạn nghe thử tại một thời điểm.

Audio xuất có timeline bắt đầu từ 0, gồm khoảng lặng và lời Việt. Hệ thống sử dụng khoảng trống trước câu kế tiếp và tăng tốc tối đa `MAX_SPEED`, mặc định 1.18. Không cắt lời để ép vừa thời gian. Nếu vẫn tràn, không xuất bản audio bị lệch; hiện cần sửa thủ công, chưa có vòng LLM tự rút gọn.

Browser preview dùng video gốc. MP4 H.264/AAC tương thích phổ biến; MKV/HEVC hoặc codec trình duyệt không hỗ trợ vẫn có thể xử lý audio nhưng cần chuyển video sang MP4 để xem trực tiếp. Không xuất video ghép, không tách nhạc nền, không nhận diện người nói hay clone giọng trong MVP.

## Cấu hình

Sửa `.env`, sau đó `bash scripts/stop.sh && bash scripts/start.sh`.

| Biến | Ý nghĩa |
| --- | --- |
| `APP_PASSWORD` | Mật khẩu HTTP Basic của tài khoản admin; không để trống |
| `HOST`, `PORT` | Bind web; mặc định 0.0.0.0:8080 (hoặc 127.0.0.1 nếu chỉ dùng SSH tunnel) |
| `DATA_DIR` | Vị trí SQLite và dữ liệu video; đường dẫn tương đối tính từ thư mục repo |
| `MAX_UPLOAD_GB` | Giới hạn dung lượng từng file được lưu, mặc định 12 GB |
| `WHISPER_MODEL` | Mặc định large-v3; có thể thử model nhỏ hơn khi thiếu VRAM |
| `WHISPER_DEVICE`, `WHISPER_COMPUTE` | Mặc định cuda / int8_float16 |
| `STT_CHUNK_SECONDS` | Khối checkpoint STT, mặc định 300 giây |
| `LLAMA_MODEL`, `LLAMA_BIN` | Đường dẫn GGUF và llama-server |
| `LLAMA_CONTEXT` | Context dịch, mặc định 4096 token |
| `TTS_VOICE` | Giọng preset cho project mới |
| `MAX_SPEED` | Tốc độ tối đa khi fit timeline, 1–2; nên giữ gần 1 |
| `QUEUE_MODE` | `file` hoặc `stage` |

`file`: video cũ nhất được ưu tiên qua các bước; khi chờ duyệt, chuyển sang video tiếp theo.

`stage`: ưu tiên extract → STT → dịch → TTS → export. Các project đang sẵn sàng ở cùng stage được chụp thành một đợt tối đa 32 project; **dùng chung một lần nạp model**. Video vẫn được xử lý tuần tự. Hủy một job trong đợt sẽ ngắt process của đợt; các job khác tiếp tục từ checkpoint ở lượt sau, các job đã hoàn thành giữ nguyên trạng thái. Mỗi thời điểm chỉ một process model sở hữu GPU. Chế độ này thiên về throughput; dùng `file` nếu muốn có kết quả từng video sớm.

Trong phiên bản đầu, TTS batch size là 1 để giảm rủi ro VRAM. Việc giữ model trong cả stage/đợt vẫn tránh nạp lại cho từng câu hoặc video. Không bảo đảm thời gian xử lý trước khi benchmark trên GPU thực tế.

Có thể thêm thuật ngữ cho một project bằng file UTF-8 `data/<id>/glossary.txt` trước bước dịch. Nội dung này đi vào prompt cùng ba câu trước đó. Các bản dịch đã có được giữ khi retry.

STT cắt cửa sổ 5 phút không chồng lấn để checkpoint đơn giản và không trùng thoại; câu nằm đúng biên có thể nhận dạng kém, cần kiểm tra khi duyệt. Timestamp lấy từ Whisper, chưa dùng forced alignment. Dịch theo nhóm 8 câu, kiểm tra ID, retry tối đa ba lần và lưu từng nhóm. Không tự gộp/tách câu; editor/API giữ nguyên ID/thứ tự.

## Kiến trúc source

```text
app/main.py           API, upload, editor, tải file, authentication
app/runner.py         SQLite queue, GPU độc quyền, cancel/restart
app/batch.py          Chạy nhiều project cùng stage với model dùng chung
app/model_worker.py   faster-whisper và VieNeu SDK trong process riêng
app/translate.py      Quản lý llama-server local, dịch JSON và checkpoint
app/media.py          FFmpeg, streaming WAV, fit timeline và cảnh báo
web/                  Giao diện HTML/CSS/JavaScript, không cần Node hoặc CDN
scripts/              Cài đặt và quản lý systemd Ubuntu
tests/                API, retry/cache, phụ đề và ghép audio FFmpeg
```

Giao diện dùng JavaScript thuần để giảm dependency/build cho ứng dụng cá nhân. Backend API tách biệt nên có thể thay bằng React sau này.

SQLite WAL lưu trạng thái; JSON được ghi atomic bằng temporary file rồi rename. STT có checkpoint từng khối; TTS cache SHA-256 theo text + giọng + phiên bản model. Sửa bản dịch làm mất hiệu lực export cũ. Mỗi stage ở process riêng; khi thoát, tài nguyên GPU được giải phóng. Worker dùng file lock để ngăn hai runner cùng xử lý database. Dừng dịch vụ ngắt cả process group gồm llama-server.

## Kiểm thử

```bash
.venv/bin/python -m unittest discover -s tests -v
bash scripts/doctor.sh
```

Test dùng database tạm riêng, không chạy model thật hoặc thay đổi dữ liệu dự án. Kiểm thử media chạy FFmpeg thật nếu có trên PATH. Có thể dùng `FFMPEG_BIN=/path/to/ffmpeg` cho kiểm thử. Syntax Python/Bash/JavaScript và API/cache/timeline được kiểm tra trong môi trường phát triển; **cài đặt systemd Ubuntu và toàn pipeline GPU chưa được xác minh trên server thật**. Sau cài đặt, chạy một video vài phút trước, rồi benchmark video 60–90 phút và đo VRAM bằng `nvidia-smi`.

Sao lưu `.env`, toàn bộ `DATA_DIR` và model/config cần giữ khi đã dừng worker. Không sửa/xóa JSON/checkpoint trong lúc job đang chạy. Đổi model STT trên project đã có checkpoint cần tạo project mới để tránh trộn kết quả hai model.

## Nguồn model và runtime

- [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
- [Qwen3-8B GGUF](https://huggingface.co/Qwen/Qwen3-8B-GGUF)
- [llama.cpp](https://github.com/ggml-org/llama.cpp), runtime mặc định pin tag b6650
- [VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS), dùng SDK 3.8.3 / v3 Turbo local
- [NVIDIA CUDA Linux installation](https://docs.nvidia.com/cuda/cuda-installation-guide-linux/)

Model/dependency giữ giấy phép upstream tương ứng. VieNeu là dependency cài trong môi trường TTS của dự án; không gọi dịch vụ TTS bên ngoài.
