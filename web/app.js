const $ = s => document.querySelector(s);
let selected = null, current = null, dirty = false, page = 0, busy = false, filterWarnings = false;
function countWords(s){ return (s||'').trim().split(/\s+/).filter(Boolean).length; }
const drafts = new Map();
let previewAudio = null, previewUrl = null, previewButton = null, previewRequest = 0;

let currentLang = localStorage.getItem('vietvoice_ui_lang') || 'vi';

const I18N = {
  vi: {
    headerSubtitle: "Video tiếng Hàn, Anh, Nhật → thuyết minh tiếng Việt · Local GPU",
    voiceLibTitle: "Quản lý giọng nhân bản (Voice Cloning)",
    voiceLibBtn: "🎙️ Giọng Clone",
    usageBtnTitle: "Xem thống kê tài nguyên (VRAM, CPU, RAM, Ổ đĩa)",
    usageBtn: "📊 Tài nguyên / Usage",
    closeTitle: "Đóng",
    closeBtn: "Đóng",
    refreshTitle: "Làm mới",
    uploadTitle: "Thêm video",
    uploadDesc: "Hỗ trợ video tiếng Hàn, Anh hoặc Nhật. Hệ thống sử dụng track audio đầu tiên.",
    sourceLangLabel: "Ngôn ngữ video nguồn:",
    langKo: "🇰🇷 Tiếng Hàn (Korean)",
    langEn: "🇺🇸 Tiếng Anh (English)",
    langJa: "🇯🇵 Tiếng Nhật (Japanese)",
    advancedOptions: "⚙️ Tùy chọn nâng cao",
    voiceLabel: "Giọng đọc:",
    pauseReviewTitle: "Dừng lại sau khi dịch để kiểm tra và chỉnh sửa trước khi tổng hợp giọng",
    pauseReviewLabel: "Dừng để duyệt bản dịch",
    pauseReviewHint: "Bỏ chọn nếu muốn chạy tự động từ đầu đến cuối.",
    fitDurationTitle: "Ép độ dài bản dịch không vượt quá thời lượng nói của từng câu",
    fitDurationLabel: "Ép thời lượng khi dịch (AI dịch cô đọng)",
    fitDurationHint: "Giới hạn số từ của bản dịch vừa khít thời lượng nói của từng câu.",
    fitDurationShort: "Ép thời lượng khi dịch",
    toastFitDurationOn: "Đã bật: AI sẽ ép thời lượng dịch cô đọng cho từng câu",
    toastFitDurationOff: "Đã tắt: Chế độ dịch tự nhiên không ép thời lượng",
    autoFitTitle: "Tự động nén tốc độ âm thanh và cắt nhẹ đuôi để vừa khít thời lượng",
    autoFitLabel: "Tự nén âm thanh vừa thời gian",
    autoFitHint: "Tự nén tốc độ để vừa khung thời gian, tránh lỗi.",
    addToQueueBtn: "Thêm vào hàng đợi",
    projectsTitle: "Dự án",
    deleteProjectTitle: "Xóa dự án và dọn sạch file",
    emptyTitle: "Từ lời thoại đến giọng Việt",
    emptyDesc: "Tải video lên để bắt đầu. Nhận dạng → Dịch → Duyệt → Tạo giọng → Xuất audio.",
    status_queued: "Đang chờ",
    status_running: "Đang xử lý",
    status_review: "Chờ duyệt",
    status_failed: "Cần kiểm tra",
    status_completed: "Hoàn tất",
    status_cancelled: "Đã hủy",
    stepExtract: "1. Trích xuất",
    stepSTT: "2. Nhận dạng STT",
    stepTranslate: "3. Dịch thuật",
    stepTTS: "4. Tạo giọng TTS",
    stepExport: "5. Ghép lời thoại",
    stepMix: "6. Phối âm nền",
    descReview: "Dịch xong · Đang dừng để bạn duyệt bản dịch",
    descCompleted: "Hoàn tất toàn bộ tiến trình · Đã tạo xong file",
    descProcessing: "Đang xử lý: {0} {1} - {2}%",
    descPercentDone: "{0}% hoàn thành",
    dlHeader: "🎉 Tải Về Kết Quả (Audio & Phụ Đề)",
    dlCompleted: "Hoàn tất 100%",
    dlMixedPlayer: "Nghe thử bản phối hoàn chỉnh (Lời Việt + Nền gốc hạ âm):",
    dlNarrationPlayer: "Nghe thử bản thuyết minh đã ghép:",
    dlMixedMp3: "🌟 Tải Audio Phối Nền (MP3)",
    dlMixedMp3Desc: "Lời Việt nổi trên nền gốc tự động hạ (Ducking)",
    dlMixedWav: "🎙️ Tải Audio Phối Nền (WAV)",
    dlMixedWavDesc: "Âm thanh phối chuẩn phòng thu lossless",
    dlNarrMp3: "🎵 Tải Thuyết Minh Riêng (MP3)",
    dlNarrMp3Desc: "Chỉ có giọng đọc tiếng Việt",
    dlNarrWav: "🎙️ Tải Thuyết Minh Riêng (WAV)",
    dlNarrWavDesc: "Giọng đọc gốc chất lượng cao nhất",
    dlViSrt: "📝 Phụ đề Tiếng Việt (.SRT)",
    dlViSrtDesc: "Sub chuẩn khớp từng giây",
    dlSrcSrt: "🌐 Phụ đề {0} (.SRT)",
    dlSrcSrtDesc: "Sub gốc trích xuất từ video",
    dlGeneric: "⬇️ Tải {0}",
    dlAlertFailed: "<strong>⚠️ Chưa tạo được file Audio:</strong> Tiến trình đã dừng trước khi hoàn tất xuất file (có thể do lỗi thời lượng hoặc âm thanh). Hãy bật <b>\"Tự nén âm thanh vừa thời gian\"</b> ở dưới rồi bấm <b>\"Thử lại bước hiện tại\"</b> để tạo file.",
    retryStepBtn: "🔄 Thử lại bước hiện tại",
    mixHeader: "🎛️ Phối Âm Nền & Lời Thuyết Minh (Background & Ducking)",
    mixDuckingLabel: "Tự hạ nền khi có lời đọc (Ducking)",
    mixDuckingHint: "Tự động giảm âm nền khi có tiếng Việt, trả lại âm lượng khi ngừng.",
    mixBgLabel: "Âm lượng nền gốc:",
    mixNarrLabel: "Âm lượng thuyết minh:",
    mixAttenLabel: "Mức giảm nền (Ducking):",
    mixPreviewBtn: "🎧 Nghe thử mix (15s)",
    mixPreviewLoading: "Đang xử lý nghe thử...",
    mixRemixBtn: "🎛️ Phối lại âm thanh (Remix)",
    mixStarted: "Đã bắt đầu phối lại âm thanh nền!",
    mixSaveErr: "Lỗi lưu cài đặt mix: ",
    mixPreviewErr: "Không thể tạo nghe thử mix",
    mixRemixErr: "Lỗi remix: ",
    deleteProjectBtn: "🗑️ Xóa dự án",
    deleteProjectBtnTitle: "Xóa dự án và dọn sạch toàn bộ file",
    voiceLabelToolbar: "Giọng đọc: ",
    pauseReviewShort: "Dừng để duyệt",
    autoFitShort: "Tự nén âm thanh vừa thời gian",
    saveTranslationBtn: "Lưu bản dịch",
    saveGenerateBtn: "Lưu & tạo audio",
    cancelProcessBtn: "Hủy xử lý",
    segmentsCountMeta: "{0} · {1} đoạn · {2}",
    segmentHint: "Nhấn mốc thời gian để nghe lời gốc. Bấm \"Nghe thử\" để nghe âm thanh tiếng Việt. Viền cam: câu vượt thời lượng cần rút gọn.",
    tabAll: "Tất cả ({0})",
    tabWarning: "⚠️ Câu vượt thời lượng ({0})",
    tabAiCondense: "🤖 AI thu gọn câu dài ({0} câu)",
    tabAiCondenseTitle: "Dùng LLM thông minh viết lại các câu bị dài, giữ nguyên ý chính và không vượt quá số từ an toàn",
    aiCondensing: "Đang gửi yêu cầu AI...",
    toastAiCondenseQueued: "Đã đưa yêu cầu AI thu gọn câu vào hàng đợi GPU.",
    btnAiCondenseSeg: "🤖 AI thu gọn",
    btnAiCondenseSegTitle: "Dùng AI viết lại câu này cho vừa khít thời lượng",
    toastAiCondenseSegQueued: "Đã gửi yêu cầu AI thu gọn cho câu {0}.",
    tabAutoTrim: "✂️ Tự cắt từ cho đủ ({0} câu)",
    tabAutoTrimTitle: "Tự động cắt ngắn số từ của các câu bị dài về giới hạn an toàn",
    pageCounter: "Trang {0}/{1} ({2} câu)",
    emptyNoOverDuration: "🎉 Tuyệt vời! Không có câu nào vượt thời lượng.",
    emptyNoSegments: "Không có đoạn thoại nào.",
    autoTrimSuccess: "Đã tự động rút gọn {0} câu về độ dài an toàn. Bấm \"Lưu bản dịch\" để xác nhận!",
    autoTrimAllSafe: "Tất cả các câu đã nằm trong độ dài an toàn.",
    listenSnippet: "Nghe thử",
    stopSnippet: "Dừng",
    listenAria: "Nghe audio tiếng Việt {0}",
    transAria: "Bản dịch {0}",
    warnTitleSegment: "Câu vượt thời lượng (+{0}s). Hãy rút gọn số từ.",
    warnBadge: "⚠️ Vượt +{0}s",
    timingInfo: "Thực tế: <b>{0}s</b><br>Tối đa: {1}s",
    timingSafe: "{0}s",
    wordCountLabel: "Số từ: <b>{0}</b> / Tối đa: ~{1} từ",
    badgeExcess: "Vượt {0} từ",
    badgeOk: "Độ dài an toàn ✓",
    confirmDeleteRunning: "Dự án \"{0}\" ĐANG CHẠY. Bạn có chắc muốn DỪNG XỬ LÝ và XÓA SẠCH toàn bộ file?",
    confirmDeleteQueued: "Hủy và xóa \"{0}\" khỏi hàng đợi?",
    confirmDeleteNormal: "Xóa dự án \"{0}\" và xóa sạch toàn bộ file (video, audio...) để tránh rác dung lượng?",
    toastDeletedProject: "Đã xóa dự án \"{0}\" và dọn sạch file.",
    toastDeleteErr: "Lỗi xóa dự án: ",
    confirmDiscardChanges: "Bỏ các chỉnh sửa chưa lưu?",
    toastUnsavedSnippet: "Bản dịch hoặc giọng chưa lưu. Hãy lưu và tạo lại audio trước khi nghe thử.",
    toastCantLoadAudio: "Không thể tải audio.",
    toastSaved: "Đã lưu",
    toastVoiceChanged: "Đã đổi giọng đọc sang: ",
    toastPauseOn: "Đã bật: Sẽ dừng lại để bạn duyệt bản dịch",
    toastPauseOff: "Đã tắt: Sẽ tự động chạy từ đầu tới cuối",
    toastAutoFitOn: "Đã bật: Tự động nén âm thanh vừa thời gian",
    toastAutoFitOff: "Đã tắt: Chế độ kiểm tra nghiêm ngặt",
    toastSelectVideoFirst: "Chọn một video trước.",
    toastUploadSuccess: "Đã thêm video vào hàng đợi thành công!",
    toastUploadErr: "Upload lỗi: ",
    toastUploadNetErr: "Không thể upload. Kiểm tra kết nối.",
    voiceModalTitle: "🎙️ Thư Viện Giọng Nhân Bản (Voice Cloning)",
    addVoiceTitle: "Thêm Giọng Clone Mới",
    addVoiceDesc: "Tải lên đoạn audio mẫu <b>3–8 giây</b>, giọng một người nói rõ ràng, ít tiếng ồn và không lẫn nhạc nền để VieNeu nhân bản giọng tốt nhất.",
    voiceNamePlaceholder: "Đặt tên giọng (ví dụ: Giọng Thầy Giáo, Giọng Chị Lan...)",
    createVoiceBtn: "Tạo giọng clone",
    voiceListTitle: "Danh Sách Giọng Đã Nhân Bản",
    loadingVoices: "Đang tải danh sách giọng...",
    noClonedVoices: "Chưa có giọng clone nào. Hãy tải lên file audio mẫu (3–8 giây) ở trên để tạo giọng đầu tiên!",
    voiceMeta: "Độ dài mẫu: {0}s · Cập nhật: {1}",
    voicePlaySample: "▶ Nghe mẫu",
    voicePlayPreview: "🎧 Nghe thử câu",
    voiceGenPreview: "⚡ Tạo câu thử",
    voiceGenSending: "Đang gửi...",
    voiceGenSuccess: "Đã đưa yêu cầu tạo câu nghe thử cho giọng \"{0}\" vào hàng đợi GPU.",
    deleteVoiceTitle: "Xóa giọng clone này",
    confirmDeleteVoice: "Bạn có chắc muốn xóa giọng \"{0}\"?",
    toastDeletedVoice: "Đã xóa giọng \"{0}\".",
    toastCantDeleteVoice: "Không thể xóa: ",
    toastPromptVoiceName: "Vui lòng nhập tên cho giọng clone.",
    toastPromptVoiceFile: "Vui lòng chọn file âm thanh mẫu (3–8 giây).",
    voiceCreating: "Đang xử lý & chuẩn hóa...",
    toastVoiceCreated: "Đã tạo thành công giọng clone: \"{0}\" ({1}s)!",
    toastVoiceCreateErr: "Lỗi tạo giọng: ",
    usageModalTitle: "📊 Thống Kê Tài Nguyên Hệ Thống (Usage)",
    loadingUsage: "Đang tải thông số hệ thống...",
    usageGpuTitle: "🎮 GPU & VRAM",
    usageCpuTitle: "⚡ CPU & RAM",
    usageDiskTitle: "💾 Ổ Đĩa Tổng (Partition)",
    usageBreakdownTitle: "📁 Chi Tiết Ứng Dụng & Model",
    usageGpuModel: "Model:",
    usageVramUsed: "VRAM đã dùng:",
    usageGpuLoad: "Mức tải GPU Core:",
    usageNoGpu: "Không có GPU NVIDIA",
    usageCpuCores: "CPU ({0} cores):",
    usageRamSystem: "RAM (Hệ thống):",
    usageDiskUsedTotal: "Đã dùng / Tổng:",
    usageDiskFree: "Còn trống:",
    usageDiskFull: "{0}% đầy",
    usageBreakdownVideo: "🎬 Video & File Dự án (data/):",
    usageBreakdownModels: "🧠 AI Models (GGUF, Whisper, TTS):",
    usageBreakdownApp: "📦 App & Môi trường (.venv):",
    usageUpdatedAt: "Cập nhật lúc: {0}",
    usageLoadErr: "Lỗi khi tải thông số: ",
    grpTop: "⭐ Đề xuất hàng đầu",
    grpNorth: "🏙️ Miền Bắc",
    grpCentral: "🏖️ Miền Trung",
    grpSouth: "🌴 Miền Nam",
    grpClone: "🎙️ Giọng Clone Cá Nhân",
    grpOther: "Giọng khác",
    lang_ko: "Tiếng Hàn",
    lang_en: "Tiếng Anh",
    lang_ja: "Tiếng Nhật",
    badge_ko: "🇰🇷 Tiếng Hàn",
    badge_en: "🇺🇸 Tiếng Anh",
    badge_ja: "🇯🇵 Tiếng Nhật"
  },
  en: {
    headerSubtitle: "Korean, English, Japanese Video → Vietnamese Dubbing · Local GPU",
    voiceLibTitle: "Manage Cloned Voices (Voice Cloning)",
    voiceLibBtn: "🎙️ Cloned Voices",
    usageBtnTitle: "View System Resource Usage (VRAM, CPU, RAM, Disk)",
    usageBtn: "📊 System Usage",
    closeTitle: "Close",
    closeBtn: "Close",
    refreshTitle: "Refresh",
    uploadTitle: "Add Video",
    uploadDesc: "Supports Korean, English, or Japanese videos. Uses first audio track.",
    sourceLangLabel: "Source Video Language:",
    langKo: "🇰🇷 Korean",
    langEn: "🇺🇸 English",
    langJa: "🇯🇵 Japanese",
    advancedOptions: "⚙️ Advanced Options",
    voiceLabel: "Voice:",
    pauseReviewTitle: "Pause after translation to review and edit before voice synthesis",
    pauseReviewLabel: "Pause to review translation",
    pauseReviewHint: "Uncheck to run automatically from start to finish.",
    fitDurationTitle: "Limit translation length to fit spoken duration of each segment",
    fitDurationLabel: "Fit duration during translation (AI concise translation)",
    fitDurationHint: "Restricts word count to fit duration of each sentence.",
    fitDurationShort: "Fit duration in translation",
    toastFitDurationOn: "Enabled: AI will restrict translation word count to fit duration",
    toastFitDurationOff: "Disabled: Standard translation without duration limits",
    autoFitTitle: "Automatically compress audio speed to fit segment duration",
    autoFitLabel: "Auto-fit audio duration",
    autoFitHint: "Compresses speech speed to fit time frame and prevent errors.",
    addToQueueBtn: "Add to Queue",
    projectsTitle: "Projects",
    deleteProjectTitle: "Delete project and clear all files",
    emptyTitle: "From Dialogue to Vietnamese Dub",
    emptyDesc: "Upload a video to start. Transcribe → Translate → Review → Synthesize → Export.",
    status_queued: "Queued",
    status_running: "Processing",
    status_review: "Review",
    status_failed: "Failed",
    status_completed: "Completed",
    status_cancelled: "Cancelled",
    stepExtract: "1. Extract",
    stepSTT: "2. Speech STT",
    stepTranslate: "3. Translate",
    stepTTS: "4. Voice TTS",
    stepExport: "5. Timeline Sync",
    stepMix: "6. Mix Background",
    descReview: "Translation complete · Paused for translation review",
    descCompleted: "Pipeline finished · Output files ready",
    descProcessing: "Processing: {0} {1} - {2}%",
    descPercentDone: "{0}% completed",
    dlHeader: "🎉 Download Results (Audio & Subtitles)",
    dlCompleted: "100% Completed",
    dlMixedPlayer: "Preview mixed audio (Vietnamese + Ducked background):",
    dlNarrationPlayer: "Preview narration audio:",
    dlMixedMp3: "🌟 Download Mixed Audio (MP3)",
    dlMixedMp3Desc: "Vietnamese voice with auto-ducked background",
    dlMixedWav: "🎙️ Download Mixed Audio (WAV)",
    dlMixedWavDesc: "Lossless studio mixed audio",
    dlNarrMp3: "🎵 Download Narration Only (MP3)",
    dlNarrMp3Desc: "Vietnamese narration only",
    dlNarrWav: "🎙️ Download Narration Only (WAV)",
    dlNarrWavDesc: "High quality narration audio",
    dlViSrt: "📝 Vietnamese Subtitles (.SRT)",
    dlViSrtDesc: "Synchronized subtitles",
    dlSrcSrt: "🌐 {0} Subtitles (.SRT)",
    dlSrcSrtDesc: "Original extracted subtitles",
    dlGeneric: "⬇️ Download {0}",
    dlAlertFailed: "<strong>⚠️ Audio file not generated yet:</strong> Process stopped before completing export. Enable <b>\"Auto-fit audio duration\"</b> below and click <b>\"Retry current step\"</b> to proceed.",
    retryStepBtn: "🔄 Retry current step",
    mixHeader: "🎛️ Background Audio & Narration Mix (Ducking)",
    mixDuckingLabel: "Auto-duck background when voice plays",
    mixDuckingHint: "Lowers background audio when narration plays, restores when paused.",
    mixBgLabel: "Original background volume:",
    mixNarrLabel: "Narration volume:",
    mixAttenLabel: "Ducking attenuation:",
    mixPreviewBtn: "🎧 Preview mix (15s)",
    mixPreviewLoading: "Generating preview...",
    mixRemixBtn: "🎛️ Remix Audio",
    mixStarted: "Started background audio remixing!",
    mixSaveErr: "Failed to save mix settings: ",
    mixPreviewErr: "Cannot generate mix preview",
    mixRemixErr: "Remix error: ",
    deleteProjectBtn: "🗑️ Delete Project",
    deleteProjectBtnTitle: "Delete project and clear all files",
    voiceLabelToolbar: "Voice: ",
    pauseReviewShort: "Pause for review",
    autoFitShort: "Auto-fit audio duration",
    saveTranslationBtn: "Save Translation",
    saveGenerateBtn: "Save & Generate Audio",
    cancelProcessBtn: "Cancel Process",
    segmentsCountMeta: "{0} · {1} segments · {2}",
    segmentHint: "Click timestamps to play original audio. Click \"Play\" to preview Vietnamese audio. Orange border: exceeds duration.",
    tabAll: "All ({0})",
    tabWarning: "⚠️ Over duration ({0})",
    tabAiCondense: "🤖 AI Condense Long Sentences ({0})",
    tabAiCondenseTitle: "Use LLM to rewrite long sentences concisely, preserving key meaning within safe word limits",
    aiCondensing: "Sending AI request...",
    toastAiCondenseQueued: "AI sentence condensation task queued to GPU.",
    btnAiCondenseSeg: "🤖 AI Condense",
    btnAiCondenseSegTitle: "Use AI to rewrite this sentence to fit duration",
    toastAiCondenseSegQueued: "Queued AI condensation request for sentence {0}.",
    tabAutoTrim: "✂️ Auto-trim words ({0} segments)",
    tabAutoTrimTitle: "Automatically trims word count of long sentences to safe limits",
    pageCounter: "Page {0}/{1} ({2} segments)",
    emptyNoOverDuration: "🎉 Great! No sentences exceed duration.",
    emptyNoSegments: "No dialogue segments found.",
    autoTrimSuccess: "Trimmed {0} segments to safe duration. Click \"Save Translation\" to confirm!",
    autoTrimAllSafe: "All segments are within safe duration.",
    listenSnippet: "Play",
    stopSnippet: "Stop",
    listenAria: "Play Vietnamese audio {0}",
    transAria: "Translation {0}",
    warnTitleSegment: "Sentence exceeds duration (+{0}s). Please shorten word count.",
    warnBadge: "⚠️ Exceeds +{0}s",
    timingInfo: "Actual: <b>{0}s</b><br>Max: {1}s",
    timingSafe: "{0}s",
    wordCountLabel: "Words: <b>{0}</b> / Max: ~{1} words",
    badgeExcess: "+{0} words",
    badgeOk: "Safe length ✓",
    confirmDeleteRunning: "Project \"{0}\" is RUNNING. Are you sure you want to STOP processing and DELETE all files?",
    confirmDeleteQueued: "Cancel and remove \"{0}\" from queue?",
    confirmDeleteNormal: "Delete project \"{0}\" and clear all files (video, audio...) to free disk space?",
    toastDeletedProject: "Deleted project \"{0}\" and cleared files.",
    toastDeleteErr: "Delete error: ",
    confirmDiscardChanges: "Discard unsaved changes?",
    toastUnsavedSnippet: "Translation or voice unsaved. Save and re-generate audio before previewing.",
    toastCantLoadAudio: "Cannot load audio.",
    toastSaved: "Saved",
    toastVoiceChanged: "Changed voice to: ",
    toastPauseOn: "Enabled: Will pause for review after translation",
    toastPauseOff: "Disabled: Will run automatically from start to finish",
    toastAutoFitOn: "Enabled: Automatically fit audio duration",
    toastAutoFitOff: "Disabled: Strict timing checks",
    toastSelectVideoFirst: "Please select a video file first.",
    toastUploadSuccess: "Added video to queue successfully!",
    toastUploadErr: "Upload error: ",
    toastUploadNetErr: "Cannot upload. Check network connection.",
    voiceModalTitle: "🎙️ Cloned Voice Library (Voice Cloning)",
    addVoiceTitle: "Add New Cloned Voice",
    addVoiceDesc: "Upload clean <b>3–8 second</b> audio sample, single speaker, minimal background noise for optimal VieNeu cloning.",
    voiceNamePlaceholder: "Voice name (e.g. Teacher, Narrator, Storyteller...)",
    createVoiceBtn: "Create Cloned Voice",
    voiceListTitle: "Cloned Voices List",
    loadingVoices: "Loading voice list...",
    noClonedVoices: "No cloned voices yet. Upload a sample audio (3–8s) above to create your first voice!",
    voiceMeta: "Sample length: {0}s · Updated: {1}",
    voicePlaySample: "▶ Sample",
    voicePlayPreview: "🎧 Preview",
    voiceGenPreview: "⚡ Generate Preview",
    voiceGenSending: "Sending...",
    voiceGenSuccess: "Voice preview generation request for \"{0}\" has been queued to GPU.",
    deleteVoiceTitle: "Delete this cloned voice",
    confirmDeleteVoice: "Are you sure you want to delete voice \"{0}\"?",
    toastDeletedVoice: "Deleted voice \"{0}\".",
    toastCantDeleteVoice: "Cannot delete: ",
    toastPromptVoiceName: "Please enter a name for the cloned voice.",
    toastPromptVoiceFile: "Please select a sample audio file (3–8s).",
    voiceCreating: "Processing & normalizing...",
    toastVoiceCreated: "Successfully created cloned voice: \"{0}\" ({1}s)!",
    toastVoiceCreateErr: "Failed to create voice: ",
    usageModalTitle: "📊 System Resource Usage",
    loadingUsage: "Loading system metrics...",
    usageGpuTitle: "🎮 GPU & VRAM",
    usageCpuTitle: "⚡ CPU & RAM",
    usageDiskTitle: "💾 Disk Partition",
    usageBreakdownTitle: "📁 App & Model Details",
    usageGpuModel: "Model:",
    usageVramUsed: "VRAM Used:",
    usageGpuLoad: "GPU Core Load:",
    usageNoGpu: "No NVIDIA GPU detected",
    usageCpuCores: "CPU ({0} cores):",
    usageRamSystem: "System RAM:",
    usageDiskUsedTotal: "Used / Total:",
    usageDiskFree: "Free:",
    usageDiskFull: "{0}% full",
    usageBreakdownVideo: "🎬 Videos & Project Files (data/):",
    usageBreakdownModels: "🧠 AI Models (GGUF, Whisper, TTS):",
    usageBreakdownApp: "📦 App & Environments (.venv):",
    usageUpdatedAt: "Updated at: {0}",
    usageLoadErr: "Failed to load metrics: ",
    grpTop: "⭐ Top Recommended",
    grpNorth: "🏙️ Northern Accent",
    grpCentral: "🏖️ Central Accent",
    grpSouth: "🌴 Southern Accent",
    grpClone: "🎙️ Personal Cloned Voices",
    grpOther: "Other Voices",
    lang_ko: "Korean",
    lang_en: "English",
    lang_ja: "Japanese",
    badge_ko: "🇰🇷 Korean",
    badge_en: "🇺🇸 English",
    badge_ja: "🇯🇵 Japanese"
  }
};

