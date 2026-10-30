# Viet Voice Studio

Web app tạo thuyết minh tiếng Việt từ video **tiếng Hàn, Anh, Nhật và Trung**. Nhận dạng, dịch và tạo giọng chạy local; cần Internet để cài thư viện và tải model lần đầu.

```text
Video → Nhận dạng lời thoại → Dịch / tham chiếu SRT → Tạo giọng Việt → Phối âm → Ghép video
```

## Tính năng

- Upload video, xếp hàng và kéo thả đổi thứ tự xử lý.
- Sửa bản dịch, nghe từng câu, dùng AI thu gọn câu dài và căn thời lượng.
- Chọn giọng có sẵn hoặc clone từ mẫu giọng sạch khoảng 3–8 giây; quản lý thư viện giọng và nghe thử.
- Chế độ nhiều giọng nam/nữ dựa trên ước lượng đặc tính âm thanh; có thể sửa lựa chọn từng câu.
- Giữ âm thanh gốc stereo làm nền, tự hạ nền khi có thuyết minh (ducking); chỉnh âm lượng và phối âm lại.
- Xuất WAV/MP3, phụ đề SRT và video MP4 có thuyết minh; lưu lịch sử phiên bản.
- Giao diện Việt/Anh, xem tài nguyên máy và tiếp tục xử lý từ checkpoint sau lỗi.

### Hai cách dùng SRT có sẵn

| Chế độ | Khi nào dùng | Cách xử lý |
| --- | --- | --- |
| **Dùng trực tiếp** | SRT đã khớp video | Lấy timeline SRT, bỏ qua STT; có bản Việt thì dùng bản dịch có sẵn |
| **Tham chiếu nội dung** | SRT bị lệch thời gian hoặc khác cách chia câu | Luôn chạy STT lấy timeline video; dùng SRT nguồn để hiệu chỉnh text, SRT Việt để lấy bản dịch khớp; tự dịch phần thiếu |

Chế độ tham chiếu dùng lại Qwen, không cần model mới. Có nhãn và bộ lọc **SRT cần kiểm tra**, giữ bản STT gốc và thông tin câu tham chiếu. Không bảo đảm khớp hết phụ đề khác bản dựng. Mỗi file SRT tối đa 5 MB.

## Cấu hình máy

Mức tối thiểu **đề xuất để bắt đầu** với bộ model mặc định, chưa phải kết quả benchmark tối thiểu trên mọi phần cứng:

| Thành phần | Tối thiểu đề xuất | Khuyến nghị cho video 60–90 phút |
| --- | --- | --- |
| Hệ điều hành | Ubuntu 24.04 LTS x86_64, gồm 24.04.4 | Ubuntu 24.04.4 LTS |
| CPU | 4 nhân x86_64 | 6–8 nhân |
| RAM | 16 GB | 32 GB |
| GPU | NVIDIA RTX 5060, 8 GB VRAM | 8 GB trở lên, tương thích cấu hình build |
| Ổ đĩa | Khoảng 50 GB SSD trống cho cài đặt/model, **cộng dung lượng media** | 100 GB trở lên; tăng theo số video và phiên bản lưu |
| Runtime | Python 3.12, NVIDIA driver tương thích CUDA 12.8 | Kiểm tra bằng `scripts/doctor.sh` |

Script build GPU hiện cố định kiến trúc **Blackwell `sm_120`** cho RTX 5060. GPU khác cần điều chỉnh `CMAKE_CUDA_ARCHITECTURES` trong `scripts/build-llama.sh`; không phải mọi card 8 GB đều dùng nguyên script được. Bản cài mặc định yêu cầu GPU NVIDIA; chưa cung cấp bộ cài CPU-only.

Mỗi thời điểm chỉ một model dùng GPU. Video dài được xử lý theo đoạn; thời gian chạy và dung lượng thực tế phụ thuộc nội dung, cấu hình và số phiên bản lưu.

## Cài đặt

Cài NVIDIA driver trước và kiểm tra `nvidia-smi`. Chạy bằng tài khoản thường có quyền sudo, tại đường dẫn không có khoảng trắng hoặc ký tự `%`:

```bash
git clone https://github.com/voduyluc/vdl_videotospeed.git
cd vdl_videotospeed
bash scripts/install.sh --install-cuda-toolkit
```

Installer cài dependency, CUDA Toolkit 12.8, build llama.cpp, tải model và tạo hai service systemd. **Không cài hoặc đổi NVIDIA driver.** Nếu đã có CUDA Toolkit phù hợp, dùng `bash scripts/install.sh`.

Web chạy ở port **8080**. Đăng nhập bằng **admin** và mật khẩu installer tạo, lưu trong `.env`. Cấu hình mẫu hiện bind `0.0.0.0`; để chỉ truy cập qua SSH tunnel, đổi `HOST=127.0.0.1` trong `.env` rồi restart:

