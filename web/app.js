const $ = s => document.querySelector(s);
let selected = null, current = null, dirty = false, page = 0, busy = false, filterWarnings = false;
function countWords(s){ return (s||'').trim().split(/\s+/).filter(Boolean).length; }
const drafts = new Map();
let previewAudio = null, previewUrl = null, previewButton = null, previewRequest = 0;

let currentLang = localStorage.getItem('vietvoice_ui_lang') || 'vi';

const I18N = {
  vi: {
    addProjectBtn: "➕ Thêm Video Mới",
    projectModalTitleAdd: "➕ Thêm Video Mới & Thiết Lập",
    projectModalTitleEdit: "⚙️ Cài Đặt Dự Án",
    selectVideoLabel: "Chọn file video:",
    multiSpeakerLabel: "👥 Nhận diện nhiều người nói (Tự gán giọng Nam / Nữ)",
    multiSpeakerHint: "Tự động phân tích cao độ giọng nói để nhận diện giọng Nam / Nữ trong video phỏng vấn, đối thoại.",
    multiSpeakerTitle: "Tự động nhận diện nhiều người nói và gán giọng Nam/Nữ",
    voiceMaleLabel: "👨 Giọng Nam:",
    voiceFemaleLabel: "👩 Giọng Nữ:",
    badgeMultiSpeaker: "👥 Đa giọng Nam/Nữ",
    speakerMale: "👨 Nam",
    speakerFemale: "👩 Nữ",
    toggleSpeakerHint: "Bấm để đổi giọng Nam ⇄ Nữ cho câu này",
    settingsBtn: "⚙️ Cài đặt",
    saveSettingsBtn: "Lưu cài đặt",
    resetProjectBtn: "🔄 Chạy lại từ đầu",
    resetProjectTitle: "Hủy và xóa dữ liệu trung gian để chạy lại toàn bộ từ bước 1",
    confirmReset: "Bạn có chắc muốn HỦY và CHẠY LẠI TỪ ĐẦU dự án \"{0}\"? Toàn bộ bản dịch và audio hiện tại sẽ bị xóa để xử lý lại từ bước 1.",
    toastResetSuccess: "Đã reset dự án về bước 1 thành công!",
    lockedSettingsHint: "🔒 Ngôn ngữ nguồn và Chế độ nhiều người nói không thể đổi sau khi đã bắt đầu xử lý. Hãy dùng nút 'Chạy lại từ đầu' nếu muốn thay đổi.",
    startProcessBtn: "Bắt đầu xử lý",
    cancelBtn: "Hủy",
    toastSettingsSaved: "Đã lưu cài đặt dự án thành công!",
    mixSettingsSummary: "🎛️ Thiết lập phối âm nền & Ducking",
    btnMixSettings: "⚙️ Cài đặt âm lượng",
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
    status_ready: "Sẵn sàng",
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
    stepMux: "7. Ghép video",
    descReview: "Dịch xong · Đang dừng để bạn duyệt bản dịch",
    descReviewAudioBeforeMux: "Phối âm xong · Hãy nghe thử audio trước khi bấm ghép vào video",
    descCompleted: "Hoàn tất toàn bộ tiến trình · Đã tạo xong file",
    descProcessing: "Đang xử lý: {0} {1} - {2}%",
    descPercentDone: "{0}% hoàn thành",
    timerElapsed: "⏱️ Đã chạy: {0}",
    timerRemaining: "⏳ Còn ~{0} ({1})",
    timerReadyEst: "⏳ Dự kiến: ~{0}",
    timerPausedReview: "⏸️ Chờ duyệt bản dịch",
    timerPausedReviewMux: "⏸️ Chờ nghe thử audio",
    timerElapsedTooltip: "Thời gian đã thực hiện: {0}",
    timerEstTooltip: "Dự kiến hoàn thành dựa trên khối lượng câu trích xuất: {0}",
    muxVideoLabel: "🎬 Ghép audio vào video gốc (Thay audio gốc)",
    muxVideoTitle: "Ghép audio thuyết minh mới vào video gốc, thay thế âm thanh cũ",
    muxVideoHint: "Tạo file video hoàn chỉnh có hình ảnh gốc và lời thuyết minh tiếng Việt.",
    pauseBeforeMuxLabel: "⏸️ Dừng nghe thử audio trước khi ghép vào video",
    pauseBeforeMuxTitle: "Dừng lại sau khi phối âm để nghe thử audio trước khi ghép vào video",
    pauseBeforeMuxHint: "Sau khi phối âm xong sẽ dừng để bạn nghe thử; ưng ý mới bấm nút ghép vào video.",
    autoTrimOverflowLabel: "✂️ AI tự cắt nếu vượt hơn:",
    autoTrimOverflowTitle: "Tự động rút gọn các câu nói vượt quá tỷ lệ thời lượng quy định",
    autoTrimOverflowHint: "Khi câu thoại có thời lượng vượt quá % chỉ định (ví dụ 120%), hệ thống sẽ tự động cắt/rút gọn số từ để thời lượng nói giảm xuống dưới ngưỡng an toàn.",
    uploadProgressLabel: "📤 Đang tải video lên máy chủ...",
    audioReviewBannerTitle: "🎧 Đã phối âm xong — Hãy nghe thử trước khi ghép video!",
    audioReviewBannerDesc: "Audio thuyết minh & phối âm đã hoàn tất. Bạn có thể nghe thử ở trình phát bên dưới hoặc chỉnh âm lượng / remix. Khi ưng ý, bấm nút bên phải để xuất video hoàn chỉnh:",
    muxVideoBtn: "Ghép vào video gốc",
    remuxVideoBtn: "Ghép lại vào video",
    dlDubbedVideo: "🎬 Tải Video Thuyết Minh (MP4)",
    dlDubbedVideoDesc: "Hình ảnh gốc + âm thanh thuyết minh tiếng Việt mới",
    badgeDubbedVideo: "🎬 Video Thuyết Minh Tiếng Việt (Audio Mới)",
    badgeOriginalVideo: "🌐 Video Gốc",
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
    ratioAll: "Tất cả vượt (> 100%)",
    ratio110: "Vượt ≥ 110% (+10%)",
    ratio120: "Vượt ≥ 120% (+20%)",
    ratio130: "Vượt ≥ 130% (+30%)",
    ratio150: "Vượt ≥ 150% (+50%)",
    ratio200: "Vượt ≥ 200% (Gấp đôi)",
    tabTopVoices: "⭐ Đề xuất ({0})",
    tabBuiltinVoices: "🏙️ Giọng hệ thống ({0})",
    tabClonedVoices: "🎙️ Giọng nhân bản ({0})",
    noTopVoices: "Chưa có giọng nào trong Đề xuất hàng đầu. Bấm \"☆ Đề xuất\" ở bất kỳ giọng nào để ghim lên đầu!",
    voiceStarActive: "⭐ Đã đề xuất",
    voiceStarInactive: "☆ Đề xuất",
    voiceStarActiveTitle: "Bỏ đánh dấu khỏi Đề xuất hàng đầu",
    voiceStarInactiveTitle: "Đánh dấu là Đề xuất hàng đầu",
    voiceTopAdded: "Đã thêm \"{0}\" vào Đề xuất hàng đầu!",
    voiceTopRemoved: "Đã bỏ \"{0}\" khỏi Đề xuất hàng đầu!",
    voiceCreatingPreview: "Đang tạo câu đọc thử...",
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
    addProjectBtn: "➕ Add New Video",
    projectModalTitleAdd: "➕ Add New Video & Configure",
    projectModalTitleEdit: "⚙️ Project Settings",
    selectVideoLabel: "Select video file:",
    multiSpeakerLabel: "👥 Multi-speaker detection (Auto-assign Male / Female voices)",
    multiSpeakerHint: "Automatically analyzes pitch to classify Male / Female speakers in interviews or dialogues.",
    multiSpeakerTitle: "Auto-detect multi-speaker and assign Male/Female voices",
    voiceMaleLabel: "👨 Male Voice:",
    voiceFemaleLabel: "👩 Female Voice:",
    badgeMultiSpeaker: "👥 Dual Voices",
    speakerMale: "👨 Male",
    speakerFemale: "👩 Female",
    toggleSpeakerHint: "Click to toggle Male ⇄ Female voice for this segment",
    settingsBtn: "⚙️ Settings",
    saveSettingsBtn: "Save Settings",
    resetProjectBtn: "🔄 Reset & Re-run",
    resetProjectTitle: "Cancel and clear intermediate data to re-run from step 1",
    confirmReset: "Are you sure you want to RESET and RE-RUN project \"{0}\" from the beginning? All current translations and audio will be deleted and re-processed from step 1.",
    toastResetSuccess: "Reset project to step 1 successfully!",
    lockedSettingsHint: "🔒 Source language and Multi-speaker mode cannot be changed once processing has started. Use 'Reset & Re-run' if you wish to change them.",
    startProcessBtn: "Start Processing",
    cancelBtn: "Cancel",
    toastSettingsSaved: "Project settings saved successfully!",
    mixSettingsSummary: "🎛️ Background Audio & Ducking Settings",
    btnMixSettings: "⚙️ Volume Settings",
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
    status_ready: "Ready",
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
    stepMux: "7. Merge Video",
    descReview: "Translation complete · Paused for translation review",
    descReviewAudioBeforeMux: "Mixing complete · Preview audio before merging into video",
    descCompleted: "Pipeline finished · Output files ready",
    descProcessing: "Processing: {0} {1} - {2}%",
    descPercentDone: "{0}% completed",
    timerElapsed: "⏱️ Elapsed: {0}",
    timerRemaining: "⏳ ~{0} left ({1})",
    timerReadyEst: "⏳ Est: ~{0}",
    timerPausedReview: "⏸️ Waiting for review",
    timerPausedReviewMux: "⏸️ Waiting for audio preview",
    timerElapsedTooltip: "Elapsed time: {0}",
    timerEstTooltip: "Estimated completion based on segment workload: {0}",
    muxVideoLabel: "🎬 Merge audio into original video (Replace original audio)",
    muxVideoTitle: "Mux new dubbed audio track into original video, replacing old audio",
    muxVideoHint: "Produces complete dubbed MP4 video with original visuals and Vietnamese audio.",
    pauseBeforeMuxLabel: "⏸️ Pause to listen to audio before merging into video",
    pauseBeforeMuxTitle: "Pause after audio mixing to preview audio before muxing video",
    pauseBeforeMuxHint: "Stops after mixing so you can preview audio; click merge when satisfied.",
    autoTrimOverflowLabel: "✂️ AI auto-trim if exceeding:",
    autoTrimOverflowTitle: "Automatically trim sentences exceeding specified duration percentage",
    autoTrimOverflowHint: "When a sentence duration exceeds the selected percentage (e.g. 120%), the system automatically trims words to bring spoken duration under safe threshold.",
    uploadProgressLabel: "📤 Uploading video to server...",
    audioReviewBannerTitle: "🎧 Mixing complete — Preview audio before merging video!",
    audioReviewBannerDesc: "Audio narration and mixing are ready. Listen below or adjust volumes. When ready, click \"Merge into Video\" to produce the final video:",
    muxVideoBtn: "Merge into Video",
    remuxVideoBtn: "Re-merge Video",
    dlDubbedVideo: "🎬 Download Dubbed Video (MP4)",
    dlDubbedVideoDesc: "Original video visuals + new Vietnamese dubbed audio",
    badgeDubbedVideo: "🎬 Vietnamese Dubbed Video (New Audio)",
    badgeOriginalVideo: "🌐 Original Video",
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
    ratioAll: "All Over-duration (> 100%)",
    ratio110: "Exceeds ≥ 110% (+10%)",
    ratio120: "Exceeds ≥ 120% (+20%)",
    ratio130: "Exceeds ≥ 130% (+30%)",
    ratio150: "Exceeds ≥ 150% (+50%)",
    ratio200: "Exceeds ≥ 200% (2x)",
    tabTopVoices: "⭐ Top Picks ({0})",
    tabBuiltinVoices: "🏙️ System Voices ({0})",
    tabClonedVoices: "🎙️ Cloned Voices ({0})",
    noTopVoices: "No voices marked as Top Recommended yet. Click \"☆ Feature\" on any voice to pin it to top!",
    voiceStarActive: "⭐ Featured",
    voiceStarInactive: "☆ Feature",
    voiceStarActiveTitle: "Unmark as top recommended voice",
    voiceStarInactiveTitle: "Mark as top recommended voice",
    voiceTopAdded: "Added \"{0}\" to Top Recommended voices!",
    voiceTopRemoved: "Removed \"{0}\" from Top Recommended voices!",
    voiceCreatingPreview: "Generating preview...",
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
    "⭐ Giọng nhân bản (Clone)": t('grpClone'),
    "🎙️ Giọng Clone Cá Nhân": t('grpClone'),
    "Giọng khác": t('grpOther')
  };
  return dict[key] || key;
}