function t(key, ...args){
  let val = (I18N[currentLang] && I18N[currentLang][key] !== undefined)
    ? I18N[currentLang][key]
    : ((I18N['vi'] && I18N['vi'][key] !== undefined) ? I18N['vi'][key] : key);
  if(args.length > 0){
    args.forEach((arg, i) => {
      val = String(val).replace(new RegExp(`\\{${i}\\}`, 'g'), arg);
    });
  }
  return val;
}

function getStatusLabel(state){
  return t('status_' + state);
}

const VOICE_LABELS = {
  vi: {
    "Hải Đăng": "Hải Đăng (Nam Bắc - Chuẩn/Mặc định)",
    "Mai Anh": "Mai Anh (Nữ Bắc - Tự nhiên)",
    "Trúc Ly": "Trúc Ly (Nữ Nam - Truyền cảm)",
    "Thiện Minh": "Thiện Minh (Nam Bắc - Trầm ấm)",
    "Thùy Dung": "Thùy Dung (Nữ Nam - Dịu dàng)",
    "Ngọc Huyền": "Ngọc Huyền (Nữ Bắc - Nhẹ nhàng)",
    "Quang Sơn": "Quang Sơn (Nam Trung - Truyền cảm)",
    "Ngọc Trân": "Ngọc Trân (Nữ Trung - Ngọt ngào)",
    "Thiền Tâm Đức": "Thiền Tâm Đức (Nam - Phật pháp/Trầm)",
    "Adam bựa": "Adam bựa (Nam - Hài hước/Vlog)",
    "Minh Đức": "Minh Đức (Nam Bắc)",
    "Phạm Tuyên": "Phạm Tuyên (Nam Bắc)",
    "Xuân Vĩnh": "Xuân Vĩnh (Nam Bắc)",
    "Thanh Bình": "Thanh Bình (Nam Bắc)",
    "Quốc Tuấn": "Quốc Tuấn (Nam Bắc)",
    "Ngọc Linh": "Ngọc Linh (Nữ Bắc)",
    "Đoan Trang": "Đoan Trang (Nữ Bắc)",
    "Quỳnh Anh": "Quỳnh Anh (Nữ Bắc)",
    "Thái Sơn": "Thái Sơn (Nam Nam)",
    "Minh Triết": "Minh Triết (Nam Nam)",
    "Đức Trí": "Đức Trí (Nam Nam)",
    "Adam": "Adam (Nam Nam)",
    "Thục Đoan": "Thục Đoan (Nữ Nam)",
    "Mỹ Duyên": "Mỹ Duyên (Nữ Nam)",
    "Kim Thanh": "Kim Thanh (Nữ Nam)"
  },
  en: {
    "Hải Đăng": "Hải Đăng (North Male - Standard/Default)",
    "Mai Anh": "Mai Anh (North Female - Natural)",
    "Trúc Ly": "Trúc Ly (South Female - Expressive)",
    "Thiện Minh": "Thiện Minh (North Male - Deep/Warm)",
    "Thùy Dung": "Thùy Dung (South Female - Gentle)",
    "Ngọc Huyền": "Ngọc Huyền (North Female - Soft)",
    "Quang Sơn": "Quang Sơn (Central Male - Expressive)",
    "Ngọc Trân": "Ngọc Trân (Central Female - Sweet)",
    "Thiền Tâm Đức": "Thiền Tâm Đức (Male - Chanting/Deep)",
    "Adam bựa": "Adam bựa (Male - Humorous/Vlog)",
    "Minh Đức": "Minh Đức (North Male)",
    "Phạm Tuyên": "Phạm Tuyên (North Male)",
    "Xuân Vĩnh": "Xuân Vĩnh (North Male)",
    "Thanh Bình": "Thanh Bình (North Male)",
    "Quốc Tuấn": "Quốc Tuấn (North Male)",
    "Ngọc Linh": "Ngọc Linh (North Female)",
    "Đoan Trang": "Đoan Trang (North Female)",
    "Quỳnh Anh": "Quỳnh Anh (North Female)",
    "Thái Sơn": "Thái Sơn (South Male)",
    "Minh Triết": "Minh Triết (South Male)",
    "Đức Trí": "Đức Trí (South Male)",
    "Adam": "Adam (South Male)",
    "Thục Đoan": "Thục Đoan (South Female)",
    "Mỹ Duyên": "Mỹ Duyên (South Female)",
    "Kim Thanh": "Kim Thanh (South Female)"
  }
};