```bash
bash scripts/stop.sh
bash scripts/start.sh
# Chạy lệnh sau trên máy cá nhân:
ssh -L 8080:127.0.0.1:8080 user@server
```

Mở <http://localhost:8080>. Nếu truy cập qua domain/mạng công cộng, đặt reverse proxy HTTPS và cấu hình giới hạn upload phù hợp cho video lớn.

## Sử dụng

1. Thêm video, chọn ngôn ngữ nguồn, giọng đọc và SRT nếu có. Hệ thống lấy track audio đầu tiên.
2. Chờ STT và dịch. Có thể bật/tắt dừng để duyệt bản dịch.
3. Kiểm tra câu dịch, đoạn SRT chưa khớp và câu quá dài; nghe thử, sửa hoặc dùng AI thu gọn.
4. Tạo audio, nghe bản phối, chỉnh nền rồi ghép video nếu cần.
5. Tải file trong phần kết quả và lịch sử phiên bản.

Kết quả gồm `narration.wav/mp3` (chỉ lời Việt), `mixed.wav/mp3` (có nền), `vi.srt`, phụ đề nguồn `ko/en/ja/zh.srt` và `dubbed_video.mp4` nếu bật ghép video.

## Quản lý

```bash
bash scripts/start.sh       # Khởi động
bash scripts/stop.sh        # Dừng, giữ checkpoint
bash scripts/status.sh      # Trạng thái service
bash scripts/doctor.sh      # Kiểm tra GPU/runtime
bash scripts/update.sh      # Pull source, cập nhật dependency, test và restart
bash scripts/uninstall.sh   # Gỡ service/venv; giữ source, cấu hình, model và dữ liệu
```

Service: `vietvoice-web` và `vietvoice-worker`. Xem log:

```bash
journalctl -u vietvoice-web -u vietvoice-worker -f
```

Sửa cấu hình trong `.env`, sau đó stop/start. Các biến thường dùng: `HOST`, `PORT`, `DATA_DIR`, `APP_PASSWORD`, `MAX_UPLOAD_GB`, `LLAMA_CONTEXT` và `QUEUE_MODE` (`file`: ưu tiên từng video; `stage`: gom theo bước để tái sử dụng model).

Dữ liệu nằm trong `data/`, model trong `models/`. Sao lưu dữ liệu và `.env` khi đã dừng worker. `.env`, model, media và môi trường Python được gitignore. Khi update, cần commit/stash thay đổi source; nếu update lỗi, kiểm tra thông báo trước khi start lại.

## Giới hạn và kiểm thử

- Chất lượng STT, dịch, matching và clone phụ thuộc đầu vào; cần duyệt kết quả trước khi sử dụng.
- Nền vẫn chứa lời thoại gốc ở âm lượng nhỏ; ứng dụng không tách riêng lời thoại khỏi nhạc/hiệu ứng.
- Chế độ tự fit có thể tăng tốc hoặc cắt đuôi câu dài. Dùng thu gọn và nghe lại để tránh mất ý.
- Ước lượng nam/nữ không phải nhận diện chính xác từng nhân vật. Clone giọng không bảo đảm giống hoàn toàn mẫu.
- Video không có audio/lời nói cần SRT dùng trực tiếp. Preview trong trình duyệt còn tùy codec video.
- Chưa xác nhận toàn bộ pipeline trên mọi GPU. Nên thử video ngắn trước khi chạy phim dài.

Chạy test local (không dùng GitHub Actions):

```bash
.venv/bin/python -m unittest discover -s tests -v
```

Test model dùng mock; test media chạy FFmpeg thật nếu có. Lần kiểm tra phát triển gần nhất: 69/70 test đạt; test thời lượng phối âm `test_mix_creates_mixed_audio_files` còn lỗi có sẵn, cần kiểm tra trên môi trường triển khai. Test không thay thế việc đánh giá chất lượng model trên video thực tế.

## Công nghệ và bản quyền

FastAPI, SQLite, FFmpeg, faster-whisper/Whisper large-v3, Qwen3-8B GGUF Q4_K_M qua llama.cpp và VieNeu-TTS v3 Turbo local. Giao diện JavaScript thuần, không cần Node để chạy ứng dụng.

Mã nguồn do dự án cung cấp theo **[MIT License](LICENSE)**. Copyright © 2026 **voduyluc**. Có thể sử dụng, sửa đổi và phân phối theo điều kiện trong LICENSE.

Model, thư viện, giọng mẫu và tài sản bên thứ ba giữ giấy phép riêng; xem **[Third-party notices](THIRD_PARTY_NOTICES.md)**. Giấy phép mã nguồn không cấp quyền đối với video, phụ đề, âm nhạc hoặc giọng nói của người khác. Chỉ sử dụng nội dung và mẫu giọng bạn có quyền sử dụng.