const GROUP_ORDER = [
  '⭐ Đề xuất hàng đầu',
  '⭐ Giọng nhân bản (Clone)',
  '🏙️ Miền Bắc',
  '🏖️ Miền Trung',
  '🌴 Miền Nam'
];

function stopPreview(){
  previewRequest++;
  if(previewAudio){previewAudio.pause();previewAudio=null;}
  if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
  if(previewButton){previewButton.textContent=t('listenSnippet');previewButton=null;}
}

async function playSnippet(segment,button){
  if(previewButton===button){stopPreview();return;}
  stopPreview();
  if((drafts.get(segment.id)??segment.translation)!==segment.translation || dirty){
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
  const sortedGroupNames = [
    ...GROUP_ORDER.filter(g => groups[g]),
    ...Object.keys(groups).filter(g => !GROUP_ORDER.includes(g))
  ];
  let matched = false;
  for(const grpName of sortedGroupNames){
    const items = groups[grpName];
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

const VOICE_GENDER_MAP = {
  "Hải Đăng": "male", "Thiện Minh": "male", "Quang Sơn": "male",
  "Thiền Tâm Đức": "male", "Adam bựa": "male", "Minh Đức": "male",
  "Phạm Tuyên": "male", "Xuân Vĩnh": "male", "Thanh Bình": "male",
  "Quốc Tuấn": "male", "Thái Sơn": "male", "Minh Triết": "male",
  "Đức Trí": "male", "Adam": "male",
  "Mai Anh": "female", "Trúc Ly": "female", "Thùy Dung": "female",
  "Ngọc Huyền": "female", "Ngọc Trân": "female", "Ngọc Linh": "female",
  "Đoan Trang": "female", "Quỳnh Anh": "female", "Thục Đoan": "female",
  "Mỹ Duyên": "female", "Kim Thanh": "female"
};

function populateGenderVoiceSelect(select, targetGender, currentVoice){
  select.replaceChildren();
  const list = cachedVoicesAll.length ? cachedVoicesAll : VOICES.flatMap(g => g.items.map(v => ({...v, group: g.group})));
  const filtered = list.filter(v => {
    const isClone = (v.group && v.group.includes('Clone')) || (v.id && String(v.id).startsWith('clone_'));
    if (isClone) return true;
    const g = VOICE_GENDER_MAP[v.id];
    return targetGender ? (g === targetGender) : true;
  });

  const groups = {};
  for(const v of filtered){
    const grpName = v.group || 'Giọng khác';
    if(!groups[grpName]) groups[grpName] = [];
    groups[grpName].push(v);
  }

  const sortedGroupNames = [
    ...GROUP_ORDER.filter(g => groups[g]),
    ...Object.keys(groups).filter(g => !GROUP_ORDER.includes(g))
  ];

  let matched = false;
  for(const grpName of sortedGroupNames){
    const items = groups[grpName];
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

function updateAllOpenVoiceSelects(){
  const uv = $('#uploadVoice');
  if(uv && current) populateVoiceSelect(uv, uv.value || 'Hải Đăng');
  const single = $('#modalSingleVoice');
  if(single) populateVoiceSelect(single, single.value || 'Hải Đăng');
  const male = $('#modalVoiceMale');
  if(male) populateGenderVoiceSelect(male, 'male', male.value || 'Hải Đăng');
  const female = $('#modalVoiceFemale');
  if(female) populateGenderVoiceSelect(female, 'female', female.value || 'Mai Anh');
  const detailVoice = $('#voice');
  if(detailVoice && current) populateVoiceSelect(detailVoice, current.voice || detailVoice.value || 'Hải Đăng');
}

function buildVoiceSelect(currentVoice){
  const select = el('select');
  select.id = 'voice';
  populateVoiceSelect(select, currentVoice);
  select.onchange = ()=>{
    stopPreview();
    dirty = true;
    if(current){
      current.voice = select.value;
      if(!current.multi_speaker && current.segments){
        for(const s of current.segments){
          s.voice = select.value;
        }
      }
    }
  };
  return select;
}

function el(tag, text, cls) { const e=document.createElement(tag); if(text!==undefined)e.textContent=text; if(cls)e.className=cls; return e; }
function toast(message) { $('#toast').textContent=message; $('#toast').style.display='block'; setTimeout(()=>$('#toast').style.display='none',6000); }
async function api(path, options={}) {
  const url = '/api' + path + (path.includes('?') ? '&' : '?') + '_=' + Date.now();
  const controller = new AbortController();
  const timeoutMs = options.timeout || 15000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const opts = { ...options, signal: controller.signal };
    delete opts.timeout;
    const r = await fetch(url, opts);
    if (!r.ok) {
      let b = await r.json().catch(() => ({detail: r.statusText}));
      throw Error(typeof b.detail === 'string' ? b.detail : JSON.stringify(b.detail));
    }
    return r.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw Error('Yêu cầu máy chủ hết thời gian chờ (Server request timeout)');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
async function act(action) { try {if(action==='generate'){await save();} await api(`/projects/${selected}/${action}`,{method:'POST'}); dirty=false; await refresh(true);}catch(e){toast(e.message);} }

async function save(){
  if(!current)return;
  for(const s of current.segments){if(drafts.has(s.id))s.translation=drafts.get(s.id);}
  const voiceEl = $('#voice');
  const voiceVal = (voiceEl ? voiceEl.value : current.voice) || 'Hải Đăng';
  current.voice = voiceVal;
  if(!current.multi_speaker && current.segments){
    for(const s of current.segments){
      s.voice = voiceVal;
    }
  }
  await api(`/projects/${selected}/segments`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({segments:current.segments,voice:voiceVal})});
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

    if (current && current.multi_speaker) {
      const isFemale = (s.gender === 'female');
      const spkBtn = el('button', isFemale ? t('speakerFemale') : t('speakerMale'), 'speaker-badge ' + (isFemale ? 'speaker-female' : 'speaker-male'));
      spkBtn.title = t('toggleSpeakerHint');
      spkBtn.onclick = () => {
        const newGender = (s.gender === 'female') ? 'male' : 'female';
        s.gender = newGender;
        s.speaker = newGender;
        s.voice = (newGender === 'female') ? (current.voice_female || 'Mai Anh') : (current.voice_male || 'Hải Đăng');
        spkBtn.className = 'speaker-badge ' + (newGender === 'female' ? 'speaker-female' : 'speaker-male');
        spkBtn.textContent = newGender === 'female' ? t('speakerFemale') : t('speakerMale');
        dirty = true;
      };
      actions.append(spkBtn);
    }

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


function formatDurationClock(sec){
  if(isNaN(sec) || sec <= 0) return '00:00';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if(h > 0){
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDurationHuman(sec){
  if(isNaN(sec) || sec <= 0) return '0s';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if(h > 0){
    return `${h}h ${m}p`;
  }
  if(m > 0){
    return `${m}p ${String(s).padStart(2, '0')}s`;
  }
  return `${s}s`;
}

function estimateRemainingSeconds(p){
  if(!p || p.state === 'completed') return 0;
  if(p.state === 'failed' || p.state === 'cancelled') return null;

  const dur = (typeof p.duration === 'number' && p.duration > 0) ? p.duration : 300;

  // Workload: actual or estimated number of speech segments (N)
  let totalSegs = (p.segments && p.segments.length > 0) ? p.segments.length : 0;
  if(!totalSegs && p.progress){
    const match = p.progress.match(/\b\d+\s*\/\s*(\d+)\b/);
    if(match && p.step !== 'stt'){
      const parsedTot = parseInt(match[1], 10);
      if(parsedTot > 0) totalSegs = parsedTot;
    }
  }
  if(!totalSegs){
    totalSegs = Math.max(1, Math.round(dur / 3.8));
  }

  // Realistic benchmarks measured on local GPU runtime:
  // - Extract: ~3s
  // - STT: Faster-Whisper large-v3 takes ~0.14s per second of audio
  // - Translate: Qwen2.5-7B via llama-server takes ~0.65s per segment
  // - TTS: VieNeu v3turbo GPU speech synthesis takes ~0.30s per segment
  // - Export: FFmpeg sync & loudnorm ~5s
  // - Mix: FFmpeg sidechain ducking & mix ~ max(5s, round(dur / 30))
  // - Mux Video: FFmpeg stream copy ~3s
  const T_EXTRACT = 3;
  const T_STT_TOTAL = Math.round(dur * 0.14);
  const T_TRANSLATE_PER_SEG = 0.65;
  const T_TTS_PER_SEG = 0.30;
  const T_EXPORT = 5;
  const T_MIX = Math.max(5, Math.round(dur / 30));
  const T_MUX = (p.mux_video !== 0) ? 3 : 0;

  const step = p.step || 'extract';
  let rem = 0;

  let curStepCount = 0;
  let curStepTotal = 0;
  let curStepRatio = 0;
  if(p.progress){
    const match = p.progress.match(/(\d+)\s*\/\s*(\d+)/);
    if(match){
      curStepCount = parseInt(match[1], 10);
      curStepTotal = parseInt(match[2], 10);
      if(curStepTotal > 0){
        curStepRatio = Math.min(1, curStepCount / curStepTotal);
      }
    }
  }

  if(step === 'extract'){
    const remExtract = (p.state === 'running') ? 1.5 : T_EXTRACT;
    rem = remExtract + T_STT_TOTAL + (totalSegs * T_TRANSLATE_PER_SEG) + (totalSegs * T_TTS_PER_SEG) + T_EXPORT + T_MIX + T_MUX;
  } else if(step === 'stt'){
    let remSTT = T_STT_TOTAL;
    if(curStepTotal > 0 && curStepCount >= 0){
      const remChunks = Math.max(0, curStepTotal - curStepCount);
      remSTT = remChunks * 42;
    } else if(curStepRatio > 0){
      remSTT = Math.max(5, Math.round(T_STT_TOTAL * (1 - curStepRatio)));
    }
    rem = remSTT + (totalSegs * T_TRANSLATE_PER_SEG) + (totalSegs * T_TTS_PER_SEG) + T_EXPORT + T_MIX + T_MUX;
  } else if(step === 'translate' || step === 'condense'){
    let remSegs = totalSegs;
    if(curStepTotal > 0 && curStepCount >= 0){
      remSegs = Math.max(0, curStepTotal - curStepCount);
    }
    rem = (remSegs * T_TRANSLATE_PER_SEG) + (totalSegs * T_TTS_PER_SEG) + T_EXPORT + T_MIX + T_MUX;
  } else if(step === 'tts'){
    let remSegs = totalSegs;
    if(curStepTotal > 0 && curStepCount >= 0){
      remSegs = Math.max(0, curStepTotal - curStepCount);
    }
    rem = (remSegs * T_TTS_PER_SEG) + T_EXPORT + T_MIX + T_MUX;
  } else if(step === 'export'){
    const remExport = (curStepRatio > 0) ? Math.max(1, Math.round(T_EXPORT * (1 - curStepRatio))) : T_EXPORT;
    rem = remExport + T_MIX + T_MUX;
  } else if(step === 'mix'){
    rem = ((p.state === 'running') ? 4 : T_MIX) + T_MUX;
  } else if(step === 'mux'){
    rem = (p.state === 'running') ? 2 : 3;
  } else {
    rem = 5;
  }

  return Math.max(1, Math.round(rem));
}

function updateLiveTiming(){
  const p = current;
  if(!p) return;
  const elapsedEl = $('#pipelineElapsed');
  const etaEl = $('#pipelineEta');
  if(!elapsedEl || !etaEl) return;

  const state = p.state;
  const startedAt = p.started_at;
  const completedAt = p.completed_at;

  // 1. Elapsed timer
  if(state === 'ready' || !startedAt){
    elapsedEl.style.display = 'none';
  } else {
    elapsedEl.style.display = 'inline-flex';
    let elapsedSec = 0;
    if(state === 'completed' && completedAt){
      elapsedSec = Math.max(0, completedAt - startedAt);
    } else {
      elapsedSec = Math.max(0, (Date.now() / 1000) - startedAt);
    }
    elapsedEl.innerHTML = `⏱️ <b>${formatDurationClock(elapsedSec)}</b>`;
    elapsedEl.title = t('timerElapsedTooltip', formatDurationHuman(elapsedSec));
  }

  // 2. ETA / Remaining estimate
  if(state === 'completed'){
    etaEl.style.display = 'inline-flex';
    etaEl.className = 'pipeline-eta completed';
    etaEl.textContent = '✓ ' + t('status_completed');
    etaEl.title = '';
  } else if(state === 'review'){
    etaEl.style.display = 'inline-flex';
    etaEl.className = 'pipeline-eta';
    etaEl.textContent = (p.step === 'mux') ? t('timerPausedReviewMux') : t('timerPausedReview');
    etaEl.title = '';
  } else if(state === 'failed' || state === 'cancelled'){
    etaEl.style.display = 'none';
  } else if(state === 'ready'){
    etaEl.style.display = 'inline-flex';
    etaEl.className = 'pipeline-eta';
    const estSec = estimateRemainingSeconds(p);
    etaEl.textContent = t('timerReadyEst', formatDurationClock(estSec));
    etaEl.title = t('timerEstTooltip', formatDurationHuman(estSec));
  } else {
    etaEl.style.display = 'inline-flex';
    etaEl.className = 'pipeline-eta';
    const remSec = estimateRemainingSeconds(p);
    if(remSec !== null && remSec > 0){
      const finishTime = new Date(Date.now() + remSec * 1000);
      const finishClock = finishTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
      etaEl.textContent = t('timerRemaining', formatDurationClock(remSec), finishClock);
      etaEl.title = t('timerEstTooltip', formatDurationHuman(remSec));
    } else {
      etaEl.textContent = '⏳ ...';
    }
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
  if(p.mux_video !== 0){
    steps.push({key:'mux',name:t('stepMux')});
  }
  const keys=steps.map(s=>s.key);
  const currentIdx=keys.indexOf(p.step);
  const state=p.state;

  let stagePct=0;
  const match=(p.progress||'').match(/(\d+)\s*\/\s*(\d+)/);
  if(match){
    const cur=parseInt(match[1],10),tot=parseInt(match[2],10);
    if(tot>0)stagePct=Math.min(100,Math.round((cur/tot)*100));
  }else if(state==='running'&&(p.step==='extract'||p.step==='mux')){
    stagePct=50;
  }else if(state==='completed'){
    stagePct=100;
  }

  const totalSteps=steps.length;
  let overallPct=0;
  if(state==='completed'){
    overallPct=100;
  }else if(state==='ready'){
    overallPct=0;
  }else if(currentIdx>=0){
    if(state==='review'){
      if(p.step === 'mux'){
        overallPct = Math.round(((totalSteps - 1) / totalSteps) * 100);
      } else {
        overallPct = Math.round((2 / totalSteps) * 100);
      }
    }else{
      overallPct=Math.min(99,Math.round(currentIdx*(100/totalSteps)+stagePct*(1/totalSteps)));
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
    detailDesc=(p.step === 'mux') ? t('descReviewAudioBeforeMux') : t('descReview');
  }else if(state==='completed'){
    detailDesc=t('descCompleted');
  }else if(state==='running'){
    const curName=steps[currentIdx]?steps[currentIdx].name:p.step;
    detailDesc=t('descProcessing', curName, p.progress?`(${p.progress})`:'', stagePct);
  }
  const statusLeft=el('div',undefined,'pipeline-status-left');
  statusLeft.append(el('span',detailDesc,'status-desc'));

  const statusRight=el('div',undefined,'pipeline-status-right');
  const timerSpan=el('span',undefined,'pipeline-timer');
  timerSpan.id='pipelineElapsed';
  const etaSpan=el('span',undefined,'pipeline-eta');
  etaSpan.id='pipelineEta';
  const pctSpan=el('span',t('descPercentDone', overallPct),'percent-text');
  pctSpan.id='pipelinePercent';
  statusRight.append(timerSpan, etaSpan, pctSpan);

  statusRow.append(statusLeft, statusRight);
  barWrapper.append(bar,statusRow);
  card.append(stepsEl,barWrapper);
  setTimeout(updateLiveTiming, 0);
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

  const container = el('div', undefined, 'download-section-container');
  if(p.state === 'review' && p.step === 'mux'){
    const banner = el('div', undefined, 'audio-review-banner');
    const bContent = el('div', undefined, 'audio-review-content');
    bContent.append(
      el('div', t('audioReviewBannerTitle'), 'audio-review-title'),
      el('div', t('audioReviewBannerDesc'), 'audio-review-desc')
    );
    const muxBtn = el('button', '🎬 ' + t('muxVideoBtn'), 'btn-mux-action');
    muxBtn.onclick = () => act('mux');
    banner.append(bContent, muxBtn);
    container.append(banner);
  }

  const card = el('div', undefined, 'download-card');
  const header = el('div', undefined, 'download-header');
  const hLeft = el('div', undefined, 'download-header-left');
  hLeft.append(el('h3', t('dlHeader')));
  if(p.state === 'completed'){
    hLeft.append(el('span', t('dlCompleted'), 'badge-completed'));
  }
  header.append(hLeft);

  const hasDubbed = p.exports.includes('dubbed_video.mp4');
  const hActions = el('div', undefined, 'download-header-actions');
  const muxActionBtn = el('button', '🎬 ' + (hasDubbed ? t('remuxVideoBtn') : t('muxVideoBtn')), hasDubbed ? 'secondary' : 'btn-mux-action');
  muxActionBtn.style.fontSize = '12px';
  muxActionBtn.style.padding = '6px 14px';
  muxActionBtn.onclick = () => act('mux');
  hActions.append(muxActionBtn);
  header.append(hActions);

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
    'dubbed_video.mp4': { label: t('dlDubbedVideo'), primary: true, desc: t('dlDubbedVideoDesc'), dlName: `${stem}_thuyet_minh.mp4` },
    'mixed.mp3': { label: t('dlMixedMp3'), primary: !hasDubbed, desc: t('dlMixedMp3Desc'), dlName: `${stem}_mixed.mp3` },
    'mixed.wav': { label: t('dlMixedWav'), primary: false, desc: t('dlMixedWavDesc'), dlName: `${stem}_mixed.wav` },
    'narration.mp3': { label: t('dlNarrMp3'), primary: false, desc: t('dlNarrMp3Desc'), dlName: `${stem}_thuyet_minh.mp3` },
    'narration.wav': { label: t('dlNarrWav'), primary: false, desc: t('dlNarrWavDesc'), dlName: `${stem}_thuyet_minh.wav` },
    'vi.srt': { label: t('dlViSrt'), primary: false, desc: t('dlViSrtDesc'), dlName: `${stem}_vi.srt` },
    [`${srcLang}.srt`]: { label: t('dlSrcSrt', srcLabel), primary: false, desc: t('dlSrcSrtDesc'), dlName: `${stem}_${srcLang}.srt` },
    'ko.srt': { label: t('dlSrcSrt', t('lang_ko')), primary: false, desc: t('dlSrcSrtDesc'), dlName: `${stem}_ko.srt` },
    'en.srt': { label: t('dlSrcSrt', t('lang_en')), primary: false, desc: t('dlSrcSrtDesc'), dlName: `${stem}_en.srt` },
    'ja.srt': { label: t('dlSrcSrt', t('lang_ja')), primary: false, desc: t('dlSrcSrtDesc'), dlName: `${stem}_ja.srt` }
  };

  const order = ['dubbed_video.mp4', 'mixed.mp3', 'mixed.wav', 'narration.mp3', 'narration.wav', 'vi.srt', `${srcLang}.srt`, 'ko.srt', 'en.srt', 'ja.srt'];
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
  container.append(card);
  return container;
}

function renderMixQuickBar(p){
  const bar = el('div', undefined, 'mix-quick-bar');
  const left = el('div', undefined, 'mix-quick-left');

  const previewBtn = el('button', t('mixPreviewBtn'), 'secondary');
  const remixBtn = el('button', t('mixRemixBtn'), 'secondary');
  const settingsBtn = el('button', t('btnMixSettings'), 'secondary');

  const playerBox = el('div', undefined, 'mix-preview-player');
  playerBox.hidden = true;
  const audioEl = el('audio');
  audioEl.controls = true;
  playerBox.append(audioEl);

  previewBtn.onclick = async () => {
    previewBtn.disabled = true;
    previewBtn.textContent = t('mixPreviewLoading');
    try {
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
      await api(`/projects/${p.id}/remix`, {method: 'POST'});
      toast(t('mixStarted'));
      await refresh(true);
    } catch(err) {
      toast(t('mixRemixErr') + err.message);
    } finally {
      remixBtn.disabled = false;
    }
  };

  settingsBtn.onclick = () => {
    openProjectModal('edit', p);
    const d = $('#modalMixDetails');
    if (d) d.open = true;
  };

  left.append(previewBtn, remixBtn, settingsBtn);
  bar.append(left, playerBox);
  return bar;
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
  if(p.multi_speaker){
    hLeft.append(el('span', t('badgeMultiSpeaker'), 'badge-multi-speaker'));
  }
  heading.append(hLeft);

  const hActions=el('div',undefined,'heading-actions');
  const settingsBtn=el('button',t('settingsBtn'),'btn-settings secondary');
  settingsBtn.onclick=()=>openProjectModal('edit', p);
  const resetBtn=el('button',t('resetProjectBtn'),'btn-warning secondary');
  resetBtn.title=t('resetProjectTitle');
  resetBtn.onclick=async()=>{
    if(!confirm(t('confirmReset', p.name))) return;
    try{
      await api(`/projects/${p.id}/reset`, {method:'POST'});
      dirty = false;
      drafts.clear();
      toast(t('toastResetSuccess'));
      await refresh(true);
    }catch(err){
      toast(err.message);
    }
  };
  const delMainBtn=el('button',t('deleteProjectBtn'),'btn-danger secondary');
  delMainBtn.title=t('deleteProjectBtnTitle');
  delMainBtn.onclick=()=>deleteProject(p);
  hActions.append(settingsBtn, resetBtn, delMainBtn);
  heading.append(hActions);
  w.append(heading);

  const pipelineBox = el('div', undefined, 'pipeline-wrapper');
  pipelineBox.id = 'pipelineBox';
  pipelineBox.append(renderPipeline(p));
  w.append(pipelineBox);

  const dlSec = renderDownloadSection(p);
  if(dlSec) w.append(dlSec);

  const metaP = el('p', t('segmentsCountMeta', p.progress||getStatusLabel(p.state), p.segments.length, time(p.duration)));
  metaP.id = 'segmentsMeta';
  w.append(metaP);
  const hasDubbedVideo = p.exports && p.exports.includes('dubbed_video.mp4');
  if(hasDubbedVideo){
    const videoPill = el('div', undefined, 'video-badge-dubbed');
    videoPill.innerHTML = t('badgeDubbedVideo');
    w.append(videoPill);
  }
  const video=el('video');
  video.controls=true;
  video.preload='metadata';
  video.src = hasDubbedVideo ? `/api/projects/${p.id}/files/dubbed_video.mp4` : `/api/projects/${p.id}/files/source`;
  w.append(video);
  if(p.error)w.append(el('pre',p.error,'error'));

  const actBar=el('div',undefined,'toolbar');
  if(p.state === 'review' && p.step === 'mux'){
    const muxBtn=el('button', '🎬 ' + t('muxVideoBtn'), 'primary btn-mux-action');
    muxBtn.onclick=()=>act('mux');
    actBar.append(muxBtn);
  }
  const editable=['review','failed','completed'].includes(p.state);
  if(editable&&p.segments.length){
    const saveButton=el('button',t('saveTranslationBtn'),'secondary');
    saveButton.onclick=async()=>{try{await save();toast(t('toastSaved'));await refresh(true);}catch(e){toast(e.message);}};
    const generate=el('button', (p.state === 'completed') ? ('🔄 ' + t('saveGenerateBtn')) : t('saveGenerateBtn'), 'primary');
    generate.onclick=()=>act('generate');
    if(!p.multi_speaker){
      const voiceWrap = el('div', undefined, 'toolbar-voice-group');
      const voiceLabel = el('label', '🎙️ ' + t('voiceLabel') + ' ');
      voiceLabel.htmlFor = 'voice';
      const voiceSelect = buildVoiceSelect(p.voice);
      voiceWrap.append(voiceLabel, voiceSelect);
      actBar.append(voiceWrap, saveButton, generate);
    } else {
      actBar.append(saveButton, generate);
    }
  }
  if(['ready'].includes(p.state)){
    const startBtn=el('button', '▶ ' + t('startProcessBtn'), 'primary');
    startBtn.onclick=()=>act('start');
    actBar.append(startBtn);
  }
  if(['running','queued'].includes(p.state)){
    const b=el('button',t('cancelProcessBtn'),'secondary');
    b.onclick=()=>act('cancel');
    actBar.append(b);
  }
  if(['failed','cancelled'].includes(p.state)){
    const b=el('button',t('retryStepBtn'),'secondary');
    b.onclick=()=>act('resume');
    actBar.append(b);
  }
  if(actBar.childNodes.length > 0){
    w.append(actBar);
  }

  w.append(renderMixQuickBar(p));
  if(p.segments.length){
    w.append(el('p',t('segmentHint'),'hint'));

    const warningsMap = new Map((p.warnings||[]).map(x=>[x.id, x]));

    function getSegmentRatio(s) {
      const w = warningsMap.get(s.id);
      const curText = drafts.get(s.id) ?? s.translation ?? '';
      const words = countWords(curText);
      const segDuration = Math.max(0.1, s.end - s.start);
      if (w && w.available_seconds > 0) {
        return w.actual_seconds / w.available_seconds;
      }
      const avail = (w && w.available_seconds) ? w.available_seconds : segDuration;
      const targetWords = Math.max(1, Math.round(avail * 3.5));
      return targetWords > 0 ? (words / targetWords) : 1.0;
    }

    function isSegmentOver(s, minRatio = 1.0) {
      const w = warningsMap.get(s.id);
      const r = getSegmentRatio(s);
      if (minRatio <= 1.0) {
        return Boolean(w || r > 1.0);
      }
      return r >= minRatio;
    }

    let warnRatioThreshold = (p.trim_threshold_pct && p.trim_threshold_pct > 100) ? (p.trim_threshold_pct / 100.0) : 1.0;
    const filterTabs = el('div', undefined, 'filter-tabs');
    const allTab = el('button', t('tabAll', p.segments.length), 'tab-btn' + (!filterWarnings ? ' active' : ''));
    filterTabs.append(allTab);

    const warnWrap = el('div', undefined, 'warn-filter-group');
    const warnTab = el('button', t('tabWarning', 0), 'tab-btn warning-tab' + (filterWarnings ? ' active' : ''));
    
    const ratioSelect = el('select', undefined, 'warn-ratio-select');
    const ratioOpts = [
      {val: 1.0, text: t('ratioAll')},
      {val: 1.1, text: t('ratio110')},
      {val: 1.2, text: t('ratio120')},
      {val: 1.3, text: t('ratio130')},
      {val: 1.5, text: t('ratio150')},
      {val: 2.0, text: t('ratio200')}
    ];
    for (const ro of ratioOpts) {
      const opt = el('option', ro.text);
      opt.value = ro.val;
      if (Math.abs(ro.val - warnRatioThreshold) < 0.01) {
        opt.selected = true;
      }
      ratioSelect.append(opt);
    }
    ratioSelect.onchange = () => {
      warnRatioThreshold = parseFloat(ratioSelect.value) || 1.0;
      filterWarnings = true;
      page = 0;
      show();
    };
    warnWrap.append(warnTab, ratioSelect);
    filterTabs.append(warnWrap);

    const aiCondenseBtn = el('button', '', 'tab-btn ai-condense-btn');
    aiCondenseBtn.title = t('tabAiCondenseTitle');
    aiCondenseBtn.onclick = async () => {
      const list = getVisibleSegments();
      const pageTargets = list.slice(page * 40, (page + 1) * 40).filter(s => isSegmentOver(s, warnRatioThreshold));
      if (!pageTargets.length) {
        toast('Không có câu nào cần thu gọn trên trang này.');
        return;
      }
      const targetIds = pageTargets.map(s => s.id);
      aiCondenseBtn.disabled = true;
      aiCondenseBtn.textContent = t('aiCondensing');
      try {
        await save();
        await api(`/projects/${p.id}/condense`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ segment_ids: targetIds })
        });
        toast(t('toastAiCondenseQueued') + ` (${targetIds.length} câu trên trang này)`);
        await refresh(true);
      } catch(err) {
        toast(err.message);
      } finally {
        aiCondenseBtn.disabled = false;
        show();
      }
    };

    const trimBtn = el('button', '', 'tab-btn auto-trim-btn');
    trimBtn.title = t('tabAutoTrimTitle');
    trimBtn.onclick = () => {
      const list = getVisibleSegments();
      const pageTargets = list.slice(page * 40, (page + 1) * 40).filter(s => isSegmentOver(s, warnRatioThreshold));
      if (!pageTargets.length) {
        toast('Không có câu nào cần cắt từ trên trang này.');
        return;
      }
      let trimmed = 0;
      for (const s of pageTargets) {
        const w = warningsMap.get(s.id);
        const curText = drafts.get(s.id) ?? s.translation ?? '';
        const words = curText.trim().split(/\s+/).filter(Boolean);
        const segDuration = Math.max(0.1, s.end - s.start);
        const availableSec = (w && w.available_seconds) ? w.available_seconds : segDuration;
        const allowedSec = availableSec * Math.max(1.0, warnRatioThreshold);
        const targetMax = Math.max(1, Math.round(allowedSec * 3.4));
        if (words.length > targetMax) {
          drafts.set(s.id, words.slice(0, targetMax).join(' '));
          dirty = true;
          trimmed++;
        }
      }
      if (trimmed > 0) {
        toast(t('autoTrimSuccess', trimmed));
        show();
      } else {
        toast(t('autoTrimAllSafe'));
      }
    };

    if (editable) {
      filterTabs.append(aiCondenseBtn, trimBtn);
    }
    w.append(filterTabs);

    const pages=el('div',undefined,'pages'), prev=el('button','←','secondary'), next=el('button','→','secondary'), counter=el('span');
    const rows=el('div',undefined,'segments');

    function getVisibleSegments(){
      if (!filterWarnings) return p.segments;
      return p.segments.filter(s => isSegmentOver(s, warnRatioThreshold));
    }

    function show(){
      const list = getVisibleSegments();
      const maxPage = Math.max(1, Math.ceil(list.length / 40));
      page = Math.max(0, Math.min(page, maxPage - 1));

      allTab.className = 'tab-btn' + (!filterWarnings ? ' active' : '');
      warnTab.className = 'tab-btn warning-tab' + (filterWarnings ? ' active' : '');

      const totalMatchingWarns = p.segments.filter(s => isSegmentOver(s, warnRatioThreshold)).length;
      warnTab.textContent = t('tabWarning', totalMatchingWarns);
      warnTab.style.opacity = totalMatchingWarns === 0 ? '0.6' : '1.0';

      const pageStart = page * 40;
      const pageEnd = (page + 1) * 40;
      const pageList = list.slice(pageStart, pageEnd);
      // ONLY segments on the CURRENT PAGE that exceed ratio:
      const pageTargets = pageList.filter(s => isSegmentOver(s, warnRatioThreshold));

      if (editable) {
        aiCondenseBtn.textContent = t('tabAiCondense', pageTargets.length);
        trimBtn.textContent = t('tabAutoTrim', pageTargets.length);
        aiCondenseBtn.disabled = (pageTargets.length === 0);
        trimBtn.disabled = (pageTargets.length === 0);
        aiCondenseBtn.style.opacity = (pageTargets.length === 0) ? '0.5' : '1.0';
        trimBtn.style.opacity = (pageTargets.length === 0) ? '0.5' : '1.0';
      }

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

let busySince = 0;

async function refresh(force=false){
  const now = Date.now();
  if(busy){
    if(now - busySince > 15000){
      busy = false;
    } else {
      return;
    }
  }
  busy = true;
  busySince = now;
  try{
    const all = await api('/projects');
    $('#projects').replaceChildren();
    for(const p of all){
      const row = el('div', undefined, 'project-row' + (p.id === selected ? ' active' : ''));
      const b = el('button', p.name, 'project-select-btn');
      b.append(el('small', `${getStatusLabel(p.state) || p.state} · ${p.progress || p.step}`));
      b.onclick = async () => {
        if(dirty && !confirm(t('confirmDiscardChanges'))) return;
        selected = p.id;
        page = 0;
        dirty = false;
        drafts.clear();
        filterWarnings = false;
        await refresh(true);
      };
      const delBtn = el('button', '🗑️', 'project-del-btn');
      delBtn.title = t('deleteProjectTitle');
      delBtn.onclick = (e) => { e.stopPropagation(); deleteProject(p); };
      row.append(b, delBtn);
      $('#projects').append(row);
    }
    if(!all.length){
      selected = null;
      current = null;
      $('#workspace').innerHTML = `<div class="empty"><span>◉</span><h2>${t('emptyTitle')}</h2><p>${t('emptyDesc')}</p></div>`;
    } else {
      if(!selected || !all.some(x => x.id === selected)) selected = all[0].id;
      if(selected){
        const isRunning = current && current.state === 'running';
        if(!dirty || isRunning){
          const p = await api(`/projects/${selected}`);
          const stateChanged = force || !current || p.id !== current.id || p.state !== current.state;
          const progressChanged = current && (p.progress !== current.progress);
          if(stateChanged){
            current = p;
            render();
          } else if(progressChanged){
            current = p;
            const pb = $('#pipelineBox');
            if(pb) pb.replaceChildren(renderPipeline(p));
            const sm = $('#segmentsMeta');
            if(sm) sm.textContent = t('segmentsCountMeta', p.progress || getStatusLabel(p.state), p.segments.length, time(p.duration));
          }
        }
      }
    }
  }catch(e){toast(e.message);}finally{busy=false;}
}

let projectModalMode = 'create';
let editingProjectId = null;

function updateVoiceOptionsVisibility(isMulti) {
  const multiGroup = $('#modalMultiVoiceGroup');
  const singleGroup = $('#modalSingleVoiceGroup');
  if (multiGroup) {
    multiGroup.hidden = !isMulti;
    multiGroup.style.display = isMulti ? 'grid' : 'none';
  }
  if (singleGroup) {
    singleGroup.hidden = isMulti;
    singleGroup.style.display = isMulti ? 'none' : 'block';
  }
}

const SETTINGS_STORAGE_KEY = 'vietvoice_user_settings_v1';

function loadAllSettingsPreferences() {
  const defaults = {
    sourceLang: localStorage.getItem('vietvoice_pref_source_lang') || 'ko',
    isMulti: localStorage.getItem('vietvoice_pref_multi_speaker') === '1',
    voiceMale: localStorage.getItem('vietvoice_pref_voice_male') || 'Hải Đăng',
    voiceFemale: localStorage.getItem('vietvoice_pref_voice_female') || 'Mai Anh',
    singleVoice: localStorage.getItem('vietvoice_pref_voice') || 'Hải Đăng',
    pauseReview: true,
    fitDuration: true,
    autoFit: true,
    autoTrimOverflow: false,
    trimThresholdPct: 120,
    muxVideo: true,
    pauseBeforeMux: true,
    mixDucking: true,
    mixBg: 25,
    mixNarr: 100,
    mixAtten: 16
  };
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch(e) {}
  return defaults;
}

function saveAllSettingsPreferences(updates) {
  try {
    const cur = loadAllSettingsPreferences();
    const merged = { ...cur, ...updates };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
    if (updates.sourceLang) localStorage.setItem('vietvoice_pref_source_lang', updates.sourceLang);
    if (updates.isMulti !== undefined) localStorage.setItem('vietvoice_pref_multi_speaker', updates.isMulti ? '1' : '0');
    if (updates.voiceMale) localStorage.setItem('vietvoice_pref_voice_male', updates.voiceMale);
    if (updates.voiceFemale) localStorage.setItem('vietvoice_pref_voice_female', updates.voiceFemale);
    if (updates.singleVoice) localStorage.setItem('vietvoice_pref_voice', updates.singleVoice);
  } catch(e) {}
}

function saveVoicePreferences(isMulti, voiceMale, voiceFemale, singleVoice, sourceLang) {
  saveAllSettingsPreferences({ isMulti: !!isMulti, voiceMale, voiceFemale, singleVoice, sourceLang });
}

function loadVoicePreferences() {
  const all = loadAllSettingsPreferences();
  return {
    isMulti: all.isMulti,
    voiceMale: all.voiceMale,
    voiceFemale: all.voiceFemale,
    singleVoice: all.singleVoice,
    sourceLang: all.sourceLang
  };
}

function initProjectModal() {
  const modal = $('#projectModal');
  const addBtn = $('#addProjectBtn');
  const closeBtn = $('#projectModalCloseBtn');
  const cancelBtn = $('#projectModalCancelBtn');
  const submitBtn = $('#projectModalSubmitBtn');
  const multiCb = $('#modalMultiSpeaker');
  const bgRange = $('#modalBgRange');
  const narrRange = $('#modalNarrRange');
  const attenRange = $('#modalAttenRange');
  const muxVideoCb = $('#modalMuxVideo');
  const pauseBeforeMuxCb = $('#modalPauseBeforeMux');
  const autoTrimCb = $('#modalAutoTrimOverflow');
  const autoTrimSelect = $('#modalAutoTrimThreshold');
  const pauseRevCb = $('#modalPauseReview');
  const fitDurCb = $('#modalFitDuration');
  const autoFitCb = $('#modalAutoFit');
  const mixDuckCb = $('#modalMixDucking');

  if (bgRange) bgRange.oninput = () => {
    $('#modalBgVal').textContent = `${bgRange.value}%`;
    saveAllSettingsPreferences({ mixBg: parseFloat(bgRange.value) });
  };
  if (narrRange) narrRange.oninput = () => {
    $('#modalNarrVal').textContent = `${narrRange.value}%`;
    saveAllSettingsPreferences({ mixNarr: parseFloat(narrRange.value) });
  };
  if (attenRange) attenRange.oninput = () => {
    $('#modalAttenVal').textContent = `-${attenRange.value} dB`;
    saveAllSettingsPreferences({ mixAtten: parseFloat(attenRange.value) });
  };

  if (muxVideoCb) {
    muxVideoCb.onchange = () => {
      const group = $('#modalPauseBeforeMuxGroup');
      if (group) group.style.display = muxVideoCb.checked ? 'block' : 'none';
      saveAllSettingsPreferences({ muxVideo: muxVideoCb.checked });
    };
  }
  if (pauseBeforeMuxCb) {
    pauseBeforeMuxCb.onchange = () => {
      saveAllSettingsPreferences({ pauseBeforeMux: pauseBeforeMuxCb.checked });
    };
  }
  if (autoTrimCb) {
    autoTrimCb.onchange = () => {
      saveAllSettingsPreferences({ autoTrimOverflow: autoTrimCb.checked });
    };
  }
  if (autoTrimSelect) {
    autoTrimSelect.onchange = () => {
      saveAllSettingsPreferences({ trimThresholdPct: parseInt(autoTrimSelect.value, 10) || 120 });
    };
  }
  if (pauseRevCb) {
    pauseRevCb.onchange = () => saveAllSettingsPreferences({ pauseReview: pauseRevCb.checked });
  }
  if (fitDurCb) {
    fitDurCb.onchange = () => saveAllSettingsPreferences({ fitDuration: fitDurCb.checked });
  }
  if (autoFitCb) {
    autoFitCb.onchange = () => saveAllSettingsPreferences({ autoFit: autoFitCb.checked });
  }
  if (mixDuckCb) {
    mixDuckCb.onchange = () => saveAllSettingsPreferences({ mixDucking: mixDuckCb.checked });
  }

  if (multiCb) {
    multiCb.onchange = () => {
      const isMulti = multiCb.checked;
      updateVoiceOptionsVisibility(isMulti);
      saveAllSettingsPreferences({ isMulti });
    };
  }

  const voiceSingleEl = $('#modalSingleVoice');
  if (voiceSingleEl) {
    voiceSingleEl.onchange = () => {
      if (voiceSingleEl.value) saveAllSettingsPreferences({ singleVoice: voiceSingleEl.value });
    };
  }

  const voiceMaleEl = $('#modalVoiceMale');
  if (voiceMaleEl) {
    voiceMaleEl.onchange = () => {
      if (voiceMaleEl.value) saveAllSettingsPreferences({ voiceMale: voiceMaleEl.value });
    };
  }

  const voiceFemaleEl = $('#modalVoiceFemale');
  if (voiceFemaleEl) {
    voiceFemaleEl.onchange = () => {
      if (voiceFemaleEl.value) saveAllSettingsPreferences({ voiceFemale: voiceFemaleEl.value });
    };
  }

  const langEl = $('#modalSourceLang');
  if (langEl) {
    langEl.onchange = () => {
      if (langEl.value) saveAllSettingsPreferences({ sourceLang: langEl.value });
    };
  }

  const hide = () => { modal.hidden = true; };
  if (closeBtn) closeBtn.onclick = hide;
  if (cancelBtn) cancelBtn.onclick = hide;
  modal.onclick = (e) => { if (e.target === modal) hide(); };

  if (addBtn) {
    addBtn.onclick = () => openProjectModal('create');
  }

  if (submitBtn) {
    submitBtn.onclick = handleModalSubmit;
  }
}

async function openProjectModal(mode, p = null) {
  projectModalMode = mode;
  editingProjectId = p ? p.id : null;
  const modal = $('#projectModal');
  await fetchVoicesAll();

  const progContainer = $('#modalUploadProgressContainer');
  if (progContainer) progContainer.hidden = true;

  if (mode === 'create') {
    const prefs = loadAllSettingsPreferences();
    $('#projectModalTitle').textContent = t('projectModalTitleAdd');
    $('#modalFileGroup').hidden = false;
    $('#modalFileInput').value = '';
    $('#modalSourceLang').value = prefs.sourceLang;
    $('#modalMultiSpeaker').checked = prefs.isMulti;
    updateVoiceOptionsVisibility(prefs.isMulti);
    $('#modalSourceLang').disabled = false;
    $('#modalMultiSpeaker').disabled = false;
    const lockedHint = $('#modalLockedHint');
    if (lockedHint) lockedHint.hidden = true;

    populateGenderVoiceSelect($('#modalVoiceMale'), 'male', prefs.voiceMale);
    populateGenderVoiceSelect($('#modalVoiceFemale'), 'female', prefs.voiceFemale);
    populateVoiceSelect($('#modalSingleVoice'), prefs.singleVoice);

    $('#modalPauseReview').checked = prefs.pauseReview;
    $('#modalFitDuration').checked = prefs.fitDuration;
    $('#modalAutoFit').checked = prefs.autoFit;
    $('#modalAutoTrimOverflow').checked = prefs.autoTrimOverflow;
    $('#modalAutoTrimThreshold').value = String(prefs.trimThresholdPct || 120);

    $('#modalMuxVideo').checked = prefs.muxVideo;
    $('#modalPauseBeforeMux').checked = prefs.pauseBeforeMux;
    if ($('#modalPauseBeforeMuxGroup')) $('#modalPauseBeforeMuxGroup').style.display = prefs.muxVideo ? 'block' : 'none';

    $('#modalMixDucking').checked = prefs.mixDucking;
    $('#modalBgRange').value = prefs.mixBg;
    $('#modalBgVal').textContent = `${prefs.mixBg}%`;
    $('#modalNarrRange').value = prefs.mixNarr;
    $('#modalNarrVal').textContent = `${prefs.mixNarr}%`;
    $('#modalAttenRange').value = prefs.mixAtten;
    $('#modalAttenVal').textContent = `-${prefs.mixAtten} dB`;

    $('#projectModalSubmitBtn').textContent = t('startProcessBtn');
  } else {
    // edit mode
    $('#projectModalTitle').textContent = t('projectModalTitleEdit');
    $('#modalFileGroup').hidden = true;
    $('#modalSourceLang').value = p.source_language || 'ko';

    const isStarted = !(p.step === 'extract' && (p.state === 'queued' || p.state === 'ready'));
    $('#modalSourceLang').disabled = isStarted;
    $('#modalMultiSpeaker').disabled = isStarted;
    const lockedHint = $('#modalLockedHint');
    if (lockedHint) lockedHint.hidden = !isStarted;

    const isMulti = (p.multi_speaker === 1);
    $('#modalMultiSpeaker').checked = isMulti;
    updateVoiceOptionsVisibility(isMulti);

    populateGenderVoiceSelect($('#modalVoiceMale'), 'male', p.voice_male || 'Hải Đăng');
    populateGenderVoiceSelect($('#modalVoiceFemale'), 'female', p.voice_female || 'Mai Anh');
    populateVoiceSelect($('#modalSingleVoice'), p.voice || 'Hải Đăng');

    $('#modalPauseReview').checked = (p.pause_review !== 0);
    $('#modalFitDuration').checked = (p.fit_duration !== 0);
    $('#modalAutoFit').checked = (p.auto_fit !== 0);
    $('#modalAutoTrimOverflow').checked = (p.auto_trim_overflow === 1);
    $('#modalAutoTrimThreshold').value = String(p.trim_threshold_pct || 120);

    const muxFlag = (p.mux_video !== 0);
    $('#modalMuxVideo').checked = muxFlag;
    $('#modalPauseBeforeMux').checked = (p.pause_before_mux !== 0);
    if ($('#modalPauseBeforeMuxGroup')) $('#modalPauseBeforeMuxGroup').style.display = muxFlag ? 'block' : 'none';

    $('#modalMixDucking').checked = (p.mix_ducking !== 0);
    const bg = Math.round((p.mix_background_gain ?? 0.25) * 100);
    $('#modalBgRange').value = bg;
    $('#modalBgVal').textContent = `${bg}%`;

    const narr = Math.round((p.mix_narration_gain ?? 1.0) * 100);
    $('#modalNarrRange').value = narr;
    $('#modalNarrVal').textContent = `${narr}%`;

    const atten = Math.round(p.mix_ducking_attenuation ?? 16);
    $('#modalAttenRange').value = atten;
    $('#modalAttenVal').textContent = `-${atten} dB`;

    $('#projectModalSubmitBtn').textContent = t('saveSettingsBtn');
  }

  modal.hidden = false;
}

async function handleModalSubmit() {
  const submitBtn = $('#projectModalSubmitBtn');
  const modal = $('#projectModal');
  const isMulti = $('#modalMultiSpeaker').checked ? 1 : 0;
  const voiceMale = $('#modalVoiceMale').value || 'Hải Đăng';
  const voiceFemale = $('#modalVoiceFemale').value || 'Mai Anh';
  const singleVoice = $('#modalSingleVoice').value || 'Hải Đăng';
  const pauseReview = $('#modalPauseReview').checked;
  const fitDuration = $('#modalFitDuration').checked;
  const autoFit = $('#modalAutoFit').checked;
  const autoTrimOverflow = $('#modalAutoTrimOverflow').checked ? 1 : 0;
  const trimThresholdPct = parseInt($('#modalAutoTrimThreshold').value, 10) || 120;
  const muxVideo = $('#modalMuxVideo').checked ? 1 : 0;
  const pauseBeforeMux = $('#modalPauseBeforeMux').checked ? 1 : 0;
  const mixDucking = $('#modalMixDucking').checked ? 1 : 0;
  const mixBg = parseFloat($('#modalBgRange').value) / 100.0;
  const mixNarr = parseFloat($('#modalNarrRange').value) / 100.0;
  const mixAtten = parseFloat($('#modalAttenRange').value);

  saveAllSettingsPreferences({
    isMulti: !!isMulti,
    voiceMale,
    voiceFemale,
    singleVoice,
    sourceLang: $('#modalSourceLang').value || 'ko',
    pauseReview,
    fitDuration,
    autoFit,
    autoTrimOverflow: !!autoTrimOverflow,
    trimThresholdPct,
    muxVideo: !!muxVideo,
    pauseBeforeMux: !!pauseBeforeMux,
    mixDucking: !!mixDucking,
    mixBg: parseFloat($('#modalBgRange').value),
    mixNarr: parseFloat($('#modalNarrRange').value),
    mixAtten
  });

  if (projectModalMode === 'create') {
    const file = $('#modalFileInput').files[0];
    if (!file) {
      toast(t('toastSelectVideoFirst'));
      return;
    }
    const form = new FormData();
    form.append('file', file);
    form.append('source_language', $('#modalSourceLang').value || 'ko');
    form.append('multi_speaker', isMulti ? '1' : '0');
    form.append('voice_male', voiceMale);
    form.append('voice_female', voiceFemale);
    form.append('voice', isMulti ? voiceMale : singleVoice);
    form.append('pause_review', pauseReview ? '1' : '0');
    form.append('fit_duration', fitDuration ? '1' : '0');
    form.append('auto_fit', autoFit ? '1' : '0');
    form.append('auto_trim_overflow', String(autoTrimOverflow));
    form.append('trim_threshold_pct', String(trimThresholdPct));
    form.append('mux_video', String(muxVideo));
    form.append('pause_before_mux', String(pauseBeforeMux));
    form.append('mix_ducking', String(mixDucking));
    form.append('mix_background_gain', String(mixBg));
    form.append('mix_narration_gain', String(mixNarr));
    form.append('mix_ducking_attenuation', String(mixAtten));

    submitBtn.disabled = true;
    const progContainer = $('#modalUploadProgressContainer');
    const progressEl = $('#modalUploadProgress');
    const percentText = $('#modalUploadPercentText');
    if (progContainer) progContainer.hidden = false;
    if (progressEl) { progressEl.hidden = false; progressEl.value = 0; }
    if (percentText) percentText.textContent = '0%';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/projects');
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        if (progressEl) progressEl.value = pct;
        if (percentText) percentText.textContent = `${pct}%`;
      }
    };
    xhr.onload = () => {
      submitBtn.disabled = false;
      if (progContainer) progContainer.hidden = true;
      if (xhr.status < 300) {
        modal.hidden = true;
        const res = JSON.parse(xhr.responseText);
        selected = res.id;
        dirty = false;
        drafts.clear();
        refresh(true);
        toast(t('toastUploadSuccess'));
      } else {
        toast(t('toastUploadErr') + xhr.responseText);
      }
    };
    xhr.onerror = () => {
      submitBtn.disabled = false;
      if (progContainer) progContainer.hidden = true;
      toast(t('toastUploadNetErr'));
    };
    xhr.send(form);
  } else {
    // Edit mode: PATCH
    if (!editingProjectId) return;
    submitBtn.disabled = true;
    try {
      const payload = {
        multi_speaker: isMulti,
        voice_male: voiceMale,
        voice_female: voiceFemale,
        voice: isMulti ? voiceMale : singleVoice,
        pause_review: pauseReview,
        fit_duration: fitDuration,
        auto_fit: autoFit,
        auto_trim_overflow: autoTrimOverflow,
        trim_threshold_pct: trimThresholdPct,
        mix_ducking: mixDucking,
        mix_background_gain: mixBg,
        mix_narration_gain: mixNarr,
        mix_ducking_attenuation: mixAtten,
        mux_video: muxVideo,
        pause_before_mux: pauseBeforeMux
      };
      await api(`/projects/${editingProjectId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      modal.hidden = true;
      toast(t('toastSettingsSaved'));
      await refresh(true);
    } catch (err) {
      toast(err.message);
    } finally {
      submitBtn.disabled = false;
    }
  }
}

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

let currentVoiceLibTab = 'top';

async function loadVoiceLibrary(){
  const listEl = $('#voiceList');
  if(!listEl) return;
  listEl.innerHTML = `<div class="usage-loading">${t('loadingVoices')}</div>`;
  try {
    const allVoices = await api('/voices/all');
    await fetchVoicesAll();
    updateAllOpenVoiceSelects();

    const topVoices = allVoices.filter(v => v.is_top);
    const clonedVoices = allVoices.filter(v => v.is_clone);
    const builtinVoices = allVoices.filter(v => !v.is_clone);

    listEl.replaceChildren();

    const tabBar = el('div', undefined, 'voice-tab-bar');
    const topTabBtn = el('button', t('tabTopVoices', topVoices.length), 'voice-tab-btn' + (currentVoiceLibTab === 'top' ? ' active' : ''));
    const builtinTabBtn = el('button', t('tabBuiltinVoices', builtinVoices.length), 'voice-tab-btn' + (currentVoiceLibTab === 'builtin' ? ' active' : ''));
    const cloneTabBtn = el('button', t('tabClonedVoices', clonedVoices.length), 'voice-tab-btn' + (currentVoiceLibTab === 'clone' ? ' active' : ''));

    topTabBtn.onclick = () => { currentVoiceLibTab = 'top'; renderList(); };
    builtinTabBtn.onclick = () => { currentVoiceLibTab = 'builtin'; renderList(); };
    cloneTabBtn.onclick = () => { currentVoiceLibTab = 'clone'; renderList(); };
    tabBar.append(topTabBtn, builtinTabBtn, cloneTabBtn);
    listEl.append(tabBar);

    const itemsContainer = el('div', undefined, 'voice-items-container');
    listEl.append(itemsContainer);

    function renderList() {
      topTabBtn.className = 'voice-tab-btn' + (currentVoiceLibTab === 'top' ? ' active' : '');
      builtinTabBtn.className = 'voice-tab-btn' + (currentVoiceLibTab === 'builtin' ? ' active' : '');
      cloneTabBtn.className = 'voice-tab-btn' + (currentVoiceLibTab === 'clone' ? ' active' : '');
      itemsContainer.replaceChildren();

      let targetList = [];
      if (currentVoiceLibTab === 'top') {
        targetList = allVoices.filter(v => v.is_top);
      } else if (currentVoiceLibTab === 'clone') {
        targetList = clonedVoices;
      } else {
        targetList = builtinVoices;
      }

      if (!targetList.length) {
        let emptyMsg = 'Không có giọng nào.';
        if (currentVoiceLibTab === 'top') emptyMsg = t('noTopVoices');
        else if (currentVoiceLibTab === 'clone') emptyMsg = t('noClonedVoices');
        else emptyMsg = 'Không có giọng mặc định';
        itemsContainer.innerHTML = `<p class="hint-text" style="text-align:center;padding:20px">${emptyMsg}</p>`;
        return;
      }

      for (const v of targetList) {
        const item = el('div', undefined, 'voice-item');
        const info = el('div', undefined, 'voice-info');
        const nameEl = el('div', undefined, 'voice-name');
        nameEl.append(el('span', (v.is_clone ? '🎙️ ' : (v.is_top ? '⭐ ' : '🗣️ ')) + (v.name || v.id)));
        if (v.is_top) {
          nameEl.append(el('span', '⭐ ' + t('grpTop'), 'voice-badge-group badge-top'));
        } else if (v.base_group || v.group) {
          nameEl.append(el('span', v.base_group || v.group, 'voice-badge-group'));
        }
        const metaText = v.is_clone
          ? t('voiceMeta', v.duration, new Date(v.created * 1000).toLocaleDateString())
          : (v.label || v.group || 'Giọng chuẩn hệ thống');
        info.append(nameEl, el('div', metaText, 'voice-meta'));

        const actions = el('div', undefined, 'voice-actions');

        // Star / Top Recommended toggle button
        const starBtn = el('button', v.is_top ? t('voiceStarActive') : t('voiceStarInactive'), 'voice-btn-sm voice-star-btn' + (v.is_top ? ' active' : ''));
        starBtn.title = v.is_top ? t('voiceStarActiveTitle') : t('voiceStarInactiveTitle');
        starBtn.onclick = async () => {
          starBtn.disabled = true;
          const newIsTop = !v.is_top;
          try {
            await api(`/voices/${encodeURIComponent(v.id)}/top`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ is_top: newIsTop })
            });
            toast(newIsTop ? t('voiceTopAdded', v.name || v.id) : t('voiceTopRemoved', v.name || v.id));
            await loadVoiceLibrary();
          } catch(err) {
            toast(err.message);
            starBtn.disabled = false;
          }
        };
        actions.append(starBtn);

        if (v.is_clone) {
          const sampleBtn = el('button', t('voicePlaySample'), 'voice-btn-sm secondary');
          sampleBtn.onclick = () => {
            stopPreview();
            const a = new Audio(`/api/voices/${v.id}/sample`);
            a.play();
          };
          actions.append(sampleBtn);
        }

        if (v.has_preview) {
          const prevBtn = el('button', t('voicePlayPreview'), 'voice-btn-sm secondary');
          prevBtn.onclick = () => {
            stopPreview();
            const a = new Audio(`/api/voices/${encodeURIComponent(v.id)}/preview?t=${Date.now()}`);
            a.play();
          };
          actions.append(prevBtn);
        }

        const genPrevBtn = el('button', v.has_preview ? '🔄 Tạo lại' : t('voiceGenPreview'), 'voice-btn-sm ' + (v.has_preview ? 'secondary' : ''));
        genPrevBtn.onclick = async () => {
          genPrevBtn.disabled = true;
          genPrevBtn.textContent = t('voiceGenSending');
          try {
            await api(`/voices/${encodeURIComponent(v.id)}/preview`, {method: 'POST'});
            toast(t('voiceGenSuccess', v.name || v.id));
            await refresh(true);
            await loadVoiceLibrary();
          } catch(err) {
            toast(err.message);
            genPrevBtn.disabled = false;
            genPrevBtn.textContent = v.has_preview ? '🔄 Tạo lại' : t('voiceGenPreview');
          }
        };
        actions.append(genPrevBtn);

        if (v.is_clone) {
          const delBtn = el('button', '🗑️', 'voice-btn-sm btn-danger');
          delBtn.title = t('deleteVoiceTitle');
          delBtn.onclick = async () => {
            if(!confirm(t('confirmDeleteVoice', v.name))) return;
            try {
              await api(`/voices/${encodeURIComponent(v.id)}`, {method: 'DELETE'});
              toast(t('toastDeletedVoice', v.name));
              await loadVoiceLibrary();
              await refresh(true);
            } catch(err) {
              if (err.message && err.message.includes('đang được')) {
                if (confirm(`${err.message}\n\nBạn có muốn buộc xóa không? (Các dự án đó sẽ tự động chuyển về giọng mặc định)`)) {
                  try {
                    await api(`/voices/${encodeURIComponent(v.id)}?force=1`, {method: 'DELETE'});
                    toast(t('toastDeletedVoice', v.name));
                    await loadVoiceLibrary();
                    await refresh(true);
                    return;
                  } catch(forceErr) {
                    toast(t('toastCantDeleteVoice') + forceErr.message);
                    return;
                  }
                }
              }
              toast(t('toastCantDeleteVoice') + err.message);
            }
          };
          actions.append(delBtn);
        }

        item.append(info, actions);
        itemsContainer.append(item);
      }
    }

    renderList();
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

  const modalVoiceMale = $('#modalVoiceMale');
  if(modalVoiceMale) populateGenderVoiceSelect(modalVoiceMale, 'male', modalVoiceMale.value || 'Hải Đăng');
  const modalVoiceFemale = $('#modalVoiceFemale');
  if(modalVoiceFemale) populateGenderVoiceSelect(modalVoiceFemale, 'female', modalVoiceFemale.value || 'Mai Anh');
  const modalSingleVoice = $('#modalSingleVoice');
  if(modalSingleVoice) populateVoiceSelect(modalSingleVoice, modalSingleVoice.value || 'Hải Đăng');

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
initProjectModal();
initUsageModal();
initVoiceModal();
refresh();
setInterval(() => refresh(), 3000);
setInterval(updateLiveTiming, 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refresh(true);
});
window.addEventListener('focus', () => refresh(true));