function getVoiceLabel(id, defaultLabel){
  const dict = VOICE_LABELS[currentLang] || VOICE_LABELS['vi'];
  return dict[id] || defaultLabel || id;
}

function getVoiceGroupName(key){
  const dict = {
    "⭐ Đề xuất hàng đầu": t('grpTop'),
    "🏙️ Miền Bắc": t('grpNorth'),
    "🏖️ Miền Trung": t('grpCentral'),
    "🌴 Miền Nam": t('grpSouth'),
    "🎙️ Giọng Clone Cá Nhân": t('grpClone'),
    "Giọng khác": t('grpOther')
  };
  return dict[key] || key;
}

function stopPreview(){
  previewRequest++;
  if(previewAudio){previewAudio.pause();previewAudio=null;}
  if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
  if(previewButton){previewButton.textContent=t('listenSnippet');previewButton=null;}
}

async function playSnippet(segment,button){
  if(previewButton===button){stopPreview();return;}
  stopPreview();
  if((drafts.get(segment.id)??segment.translation)!==segment.translation || ($('#voice')&&$('#voice').value!==current.voice)){
    toast(t('toastUnsavedSnippet'));return;
  }
  const request=previewRequest;
  button.disabled=true;
  try{
    const r=await fetch(`/api/projects/${selected}/segments/${encodeURIComponent(segment.id)}/audio`,{cache:'no-store'});
    if(!r.ok){const error=await r.json().catch(()=>({detail:t('toastCantLoadAudio')}));throw Error(error.detail);}
    const blob=await r.blob();
    if(request!==previewRequest)return;
    document.querySelectorAll('video,audio').forEach(media=>media.pause());
    previewUrl=URL.createObjectURL(blob);previewAudio=new Audio(previewUrl);previewButton=button;
    button.textContent=t('stopSnippet');previewAudio.onended=stopPreview;
    await previewAudio.play();
  }catch(e){if(request===previewRequest){stopPreview();toast(e.message);}}
  finally{button.disabled=false;}
}

const VOICES = [
  { group: "⭐ Đề xuất hàng đầu", items: [
    { id: "Hải Đăng", label: "Hải Đăng (Nam Bắc - Chuẩn/Mặc định)" },
    { id: "Mai Anh", label: "Mai Anh (Nữ Bắc - Tự nhiên)" },
    { id: "Trúc Ly", label: "Trúc Ly (Nữ Nam - Truyền cảm)" },
    { id: "Thiện Minh", label: "Thiện Minh (Nam Bắc - Trầm ấm)" },
    { id: "Thùy Dung", label: "Thùy Dung (Nữ Nam - Dịu dàng)" },
    { id: "Ngọc Huyền", label: "Ngọc Huyền (Nữ Bắc - Nhẹ nhàng)" },
    { id: "Quang Sơn", label: "Quang Sơn (Nam Trung - Truyền cảm)" },
    { id: "Ngọc Trân", label: "Ngọc Trân (Nữ Trung - Ngọt ngào)" },
    { id: "Thiền Tâm Đức", label: "Thiền Tâm Đức (Nam - Phật pháp/Trầm)" },
    { id: "Adam bựa", label: "Adam bựa (Nam - Hài hước/Vlog)" }
  ]},
  { group: "🏙️ Miền Bắc", items: [
    { id: "Minh Đức", label: "Minh Đức (Nam Bắc)" },
    { id: "Phạm Tuyên", label: "Phạm Tuyên (Nam Bắc)" },
    { id: "Xuân Vĩnh", label: "Xuân Vĩnh (Nam Bắc)" },
    { id: "Thanh Bình", label: "Thanh Bình (Nam Bắc)" },
    { id: "Quốc Tuấn", label: "Quốc Tuấn (Nam Bắc)" },
    { id: "Ngọc Linh", label: "Ngọc Linh (Nữ Bắc)" },
    { id: "Đoan Trang", label: "Đoan Trang (Nữ Bắc)" },
    { id: "Quỳnh Anh", label: "Quỳnh Anh (Nữ Bắc)" }
  ]},
  { group: "🏖️ Miền Trung", items: [
    { id: "Quang Sơn", label: "Quang Sơn (Nam Trung)" },
    { id: "Ngọc Trân", label: "Ngọc Trân (Nữ Trung)" }
  ]},
  { group: "🌴 Miền Nam", items: [
    { id: "Thái Sơn", label: "Thái Sơn (Nam Nam)" },
    { id: "Minh Triết", label: "Minh Triết (Nam Nam)" },
    { id: "Đức Trí", label: "Đức Trí (Nam Nam)" },
    { id: "Adam", label: "Adam (Nam Nam)" },
    { id: "Thục Đoan", label: "Thục Đoan (Nữ Nam)" },
    { id: "Mỹ Duyên", label: "Mỹ Duyên (Nữ Nam)" },
    { id: "Kim Thanh", label: "Kim Thanh (Nữ Nam)" }
  ]}
];

let cachedVoicesAll = [];
async function fetchVoicesAll(){
  try {
    cachedVoicesAll = await api('/voices/all');
  } catch(e) {
    cachedVoicesAll = [];
  }
  return cachedVoicesAll;
}

function populateVoiceSelect(select, currentVoice){
  select.replaceChildren();
  const list = cachedVoicesAll.length ? cachedVoicesAll : VOICES.flatMap(g => g.items.map(v => ({...v, group: g.group})));
  const groups = {};
  for(const v of list){
    const grpName = v.group || 'Giọng khác';
    if(!groups[grpName]) groups[grpName] = [];
    groups[grpName].push(v);
  }
  let matched = false;
  for(const [grpName, items] of Object.entries(groups)){
    const grp = el('optgroup');
    grp.label = getVoiceGroupName(grpName);
    for(const v of items){
      const opt = el('option', getVoiceLabel(v.id, v.label));
      opt.value = v.id;
      if(v.id === currentVoice){ opt.selected = true; matched = true; }
      grp.append(opt);
    }
    select.append(grp);
  }
  if(!matched && currentVoice){
    const grp = el('optgroup');
    grp.label = t('grpOther');
    const opt = el('option', currentVoice);
    opt.value = currentVoice;
    opt.selected = true;
    grp.append(opt);
    select.prepend(grp);
  }
}

function buildVoiceSelect(currentVoice){
  const select = el('select');
  select.id = 'voice';
  populateVoiceSelect(select, currentVoice);
  select.onchange = ()=>{stopPreview(); dirty = true;};
  return select;
}

function el(tag, text, cls) { const e=document.createElement(tag); if(text!==undefined)e.textContent=text; if(cls)e.className=cls; return e; }
function toast(message) { $('#toast').textContent=message; $('#toast').style.display='block'; setTimeout(()=>$('#toast').style.display='none',6000); }
async function api(path,options={}) { const r=await fetch('/api'+path,options); if(!r.ok){let b=await r.json().catch(()=>({detail:r.statusText}));throw Error(typeof b.detail==='string'?b.detail:JSON.stringify(b.detail));} return r.json(); }
async function act(action) { try {if(action==='generate'){await save();} await api(`/projects/${selected}/${action}`,{method:'POST'}); dirty=false; await refresh(true);}catch(e){toast(e.message);} }

async function save(){
  if(!current)return;
  for(const s of current.segments){if(drafts.has(s.id))s.translation=drafts.get(s.id);}
  await api(`/projects/${selected}/segments`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({segments:current.segments,voice:$('#voice').value})});
  dirty=false;drafts.clear();
}

function time(s){return new Date(s*1000).toISOString().slice(11,19);}

function renderSegments(container, editable, warningsMap, list){
  stopPreview();
  container.replaceChildren();
  for(const s of list.slice(page*40,(page+1)*40)){
    const w = warningsMap.get(s.id);
    const segDuration = Math.max(0.1, s.end - s.start);
    const row = el('div', undefined, 'segment' + (w ? ' warning' : ''));
    
    const actions = el('div');
    const tBtn = el('button', `${time(s.start)} → ${time(s.end)}`, 'time secondary');
    tBtn.onclick = () => { stopPreview(); $('video').currentTime = s.start; };
    actions.append(tBtn);

    if (w) {
      actions.append(el('div', t('warnBadge', w.overflow_seconds), 'warning-badge'));
      const timingBox = el('div', undefined, 'timing-info');
      const maxSec = w.available_seconds ? w.available_seconds : segDuration.toFixed(1);
      const actSec = w.actual_seconds ? w.actual_seconds : (segDuration + w.overflow_seconds).toFixed(1);
      timingBox.innerHTML = t('timingInfo', actSec, maxSec);
      actions.append(timingBox);

      if (editable) {
        const condenseBtn = el('button', t('btnAiCondenseSeg'), 'btn-condense-seg secondary');
        condenseBtn.title = t('btnAiCondenseSegTitle');
        condenseBtn.onclick = async () => {
          condenseBtn.disabled = true;
          condenseBtn.textContent = '...';
          try {
            await save();
            await api(`/projects/${selected}/condense`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({segment_ids: [s.id]})
            });
            toast(t('toastAiCondenseSegQueued', s.id));
            await refresh(true);
          } catch(err) {
            toast(err.message);
            condenseBtn.disabled = false;
            condenseBtn.textContent = t('btnAiCondenseSeg');
          }
        };
        actions.append(condenseBtn);
      }
    } else {
      actions.append(el('div', t('timingSafe', segDuration.toFixed(1)), 'timing-info'));
    }

    const listen = el('button', t('listenSnippet'), 'secondary');
    listen.style.marginTop = '8px';
    listen.setAttribute('aria-label', t('listenAria', s.id));
    listen.onclick = () => playSnippet(s, listen);
    actions.append(listen);
    row.append(actions);

    row.append(el('div', s.source, 'source'));

    const editCol = el('div');
    const area = el('textarea');
    area.value = drafts.get(s.id) ?? s.translation;
    area.disabled = !editable;
    area.setAttribute('aria-label', t('transAria', s.id));
    if (w) area.title = t('warnTitleSegment', w.overflow_seconds);
    editCol.append(area);

    const counterDiv = el('div', undefined, 'word-counter');
    const availableSec = w ? (w.available_seconds || segDuration) : segDuration;
    const targetMaxWords = Math.max(1, Math.round(availableSec * 3.5));

    function updateWordCounter() {
      const curText = drafts.get(s.id) ?? area.value ?? '';
      const words = countWords(curText);
      counterDiv.replaceChildren();

      const labelSpan = el('span');
      labelSpan.innerHTML = t('wordCountLabel', words, targetMaxWords);
      counterDiv.append(labelSpan);

      if (w || words > targetMaxWords) {
        if (words > targetMaxWords) {
          counterDiv.append(el('span', t('badgeExcess', words - targetMaxWords), 'badge-excess'));
        } else {
          counterDiv.append(el('span', t('badgeOk'), 'badge-ok'));
        }
      }
    }
    updateWordCounter();

    area.oninput = () => {
      stopPreview();
      drafts.set(s.id, area.value);
      dirty = true;
      updateWordCounter();
    };
    editCol.append(counterDiv);
    row.append(editCol);

    container.append(row);
  }
}

async function initUploadForm(){
  await fetchVoicesAll();
  const uploadVoice = $('#uploadVoice');
  if(uploadVoice){
    populateVoiceSelect(uploadVoice, 'Hải Đăng');
  }
}

function renderPipeline(p){
  const steps=[
    {key:'extract',name:t('stepExtract')},
    {key:'stt',name:t('stepSTT')},
    {key:'translate',name:t('stepTranslate')},
    {key:'tts',name:t('stepTTS')},
    {key:'export',name:t('stepExport')},
    {key:'mix',name:t('stepMix')}
  ];
  const keys=steps.map(s=>s.key);
  const currentIdx=keys.indexOf(p.step);
  const state=p.state;

  let stagePct=0;
  const match=(p.progress||'').match(/(\d+)\s*\/\s*(\d+)/);
  if(match){
    const cur=parseInt(match[1],10),tot=parseInt(match[2],10);
    if(tot>0)stagePct=Math.min(100,Math.round((cur/tot)*100));
  }else if(state==='running'&&p.step==='extract'){
    stagePct=50;
  }else if(state==='completed'){
    stagePct=100;
  }

  let overallPct=0;
  if(state==='completed'){
    overallPct=100;
  }else if(currentIdx>=0){
    if(state==='review'){
      overallPct=50;
    }else{
      overallPct=Math.min(99,Math.round(currentIdx*(100/6)+stagePct*(1/6)));
    }
  }

  const card=el('div',undefined,'pipeline-card');
  const stepsEl=el('div',undefined,'pipeline-steps');

  steps.forEach((s,idx)=>{
    const item=el('div',undefined,'step-item');
    let itemState='pending';
    if(state==='completed'){
      itemState='completed';
    }else if(idx<currentIdx){
      itemState='completed';
    }else if(idx===currentIdx){
      if(state==='running')itemState='running';
      else if(state==='review')itemState='review';
      else if(state==='failed')itemState='failed';
      else if(state==='queued')itemState='running';
    }
    item.classList.add(itemState);

    const circle=el('div',undefined,'step-circle');
    if(itemState==='completed'){
      circle.textContent='✓';
    }else if(itemState==='running'){
      circle.textContent=stagePct>0?`${stagePct}%`:'▶';
    }else if(itemState==='review'){
      circle.textContent='✎';
    }else if(itemState==='failed'){
      circle.textContent='!';
    }else{
      circle.textContent=`${idx+1}`;
    }
    item.append(circle);
    item.append(el('div',s.name,'step-label'));
    stepsEl.append(item);

    if(idx<steps.length-1){
      const line=el('div',undefined,'step-line'+(idx<currentIdx||state==='completed'?' completed':''));
      stepsEl.append(line);
    }
  });

  const barWrapper=el('div',undefined,'pipeline-bar-wrapper');
  const bar=el('div',undefined,'pipeline-bar');
  const fill=el('div',undefined,'pipeline-fill');
  fill.style.width=`${overallPct}%`;
  bar.append(fill);

  const statusRow=el('div',undefined,'pipeline-status');
  let detailDesc=p.progress||getStatusLabel(state)||state;
  if(state==='review'){
    detailDesc=t('descReview');
  }else if(state==='completed'){
    detailDesc=t('descCompleted');
  }else if(state==='running'){
    const curName=steps[currentIdx]?steps[currentIdx].name:p.step;
    detailDesc=t('descProcessing', curName, p.progress?`(${p.progress})`:'', stagePct);
  }
  statusRow.append(el('span',detailDesc,'status-desc'));
  statusRow.append(el('span',t('descPercentDone', overallPct),'percent-text'));

  barWrapper.append(bar,statusRow);
  card.append(stepsEl,barWrapper);
  return card;
}

function renderDownloadSection(p){
  const hasExports = Array.isArray(p.exports) && p.exports.length > 0;
  if(!hasExports){
    if(p.state === 'failed'){
      const warnBox = el('div', undefined, 'download-alert-failed');
      const msg = el('div', undefined, 'alert-msg');
      msg.innerHTML = t('dlAlertFailed');
      const retryBtn = el('button', t('retryStepBtn'), 'btn-retry');
      retryBtn.onclick = () => act('resume');
      warnBox.append(msg, retryBtn);
      return warnBox;
    }
    return null;
  }

  const card = el('div', undefined, 'download-card');
  const header = el('div', undefined, 'download-header');
  header.append(el('h3', t('dlHeader')));
  if(p.state === 'completed'){
    header.append(el('span', t('dlCompleted'), 'badge-completed'));
  }
  card.append(header);

  const playFile = p.exports.includes('mixed.mp3') ? 'mixed.mp3' :
                   p.exports.includes('mixed.wav') ? 'mixed.wav' :
                   p.exports.includes('narration.mp3') ? 'narration.mp3' :
                   p.exports.includes('narration.wav') ? 'narration.wav' : null;
  if(playFile){
    const playerBox = el('div', undefined, 'audio-player-box');
    const playerTitle = playFile.startsWith('mixed') ? t('dlMixedPlayer') : t('dlNarrationPlayer');
    const playerLabel = el('div', playerTitle, 'audio-player-label');
    const audio = el('audio');
    audio.controls = true;
    audio.preload = 'metadata';
    audio.src = `/api/projects/${p.id}/files/${playFile}`;
    playerBox.append(playerLabel, audio);
    card.append(playerBox);
  }

  const btnGroup = el('div', undefined, 'download-btn-group');
  const stem = (p.name || 'video').replace(/\.[^/.]+$/, '').trim() || 'video';
  const srcLang = p.source_language || 'ko';
  const srcLabel = t('lang_' + srcLang) || srcLang.toUpperCase();

  const meta = {
    'mixed.mp3': { label: t('dlMixedMp3'), primary: true, desc: t('dlMixedMp3Desc'), dlName: `${stem}_mixed.mp3` },
    'mixed.wav': { label: t('dlMixedWav'), primary: false, desc: t('dlMixedWavDesc'), dlName: `${stem}_mixed.wav` },
    'narration.mp3': { label: t('dlNarrMp3'), primary: false, desc: t('dlNarrMp3Desc'), dlName: `${stem}_thuyet_minh.mp3` },
    'narration.wav': { label: t('dlNarrWav'), primary: false, desc: t('dlNarrWavDesc'), dlName: `${stem}_thuyet_minh.wav` },
    'vi.srt': { label: t('dlViSrt'), primary: false, desc: t('dlViSrtDesc'), dlName: `${stem}_vi.srt` },
    [`${srcLang}.srt`]: { label: t('dlSrcSrt', srcLabel), primary: false, desc: t('dlSrcSrtDesc'), dlName: `${stem}_${srcLang}.srt` },
    'ko.srt': { label: t('dlSrcSrt', t('lang_ko')), primary: false, desc: t('dlSrcSrtDesc'), dlName: `${stem}_ko.srt` },
    'en.srt': { label: t('dlSrcSrt', t('lang_en')), primary: false, desc: t('dlSrcSrtDesc'), dlName: `${stem}_en.srt` },
    'ja.srt': { label: t('dlSrcSrt', t('lang_ja')), primary: false, desc: t('dlSrcSrtDesc'), dlName: `${stem}_ja.srt` }
  };

  const order = ['mixed.mp3', 'mixed.wav', 'narration.mp3', 'narration.wav', 'vi.srt', `${srcLang}.srt`, 'ko.srt', 'en.srt', 'ja.srt'];
  const sorted = [...p.exports].sort((a,b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  for(const name of sorted){
    const info = meta[name] || { label: t('dlGeneric', name), primary: false, desc: '', dlName: `${stem}_${name}` };
    const a = el('a', undefined, 'btn-download' + (info.primary ? ' primary' : ''));
    a.href = `/api/projects/${p.id}/files/${name}`;
    a.download = info.dlName || name;
    
    const iconLabel = el('span', info.label, 'btn-download-title');
    a.append(iconLabel);
    if(info.desc){
      a.append(el('span', info.desc, 'btn-download-desc'));
    }
    btnGroup.append(a);
  }

  card.append(btnGroup);
  return card;
}

function renderMixCard(p){
  const card = el('div', undefined, 'mix-card');
  const header = el('div', undefined, 'mix-header');
  header.append(el('h3', t('mixHeader')));
  card.append(header);

  const grid = el('div', undefined, 'mix-grid');

  const duckCtrl = el('div', undefined, 'mix-control');
  const duckLabel = el('label', undefined, 'checkbox-label');
  const duckCb = el('input');
  duckCb.type = 'checkbox';
  duckCb.checked = (p.mix_ducking !== 0);
  duckLabel.append(duckCb, el('span', t('mixDuckingLabel')));
  duckCtrl.append(duckLabel);
  duckCtrl.append(el('small', t('mixDuckingHint'), 'hint-text'));
  grid.append(duckCtrl);

  const bgCtrl = el('div', undefined, 'mix-control');
  const bgLabel = el('label');
  const bgValSpan = el('span', `${Math.round((p.mix_background_gain ?? 0.25) * 100)}%`, 'val');
  bgLabel.append(el('span', t('mixBgLabel')), bgValSpan);
  const bgRange = el('input');
  bgRange.type = 'range';
  bgRange.min = '0'; bgRange.max = '100'; bgRange.step = '5';
  bgRange.value = Math.round((p.mix_background_gain ?? 0.25) * 100);
  bgRange.oninput = () => { bgValSpan.textContent = `${bgRange.value}%`; };
  bgCtrl.append(bgLabel, bgRange);
  grid.append(bgCtrl);

  const narrCtrl = el('div', undefined, 'mix-control');
  const narrLabel = el('label');
  const narrValSpan = el('span', `${Math.round((p.mix_narration_gain ?? 1.0) * 100)}%`, 'val');
  narrLabel.append(el('span', t('mixNarrLabel')), narrValSpan);
  const narrRange = el('input');
  narrRange.type = 'range';
  narrRange.min = '20'; narrRange.max = '150'; narrRange.step = '5';
  narrRange.value = Math.round((p.mix_narration_gain ?? 1.0) * 100);
  narrRange.oninput = () => { narrValSpan.textContent = `${narrRange.value}%`; };
  narrCtrl.append(narrLabel, narrRange);
  grid.append(narrCtrl);

  const attenCtrl = el('div', undefined, 'mix-control');
  const attenLabel = el('label');
  const attenValSpan = el('span', `-${Math.round(p.mix_ducking_attenuation ?? 16)} dB`, 'val');
  attenLabel.append(el('span', t('mixAttenLabel')), attenValSpan);
  const attenRange = el('input');
  attenRange.type = 'range';
  attenRange.min = '8'; attenRange.max = '28'; attenRange.step = '2';
  attenRange.value = Math.round(p.mix_ducking_attenuation ?? 16);
  attenRange.oninput = () => { attenValSpan.textContent = `-${attenRange.value} dB`; };
  attenCtrl.append(attenLabel, attenRange);
  grid.append(attenCtrl);

  card.append(grid);

  const saveMixSettings = async () => {
    try {
      await api(`/projects/${p.id}/settings`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          mix_ducking: duckCb.checked ? 1 : 0,
          mix_background_gain: parseFloat(bgRange.value) / 100.0,
          mix_narration_gain: parseFloat(narrRange.value) / 100.0,
          mix_ducking_attenuation: parseFloat(attenRange.value)
        })
      });
      p.mix_ducking = duckCb.checked ? 1 : 0;
      p.mix_background_gain = parseFloat(bgRange.value) / 100.0;
      p.mix_narration_gain = parseFloat(narrRange.value) / 100.0;
      p.mix_ducking_attenuation = parseFloat(attenRange.value);
    } catch(err) {
      toast(t('mixSaveErr') + err.message);
    }
  };

  duckCb.onchange = saveMixSettings;
  bgRange.onchange = saveMixSettings;
  narrRange.onchange = saveMixSettings;
  attenRange.onchange = saveMixSettings;

  const actions = el('div', undefined, 'mix-actions');
  const previewBtn = el('button', t('mixPreviewBtn'), 'secondary');
  const remixBtn = el('button', t('mixRemixBtn'));
  const playerBox = el('div', undefined, 'mix-preview-player');
  playerBox.hidden = true;
  const audioEl = el('audio');
  audioEl.controls = true;
  playerBox.append(audioEl);

  previewBtn.onclick = async () => {
    previewBtn.disabled = true;
    previewBtn.textContent = t('mixPreviewLoading');
    try {
      await saveMixSettings();
      let startSec = 10;
      if(p.segments && p.segments.length > 0){
        startSec = Math.max(0, p.segments[0].start - 1);
      }
      const r = await fetch(`/api/projects/${p.id}/mix/preview?start=${startSec}&duration=15`);
      if(!r.ok){
        const err = await r.json().catch(()=>({detail: t('mixPreviewErr')}));
        throw Error(err.detail);
      }
      const blob = await r.blob();
      audioEl.src = URL.createObjectURL(blob);
      playerBox.hidden = false;
      await audioEl.play();
    } catch(err) {
      toast(err.message);
    } finally {
      previewBtn.disabled = false;
      previewBtn.textContent = t('mixPreviewBtn');
    }
  };

  remixBtn.onclick = async () => {
    remixBtn.disabled = true;
    try {
      await saveMixSettings();
      await api(`/projects/${p.id}/remix`, {method: 'POST'});
      toast(t('mixStarted'));
      await refresh(true);
    } catch(err) {
      toast(t('mixRemixErr') + err.message);
    } finally {
      remixBtn.disabled = false;
    }
  };

  actions.append(previewBtn, remixBtn);
  card.append(actions, playerBox);
  return card;
}

async function deleteProject(p){
  let msg = t('confirmDeleteNormal', p.name);
  if(p.state === 'running'){
    msg = t('confirmDeleteRunning', p.name);
  }else if(p.state === 'queued'){
    msg = t('confirmDeleteQueued', p.name);
  }
  if(!confirm(msg)) return;
  try{
    await api(`/projects/${p.id}`, {method: 'DELETE'});
    toast(t('toastDeletedProject', p.name));
    if(selected === p.id){
      selected = null;
      current = null;
      dirty = false;
      drafts.clear();
      $('#workspace').innerHTML = `<div class="empty"><span>◉</span><h2>${t('emptyTitle')}</h2><p>${t('emptyDesc')}</p></div>`;
    }
    await refresh(true);
  }catch(err){
    toast(t('toastDeleteErr') + err.message);
  }
}

function render(){
  stopPreview();
  const w=$('#workspace');w.replaceChildren(); const p=current;
  const heading=el('div',undefined,'heading');
  const hLeft=el('div',undefined,'heading-left');
  const langPill = el('span', t('badge_' + p.source_language) || (p.source_language || 'ko').toUpperCase(), 'badge-lang');
  hLeft.append(el('h2',p.name),el('span',getStatusLabel(p.state)||p.state,'status'), langPill);
  heading.append(hLeft);

  const hActions=el('div',undefined,'heading-actions');
  const delMainBtn=el('button',t('deleteProjectBtn'),'btn-danger secondary');
  delMainBtn.title=t('deleteProjectBtnTitle');
  delMainBtn.onclick=()=>deleteProject(p);
  hActions.append(delMainBtn);
  heading.append(hActions);
  w.append(heading);
  w.append(renderPipeline(p));
  const dlSec = renderDownloadSection(p);
  if(dlSec) w.append(dlSec);
  w.append(el('p',t('segmentsCountMeta', p.progress||getStatusLabel(p.state), p.segments.length, time(p.duration))));
  const video=el('video');video.controls=true;video.preload='metadata';video.src=`/api/projects/${p.id}/files/source`;w.append(video);
  if(p.error)w.append(el('pre',p.error,'error'));
  
  const tools=el('div',undefined,'toolbar');
  tools.append(el('label',t('voiceLabelToolbar')));
  const voiceSelect=buildVoiceSelect(p.voice);
  voiceSelect.onchange=async()=>{
    stopPreview();dirty=true;
    try{
      await api(`/projects/${p.id}/settings`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({voice:voiceSelect.value})});
      p.voice=voiceSelect.value;toast(t('toastVoiceChanged')+voiceSelect.value);
    }catch(e){toast(e.message);}
  };
  tools.append(voiceSelect);

  const pauseLabel=el('label',undefined,'checkbox-label');
  const pauseCb=el('input');pauseCb.type='checkbox';
  pauseCb.checked=(p.pause_review!==0);
  pauseCb.onchange=async()=>{
    try{
      await api(`/projects/${p.id}/settings`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({pause_review:pauseCb.checked})});
      p.pause_review=pauseCb.checked?1:0;
      toast(pauseCb.checked?t('toastPauseOn'):t('toastPauseOff'));
    }catch(e){toast(e.message);pauseCb.checked=!pauseCb.checked;}
  };
  pauseLabel.append(pauseCb,el('span',t('pauseReviewShort')));
  tools.append(pauseLabel);

  const autoFitLabel=el('label',undefined,'checkbox-label');
  const autoFitCb=el('input');autoFitCb.type='checkbox';
  autoFitCb.checked=(p.auto_fit!==0);
  autoFitCb.onchange=async()=>{
    try{
      await api(`/projects/${p.id}/settings`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({auto_fit:autoFitCb.checked})});
      p.auto_fit=autoFitCb.checked?1:0;
      toast(autoFitCb.checked?t('toastAutoFitOn'):t('toastAutoFitOff'));
    }catch(e){toast(e.message);autoFitCb.checked=!autoFitCb.checked;}
  };
  autoFitLabel.append(autoFitCb,el('span',t('autoFitShort')));
  tools.append(autoFitLabel);

  const fitDurLabel=el('label',undefined,'checkbox-label');
  const fitDurCb=el('input');fitDurCb.type='checkbox';
  fitDurCb.checked=(p.fit_duration!==0);
  fitDurCb.onchange=async()=>{
    try{
      await api(`/projects/${p.id}/settings`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fit_duration:fitDurCb.checked})});
      p.fit_duration=fitDurCb.checked?1:0;
      toast(fitDurCb.checked?t('toastFitDurationOn'):t('toastFitDurationOff'));
    }catch(e){toast(e.message);fitDurCb.checked=!fitDurCb.checked;}
  };
  fitDurLabel.append(fitDurCb,el('span',t('fitDurationShort')));
  tools.append(fitDurLabel);

  const editable=['review','failed','completed'].includes(p.state);
  if(editable&&p.segments.length){
    const saveButton=el('button',t('saveTranslationBtn'),'secondary');saveButton.onclick=async()=>{try{await save();toast(t('toastSaved'));await refresh(true);}catch(e){toast(e.message);}};tools.append(saveButton);
    const generate=el('button',t('saveGenerateBtn'));generate.onclick=()=>act('generate');tools.append(generate);
  }
  if(['running','queued'].includes(p.state)){const b=el('button',t('cancelProcessBtn'),'secondary');b.onclick=()=>act('cancel');tools.append(b);}
  if(['failed','cancelled'].includes(p.state)){const b=el('button',t('retryStepBtn'),'secondary');b.onclick=()=>act('resume');tools.append(b);}
  w.append(tools);
  w.append(renderMixCard(p));
  if(p.segments.length){
    w.append(el('p',t('segmentHint'),'hint'));

    const warningsMap = new Map((p.warnings||[]).map(x=>[x.id, x]));
    const warnCount = warningsMap.size;

    const filterTabs = el('div', undefined, 'filter-tabs');
    const allTab = el('button', t('tabAll', p.segments.length), 'tab-btn' + (!filterWarnings ? ' active' : ''));
    filterTabs.append(allTab);

    const warnTab = el('button', t('tabWarning', warnCount), 'tab-btn warning-tab' + (filterWarnings ? ' active' : ''));
    if(warnCount === 0) warnTab.style.opacity = '0.6';
    filterTabs.append(warnTab);

    if(warnCount > 0 && editable){
      const aiCondenseBtn = el('button', t('tabAiCondense', warnCount), 'tab-btn ai-condense-btn');
      aiCondenseBtn.title = t('tabAiCondenseTitle');
      aiCondenseBtn.onclick = async () => {
        aiCondenseBtn.disabled = true;
        aiCondenseBtn.textContent = t('aiCondensing');
        try {
          await save();
          await api(`/projects/${p.id}/condense`, {method: 'POST'});
          toast(t('toastAiCondenseQueued'));
          await refresh(true);
        } catch(err) {
          toast(err.message);
        } finally {
          aiCondenseBtn.disabled = false;
          aiCondenseBtn.textContent = t('tabAiCondense', warnCount);
        }
      };
      filterTabs.append(aiCondenseBtn);

      const trimBtn = el('button', t('tabAutoTrim', warnCount), 'tab-btn auto-trim-btn');
      trimBtn.title = t('tabAutoTrimTitle');
      trimBtn.onclick = () => {
        let trimmed = 0;
        for(const s of p.segments){
          const w = warningsMap.get(s.id);
          if(!w) continue;
          const curText = drafts.get(s.id) ?? s.translation ?? '';
          const words = curText.trim().split(/\s+/).filter(Boolean);
          const segDuration = Math.max(0.1, s.end - s.start);
          const availableSec = w.available_seconds || segDuration;
          const targetMax = Math.max(1, Math.round(availableSec * 3.5));
          if(words.length > targetMax){
            drafts.set(s.id, words.slice(0, targetMax).join(' '));
            dirty = true;
            trimmed++;
          }
        }
        if(trimmed > 0){
          toast(t('autoTrimSuccess', trimmed));
          show();
        } else {
          toast(t('autoTrimAllSafe'));
        }
      };
      filterTabs.append(trimBtn);
    }
    w.append(filterTabs);

    const pages=el('div',undefined,'pages'), prev=el('button','←','secondary'), next=el('button','→','secondary'), counter=el('span');
    const rows=el('div',undefined,'segments');

    function getVisibleSegments(){
      return filterWarnings ? p.segments.filter(s=>warningsMap.has(s.id)) : p.segments;
    }

    function show(){
      const list = getVisibleSegments();
      const maxPage = Math.max(1, Math.ceil(list.length / 40));
      page = Math.max(0, Math.min(page, maxPage - 1));

      allTab.className = 'tab-btn' + (!filterWarnings ? ' active' : '');
      warnTab.className = 'tab-btn warning-tab' + (filterWarnings ? ' active' : '');

      if(list.length === 0){
        rows.replaceChildren();
        rows.append(el('p', filterWarnings ? t('emptyNoOverDuration') : t('emptyNoSegments'), 'hint'));
        counter.textContent = t('pageCounter', 0, maxPage, 0);
        prev.disabled = true;
        next.disabled = true;
        return;
      }

      counter.textContent = t('pageCounter', page+1, maxPage, list.length);
      prev.disabled = page === 0;
      next.disabled = (page+1)*40 >= list.length;
      renderSegments(rows, editable, warningsMap, list);
    }

    allTab.onclick = () => { filterWarnings = false; page = 0; show(); };
    warnTab.onclick = () => { filterWarnings = true; page = 0; show(); };

    prev.onclick=()=>{page--;show();};next.onclick=()=>{page++;show();};pages.append(prev,counter,next);w.append(pages,rows);show();
  }
}

async function refresh(force=false){
  if(busy)return;busy=true;
  try{
    const all=await api('/projects');$('#projects').replaceChildren();
    for(const p of all){
      const row=el('div',undefined,'project-row'+(p.id===selected?' active':''));
      const b=el('button',p.name,'project-select-btn');
      b.append(el('small',`${getStatusLabel(p.state)||p.state} · ${p.progress||p.step}`));
      b.onclick=async()=>{
        if(dirty&&!confirm(t('confirmDiscardChanges')))return;
        selected=p.id;page=0;dirty=false;drafts.clear();filterWarnings=false;await refresh(true);
      };
      const delBtn=el('button','🗑️','project-del-btn');
      delBtn.title=t('deleteProjectTitle');
      delBtn.onclick=(e)=>{e.stopPropagation();deleteProject(p);};
      row.append(b,delBtn);
      $('#projects').append(row);
    }
    if(!all.length){
      selected=null;current=null;
      $('#workspace').innerHTML=`<div class="empty"><span>◉</span><h2>${t('emptyTitle')}</h2><p>${t('emptyDesc')}</p></div>`;
    }else{
      if(!selected||!all.some(x=>x.id===selected))selected=all[0].id;
      if(selected&&!dirty&&!previewAudio){
        const p=await api(`/projects/${selected}`);
        const changed=force||!current||p.id!==current.id||p.state!==current.state||p.progress!==current.progress;
        if(changed){current=p;render();}
      }
    }
  }catch(e){toast(e.message);}finally{busy=false;}
}

$('#upload').onclick=()=>{
  const fileInput=$('#file');
  const file=fileInput.files[0];if(!file){toast(t('toastSelectVideoFirst'));return;}
  const form=new FormData();
  form.append('file',file);
  const voiceEl=$('#uploadVoice');
  if(voiceEl&&voiceEl.value)form.append('voice',voiceEl.value);
  const pauseEl=$('#uploadPauseReview');
  form.append('pause_review',pauseEl&&pauseEl.checked?'1':'0');
  const autoFitEl=$('#uploadAutoFit');
  form.append('auto_fit',autoFitEl&&autoFitEl.checked?'1':'0');
  const fitDurEl=$('#uploadFitDuration');
  form.append('fit_duration',fitDurEl&&fitDurEl.checked?'1':'0');
  const langEl=$('#uploadSourceLang');
  if(langEl&&langEl.value)form.append('source_language',langEl.value);
  const xhr=new XMLHttpRequest();xhr.open('POST','/api/projects');
  $('#upload').disabled=true;$('#uploadProgress').hidden=false;
  xhr.upload.onprogress=e=>{if(e.lengthComputable)$('#uploadProgress').value=e.loaded/e.total*100;};
  xhr.onload=()=>{
    if(xhr.status<300){
      fileInput.value='';
      $('#uploadProgress').value=0;
      selected=JSON.parse(xhr.responseText).id;
      dirty=false;
      drafts.clear();
      refresh(true);
      toast(t('toastUploadSuccess'));
    }else{
      toast(t('toastUploadErr')+xhr.responseText);
    }
    $('#upload').disabled=false;
    $('#uploadProgress').hidden=true;
  };
  xhr.onerror=()=>{
    toast(t('toastUploadNetErr'));
    $('#upload').disabled=false;
    $('#uploadProgress').hidden=true;
  };
  xhr.send(form);
};

window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});

function makeProgressBar(pct){
  const bar = el('div', undefined, 'usage-progress-bar');
  const fill = el('div', undefined, 'usage-progress-fill');
  fill.style.width = Math.min(100, Math.max(0, pct)) + '%';
  if(pct >= 90) fill.classList.add('danger');
  else if(pct >= 75) fill.classList.add('warn');
  bar.append(fill);
  return bar;
}

function formatBytes(bytes){
  if(bytes >= 1024**3) return (bytes / 1024**3).toFixed(2) + ' GB';
  if(bytes >= 1024**2) return (bytes / 1024**2).toFixed(1) + ' MB';
  if(bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

async function loadUsage(){
  const content = $('#usageContent');
  const timeEl = $('#usageTime');
  content.innerHTML = `<div class="usage-loading">${t('loadingUsage')}</div>`;
  try {
    const data = await api('/usage');
    content.replaceChildren();

    const grid = el('div', undefined, 'usage-grid');

    // 1. GPU & VRAM Card
    const gpuCard = el('div', undefined, 'usage-card');
    const gpuTitle = el('div', undefined, 'usage-card-title');
    gpuTitle.append(el('span', t('usageGpuTitle')));
    if(data.gpu && data.gpu.available){
      gpuTitle.append(el('span', `${data.gpu.vram_usage_pct}% VRAM`, 'val-highlight'));
    }
    gpuCard.append(gpuTitle);

    if(data.gpu && data.gpu.available){
      const rowName = el('div', undefined, 'usage-stat-row');
      rowName.append(el('span', t('usageGpuModel'), 'label'), el('span', data.gpu.name, 'val'));
      gpuCard.append(rowName);

      const usedGb = (data.gpu.vram_used_mb / 1024).toFixed(1);
      const totGb = (data.gpu.vram_total_mb / 1024).toFixed(1);
      const rowVram = el('div', undefined, 'usage-stat-row');
      rowVram.append(el('span', t('usageVramUsed'), 'label'), el('span', `${usedGb} GB / ${totGb} GB`, 'val'));
      gpuCard.append(rowVram, makeProgressBar(data.gpu.vram_usage_pct));

      const rowUtil = el('div', undefined, 'usage-stat-row');
      rowUtil.append(el('span', t('usageGpuLoad'), 'label'), el('span', `${data.gpu.gpu_util_pct}%`, 'val'));
      gpuCard.append(rowUtil, makeProgressBar(data.gpu.gpu_util_pct));
    } else {
      const rowMsg = el('div', undefined, 'usage-stat-row');
      rowMsg.append(el('span', data.gpu ? data.gpu.name : t('usageNoGpu'), 'hint'));
      gpuCard.append(rowMsg);
    }
    grid.append(gpuCard);

    // 2. CPU & RAM Card
    const cpuCard = el('div', undefined, 'usage-card');
    const cpuTitle = el('div', undefined, 'usage-card-title');
    cpuTitle.append(el('span', t('usageCpuTitle')));
    cpuTitle.append(el('span', `${data.cpu.usage_pct}% CPU`, 'val-highlight'));
    cpuCard.append(cpuTitle);

    const rowCpu = el('div', undefined, 'usage-stat-row');
    rowCpu.append(el('span', t('usageCpuCores', data.cpu.cores), 'label'), el('span', `${data.cpu.usage_pct}%`, 'val'));
    cpuCard.append(rowCpu, makeProgressBar(data.cpu.usage_pct));

    const rowRam = el('div', undefined, 'usage-stat-row');
    rowRam.append(el('span', t('usageRamSystem'), 'label'), el('span', `${data.ram.used_gb} GB / ${data.ram.total_gb} GB (${data.ram.usage_pct}%)`, 'val'));
    cpuCard.append(rowRam, makeProgressBar(data.ram.usage_pct));

    grid.append(cpuCard);

    // 3. Disk Partition Card
    const diskCard = el('div', undefined, 'usage-card');
    const diskTitle = el('div', undefined, 'usage-card-title');
    diskTitle.append(el('span', t('usageDiskTitle')));
    diskTitle.append(el('span', t('usageDiskFull', data.disk.usage_pct), 'val-highlight'));
    diskCard.append(diskTitle);

    const rowDisk = el('div', undefined, 'usage-stat-row');
    rowDisk.append(el('span', t('usageDiskUsedTotal'), 'label'), el('span', `${data.disk.used_gb} GB / ${data.disk.total_gb} GB`, 'val'));
    const rowFree = el('div', undefined, 'usage-stat-row');
    rowFree.append(el('span', t('usageDiskFree'), 'label'), el('span', `${data.disk.free_gb} GB`, 'val'));
    diskCard.append(rowDisk, makeProgressBar(data.disk.usage_pct), rowFree);
    grid.append(diskCard);

    // 4. Breakdown Card
    const breakCard = el('div', undefined, 'usage-card');
    const breakTitle = el('div', undefined, 'usage-card-title');
    breakTitle.append(el('span', t('usageBreakdownTitle')));
    breakCard.append(breakTitle);

    const bd = data.disk.breakdown || {};
    const bList = el('div', undefined, 'breakdown-list');
    
    const b1 = el('div', undefined, 'breakdown-item');
    b1.append(el('span', t('usageBreakdownVideo'), 'item-name'), el('span', formatBytes(bd.video_and_data_bytes || 0), 'item-val'));
    
    const b2 = el('div', undefined, 'breakdown-item');
    b2.append(el('span', t('usageBreakdownModels'), 'item-name'), el('span', formatBytes(bd.models_bytes || 0), 'item-val'));
    
    const b3 = el('div', undefined, 'breakdown-item');
    b3.append(el('span', t('usageBreakdownApp'), 'item-name'), el('span', formatBytes(bd.app_and_env_bytes || 0), 'item-val'));
    
    bList.append(b1, b2, b3);
    breakCard.append(bList);
    grid.append(breakCard);

    content.append(grid);
    if(timeEl) timeEl.textContent = t('usageUpdatedAt', new Date().toLocaleTimeString());
  } catch(err) {
    content.innerHTML = `<div class="error">${t('usageLoadErr')}${err.message}</div>`;
  }
}

function initUsageModal(){
  const btn = $('#usageBtn');
  const modal = $('#usageModal');
  const closeBtn = $('#usageCloseBtn');
  const closeFooterBtn = $('#usageCloseFooterBtn');
  const refreshBtn = $('#usageRefreshBtn');
  if(!btn || !modal) return;

  btn.onclick = () => { modal.hidden = false; loadUsage(); };
  const hide = () => { modal.hidden = true; };
  if(closeBtn) closeBtn.onclick = hide;
  if(closeFooterBtn) closeFooterBtn.onclick = hide;
  if(refreshBtn) refreshBtn.onclick = () => loadUsage();
  modal.onclick = (e) => { if(e.target === modal) hide(); };
}

async function loadVoiceLibrary(){
  const listEl = $('#voiceList');
  if(!listEl) return;
  listEl.innerHTML = `<div class="usage-loading">${t('loadingVoices')}</div>`;
  try {
    const voices = await api('/voices');
    await fetchVoicesAll();
    const uv = $('#uploadVoice');
    if(uv && current) populateVoiceSelect(uv, uv.value || 'Hải Đăng');
    listEl.replaceChildren();
    if(!voices.length){
      listEl.innerHTML = `<p class="hint-text" style="text-align:center;padding:20px">${t('noClonedVoices')}</p>`;
      return;
    }
    for(const v of voices){
      const item = el('div', undefined, 'voice-item');
      const info = el('div', undefined, 'voice-info');
      const nameEl = el('div', undefined, 'voice-name');
      nameEl.append(el('span', '🎙️ ' + v.name));
      const metaEl = el('div', t('voiceMeta', v.duration, new Date(v.created * 1000).toLocaleDateString()), 'voice-meta');
      info.append(nameEl, metaEl);

      const actions = el('div', undefined, 'voice-actions');
      const sampleBtn = el('button', t('voicePlaySample'), 'voice-btn-sm secondary');
      sampleBtn.onclick = () => {
        stopPreview();
        const a = new Audio(`/api/voices/${v.id}/sample`);
        a.play();
      };
      actions.append(sampleBtn);

      if(v.has_preview){
        const prevBtn = el('button', t('voicePlayPreview'), 'voice-btn-sm secondary');
        prevBtn.onclick = () => {
          stopPreview();
          const a = new Audio(`/api/voices/${v.id}/preview?t=${Date.now()}`);
          a.play();
        };
        actions.append(prevBtn);
      }

      const genPrevBtn = el('button', t('voiceGenPreview'), 'voice-btn-sm secondary');
      genPrevBtn.onclick = async () => {
        genPrevBtn.disabled = true;
        genPrevBtn.textContent = t('voiceGenSending');
        try {
          await api(`/voices/${v.id}/preview`, {method: 'POST'});
          toast(t('voiceGenSuccess', v.name));
          await refresh(true);
        } catch(err) {
          toast(err.message);
        } finally {
          genPrevBtn.disabled = false;
          genPrevBtn.textContent = t('voiceGenPreview');
        }
      };
      actions.append(genPrevBtn);

      const delBtn = el('button', '🗑️', 'voice-btn-sm btn-danger');
      delBtn.title = t('deleteVoiceTitle');
      delBtn.onclick = async () => {
        if(!confirm(t('confirmDeleteVoice', v.name))) return;
        try {
          await api(`/voices/${v.id}`, {method: 'DELETE'});
          toast(t('toastDeletedVoice', v.name));
          await loadVoiceLibrary();
          await refresh(true);
        } catch(err) {
          toast(t('toastCantDeleteVoice') + err.message);
        }
      };
      actions.append(delBtn);

      item.append(info, actions);
      listEl.append(item);
    }
  } catch(err) {
    listEl.innerHTML = `<div class="error">${err.message}</div>`;
  }
}

function initVoiceModal(){
  const btn = $('#voiceLibBtn');
  const modal = $('#voiceModal');
  const closeBtn = $('#voiceModalCloseBtn');
  const closeFooterBtn = $('#voiceModalFooterCloseBtn');
  const submitBtn = $('#voiceSubmitBtn');
  if(!btn || !modal) return;

  btn.onclick = () => { modal.hidden = false; loadVoiceLibrary(); };
  const hide = () => { modal.hidden = true; };
  if(closeBtn) closeBtn.onclick = hide;
  if(closeFooterBtn) closeFooterBtn.onclick = hide;
  modal.onclick = (e) => { if(e.target === modal) hide(); };

  if(submitBtn){
    submitBtn.onclick = async () => {
      const name = $('#voiceNameInput').value.trim();
      const file = $('#voiceFileInput').files[0];
      if(!name){ toast(t('toastPromptVoiceName')); return; }
      if(!file){ toast(t('toastPromptVoiceFile')); return; }

      submitBtn.disabled = true;
      submitBtn.textContent = t('voiceCreating');
      try {
        const form = new FormData();
        form.append('name', name);
        form.append('file', file);
        const res = await api('/voices', {method: 'POST', body: form});
        toast(t('toastVoiceCreated', res.name, res.duration));
        $('#voiceNameInput').value = '';
        $('#voiceFileInput').value = '';
        await loadVoiceLibrary();
        await refresh(true);
      } catch(err) {
        toast(t('toastVoiceCreateErr') + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = t('createVoiceBtn');
      }
    };
  }
}

function setUiLanguage(lang){
  currentLang = (lang === 'en') ? 'en' : 'vi';
  localStorage.setItem('vietvoice_ui_lang', currentLang);
  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if(k && I18N[currentLang] && I18N[currentLang][k] !== undefined){
      el.innerHTML = I18N[currentLang][k];
    }
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const k = el.getAttribute('data-i18n-title');
    if(k && I18N[currentLang] && I18N[currentLang][k] !== undefined){
      el.title = I18N[currentLang][k];
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const k = el.getAttribute('data-i18n-placeholder');
    if(k && I18N[currentLang] && I18N[currentLang][k] !== undefined){
      el.placeholder = I18N[currentLang][k];
    }
  });

  const langSelect = $('#uiLangSelect');
  if(langSelect && langSelect.value !== currentLang) langSelect.value = currentLang;

  const uploadVoice = $('#uploadVoice');
  if(uploadVoice) populateVoiceSelect(uploadVoice, uploadVoice.value || 'Hải Đăng');

  const voiceSelect = $('#voice');
  if(voiceSelect && current) populateVoiceSelect(voiceSelect, current.voice);

  if(current) render();
  refresh(true);
}

function initLanguageSwitch(){
  const langSelect = $('#uiLangSelect');
  if(langSelect){
    langSelect.value = currentLang;
    langSelect.onchange = () => setUiLanguage(langSelect.value);
  }
  setUiLanguage(currentLang);
}

initLanguageSwitch();
initUploadForm();
initUsageModal();
initVoiceModal();
refresh();setInterval(()=>refresh(),3000);
