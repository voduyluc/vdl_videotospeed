import hashlib
import hmac
import os
import secrets
import shutil
import time
from pathlib import Path

from fastapi import Depends, FastAPI, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.core import DATA, ROOT, db, duration, folder, read_json, run, subtitles, tts_key, update, wav_duration, write_json

security = HTTPBasic()


def auth(credentials: HTTPBasicCredentials = Depends(security)):
    password = os.getenv('APP_PASSWORD', '')
    if not password or not (hmac.compare_digest(credentials.username.encode(), b'admin') and
                            hmac.compare_digest(credentials.password.encode(), password.encode())):
        raise HTTPException(401, 'Authentication required', headers={'WWW-Authenticate': 'Basic'})


app = FastAPI(title='Viet Voice Studio', dependencies=[Depends(auth)])


@app.middleware("http")
async def add_no_cache_for_api(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith('/api/'):
        if 'cache-control' not in response.headers:
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
    return response


def project(pid):
    with db() as c:
        row = c.execute('SELECT * FROM projects WHERE id=?', (pid,)).fetchone()
    if not row:
        raise HTTPException(404, 'Project not found')
    return dict(row)


VOICES = [
    {'id': 'Hải Đăng', 'label': 'Hải Đăng (Nam Bắc - Chuẩn/Mặc định)', 'group': '⭐ Đề xuất hàng đầu'},
    {'id': 'Mai Anh', 'label': 'Mai Anh (Nữ Bắc - Tự nhiên)', 'group': '⭐ Đề xuất hàng đầu'},
    {'id': 'Trúc Ly', 'label': 'Trúc Ly (Nữ Nam - Truyền cảm)', 'group': '⭐ Đề xuất hàng đầu'},
    {'id': 'Thiện Minh', 'label': 'Thiện Minh (Nam Bắc - Trầm ấm)', 'group': '⭐ Đề xuất hàng đầu'},
    {'id': 'Thùy Dung', 'label': 'Thùy Dung (Nữ Nam - Dịu dàng)', 'group': '⭐ Đề xuất hàng đầu'},
    {'id': 'Ngọc Huyền', 'label': 'Ngọc Huyền (Nữ Bắc - Nhẹ nhàng)', 'group': '⭐ Đề xuất hàng đầu'},
    {'id': 'Quang Sơn', 'label': 'Quang Sơn (Nam Trung - Truyền cảm)', 'group': '⭐ Đề xuất hàng đầu'},
    {'id': 'Ngọc Trân', 'label': 'Ngọc Trân (Nữ Trung - Ngọt ngào)', 'group': '⭐ Đề xuất hàng đầu'},
    {'id': 'Thiền Tâm Đức', 'label': 'Thiền Tâm Đức (Nam - Phật pháp/Trầm)', 'group': '⭐ Đề xuất hàng đầu'},
    {'id': 'Adam bựa', 'label': 'Adam bựa (Nam - Hài hước/Vlog)', 'group': '⭐ Đề xuất hàng đầu'},
    {'id': 'Minh Đức', 'label': 'Minh Đức (Nam Bắc)', 'group': '🏙️ Miền Bắc'},
    {'id': 'Phạm Tuyên', 'label': 'Phạm Tuyên (Nam Bắc)', 'group': '🏙️ Miền Bắc'},
    {'id': 'Xuân Vĩnh', 'label': 'Xuân Vĩnh (Nam Bắc)', 'group': '🏙️ Miền Bắc'},
    {'id': 'Thanh Bình', 'label': 'Thanh Bình (Nam Bắc)', 'group': '🏙️ Miền Bắc'},
    {'id': 'Quốc Tuấn', 'label': 'Quốc Tuấn (Nam Bắc)', 'group': '🏙️ Miền Bắc'},
    {'id': 'Ngọc Linh', 'label': 'Ngọc Linh (Nữ Bắc)', 'group': '🏙️ Miền Bắc'},
    {'id': 'Đoan Trang', 'label': 'Đoan Trang (Nữ Bắc)', 'group': '🏙️ Miền Bắc'},
    {'id': 'Quỳnh Anh', 'label': 'Quỳnh Anh (Nữ Bắc)', 'group': '🏙️ Miền Bắc'},
    {'id': 'Thái Sơn', 'label': 'Thái Sơn (Nam Nam)', 'group': '🌴 Miền Nam'},
    {'id': 'Minh Triết', 'label': 'Minh Triết (Nam Nam)', 'group': '🌴 Miền Nam'},
    {'id': 'Đức Trí', 'label': 'Đức Trí (Nam Nam)', 'group': '🌴 Miền Nam'},
    {'id': 'Adam', 'label': 'Adam (Nam Nam)', 'group': '🌴 Miền Nam'},
    {'id': 'Thục Đoan', 'label': 'Thục Đoan (Nữ Nam)', 'group': '🌴 Miền Nam'},
    {'id': 'Mỹ Duyên', 'label': 'Mỹ Duyên (Nữ Nam)', 'group': '🌴 Miền Nam'},
    {'id': 'Kim Thanh', 'label': 'Kim Thanh (Nữ Nam)', 'group': '🌴 Miền Nam'},
]


SUPPORTED_LANGUAGES = {'ko': 'Tiếng Hàn', 'en': 'Tiếng Anh', 'ja': 'Tiếng Nhật'}


@app.get('/api/voices')
def list_voices():
    with db() as c:
        clones = [dict(r) for r in c.execute('SELECT * FROM voices ORDER BY created DESC')]
    for r in clones:
        r['has_preview'] = bool(r.get('preview_path') and Path(r['preview_path']).exists())
    return clones


@app.get('/api/voices/all')
def all_voices():
    with db() as c:
        clones = [dict(r) for r in c.execute('SELECT * FROM voices ORDER BY created DESC')]
    clone_items = [
        {'id': v['id'], 'name': v['name'], 'label': f"🎙️ {v['name']} ({v['duration']}s - Clone)", 'group': '⭐ Giọng nhân bản (Clone)', 'is_clone': True,
         'duration': v.get('duration', 0), 'created': v.get('created', 0),
         'has_preview': bool((v.get('preview_path') and Path(v['preview_path']).exists()) or (DATA / 'voices' / v['id'] / 'preview.wav').exists())}
        for v in clones
    ]
    builtin_items = [
        {'id': v['id'], 'name': v['id'], 'label': v['label'], 'group': v['group'], 'is_clone': False,
         'duration': 4.0, 'created': 0,
         'has_preview': (DATA / 'voices' / v['id'] / 'preview.wav').exists()}
        for v in VOICES
    ]
    return clone_items + builtin_items


@app.get('/api/projects')
def projects():
    with db() as c:
        return [dict(r) for r in c.execute("SELECT * FROM projects WHERE name NOT LIKE 'Voice Preview:%' ORDER BY created")]


@app.post('/api/projects')
def upload(file: UploadFile, voice: str = Form(None), pause_review: int = Form(1),
           auto_fit: int = Form(1), source_language: str = Form('ko'),
           fit_duration: int = Form(1), multi_speaker: int = Form(0),
           voice_male: str = Form(None), voice_female: str = Form(None),
           mix_background_gain: float = Form(0.25), mix_narration_gain: float = Form(1.0),
           mix_ducking: int = Form(1), mix_ducking_attenuation: float = Form(16.0)):
    pid = secrets.token_hex(16)
    p = folder(pid)
    limit = int(float(os.getenv('MAX_UPLOAD_GB', '12')) * 1024**3)
    size = 0
    selected_voice = voice.strip() if voice and voice.strip() else os.getenv('TTS_VOICE', 'Hải Đăng')
    v_male = voice_male.strip() if voice_male and voice_male.strip() else 'Hải Đăng'
    v_female = voice_female.strip() if voice_female and voice_female.strip() else 'Mai Anh'
    pause_flag = 1 if int(pause_review) else 0
    auto_fit_flag = 1 if int(auto_fit) else 0
    fit_flag = 1 if int(fit_duration) else 0
    multi_flag = 1 if int(multi_speaker) else 0
    src_lang = (source_language or 'ko').strip().lower()
    if src_lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(400, f'Ngôn ngữ nguồn không hợp lệ. Chỉ hỗ trợ: {", ".join(SUPPORTED_LANGUAGES)}')
    bg_gain = max(0.0, min(3.0, float(mix_background_gain)))
    narr_gain = max(0.0, min(3.0, float(mix_narration_gain)))
    duck_flag = 1 if int(mix_ducking) else 0
    duck_atten = max(2.0, min(30.0, float(mix_ducking_attenuation)))
    try:
        with (p / 'source').open('wb') as out:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(413, 'File exceeds upload limit')
                out.write(chunk)
        if not size:
            raise HTTPException(400, 'Empty file')
        with db() as c:
            c.execute('''INSERT INTO projects(id,name,state,step,created,voice,pause_review,auto_fit,
                        source_language,fit_duration,multi_speaker,voice_male,voice_female,
                        mix_background_gain,mix_narration_gain,mix_ducking,mix_ducking_attenuation)
                        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                      (pid, Path(file.filename or 'Video').name, 'queued', 'extract', time.time(),
                       selected_voice, pause_flag, auto_fit_flag, src_lang, fit_flag,
                       multi_flag, v_male, v_female, bg_gain, narr_gain, duck_flag, duck_atten))
    except Exception:
        shutil.rmtree(p)
        raise
    finally:
        file.file.close()
    return {'id': pid}


@app.get('/api/projects/{pid}')
def detail(pid: str):
    result = project(pid)
    src_lang = result.get('source_language') or 'ko'
    result['source_language'] = src_lang
    result['fit_duration'] = result.get('fit_duration', 1)
    result['multi_speaker'] = result.get('multi_speaker', 0)
    result['voice_male'] = result.get('voice_male', 'Hải Đăng')
    result['voice_female'] = result.get('voice_female', 'Mai Anh')
    result['segments'] = read_json(folder(pid) / 'segments.json', [])
    result['warnings'] = read_json(folder(pid) / 'timing-warnings.json', [])
    result['exports'] = [n for n in ('mixed.mp3', 'mixed.wav', 'narration.wav', 'narration.mp3', f'{src_lang}.srt', 'vi.srt')
                         if (folder(pid) / n).exists()]
    if result['segments']:
        for name in (f'{src_lang}.srt', 'vi.srt'):
            if name not in result['exports']:
                result['exports'].append(name)
    return result


class Segment(BaseModel):
    id: str
    start: float = Field(ge=0)
    end: float = Field(gt=0)
    source: str
    translation: str = Field(max_length=4000)
    gender: str | None = None
    speaker: str | None = None
    voice: str | None = None


class Edit(BaseModel):
    segments: list[Segment]
    voice: str = Field(min_length=1, max_length=100)


@app.put('/api/projects/{pid}/segments')
def edit(pid: str, body: Edit):
    row = project(pid)
    if row['state'] not in ('review', 'completed', 'failed'):
        raise HTTPException(409, 'Pause processing before editing')
    old = read_json(folder(pid) / 'segments.json', [])
    if [s.id for s in body.segments] != [s['id'] for s in old]:
        raise HTTPException(400, 'Segment IDs/order must remain unchanged')
    previous_end = 0
    for s in body.segments:
        if s.end <= s.start or s.start < previous_end or s.end > row['duration'] + 0.1:
            raise HTTPException(400, 'Invalid or overlapping timeline')
        previous_end = s.end
    write_json(folder(pid) / 'segments.json', [s.model_dump() for s in body.segments])
    for name in ('narration.wav', 'narration.mp3', 'ko.srt', 'vi.srt'):
        (folder(pid) / name).unlink(missing_ok=True)
    update(pid, state='review', step='tts', voice=body.voice, error=None)
    return {'ok': True}


class ProjectSettings(BaseModel):
    voice: str | None = Field(default=None, max_length=100)
    voice_male: str | None = Field(default=None, max_length=100)
    voice_female: str | None = Field(default=None, max_length=100)
    multi_speaker: bool | int | None = None
    pause_review: bool | int | None = None
    auto_fit: bool | int | None = None
    fit_duration: bool | int | None = None
    source_language: str | None = None
    mix_background_gain: float | None = None
    mix_narration_gain: float | None = None
    mix_ducking: bool | int | None = None
    mix_ducking_attenuation: float | None = None


@app.patch('/api/projects/{pid}/settings')
def update_settings(pid: str, body: ProjectSettings):
    row = project(pid)
    is_initial = (row['step'] == 'extract' and row['state'] == 'queued')
    values = {}
    if body.voice is not None and body.voice.strip():
        values['voice'] = body.voice.strip()
    if body.voice_male is not None and body.voice_male.strip():
        values['voice_male'] = body.voice_male.strip()
    if body.voice_female is not None and body.voice_female.strip():
        values['voice_female'] = body.voice_female.strip()
    if body.multi_speaker is not None:
        new_multi = 1 if body.multi_speaker else 0
        if new_multi != row.get('multi_speaker', 0) and not is_initial:
            raise HTTPException(400, 'Không thể đổi chế độ nhận diện nhiều người nói khi dự án đã bắt đầu xử lý. Hãy dùng nút "Chạy lại từ đầu" (Reset).')
        values['multi_speaker'] = new_multi
    if body.pause_review is not None:
        values['pause_review'] = 1 if body.pause_review else 0
    if body.auto_fit is not None:
        values['auto_fit'] = 1 if body.auto_fit else 0
    if body.fit_duration is not None:
        values['fit_duration'] = 1 if body.fit_duration else 0
    if body.source_language is not None and body.source_language.strip().lower() in SUPPORTED_LANGUAGES:
        new_lang = body.source_language.strip().lower()
        if new_lang != (row.get('source_language') or 'ko') and not is_initial:
            raise HTTPException(400, 'Không thể đổi ngôn ngữ nguồn khi dự án đã bắt đầu xử lý. Hãy dùng nút "Chạy lại từ đầu" (Reset).')
        values['source_language'] = new_lang
    if body.mix_background_gain is not None:
        values['mix_background_gain'] = max(0.0, min(3.0, float(body.mix_background_gain)))
    if body.mix_narration_gain is not None:
        values['mix_narration_gain'] = max(0.0, min(3.0, float(body.mix_narration_gain)))
    if body.mix_ducking is not None:
        values['mix_ducking'] = 1 if body.mix_ducking else 0
    if body.mix_ducking_attenuation is not None:
        values['mix_ducking_attenuation'] = max(2.0, min(30.0, float(body.mix_ducking_attenuation)))
    if values:
        update(pid, **values)
    return {'ok': True}


class CondenseRequest(BaseModel):
    segment_ids: list[str] | None = None


@app.post('/api/projects/{pid}/condense')
def condense_project(pid: str, body: CondenseRequest | None = None):
    row = project(pid)
    if row['state'] not in ('review', 'completed', 'failed'):
        raise HTTPException(409, 'Chỉ có thể rút gọn câu khi đang ở trạng thái Chờ duyệt hoặc Hoàn tất.')
    target_ids = body.segment_ids if body and body.segment_ids else []
    p = folder(pid)
    write_json(p / 'condense-targets.json', target_ids)
    update(pid, state='queued', step='condense', progress='Đang chờ AI thu gọn câu...')
    return {'ok': True, 'queued': True}


@app.post('/api/projects/{pid}/{action}')
def action(pid: str, action: str):
    row = project(pid)
    if action == 'cancel':
        if row['state'] not in ('running', 'queued'):
            raise HTTPException(409, 'Project is not processing')
        update(pid, cancel=1)
        return {'ok': True}
    if action == 'reset':
        if row['state'] == 'running':
            update(pid, cancel=1)
            for _ in range(15):
                time.sleep(0.2)
                with db() as c:
                    r = c.execute('SELECT state FROM projects WHERE id=?', (pid,)).fetchone()
                if not r or r['state'] != 'running':
                    break
        p_dir = folder(pid)
        for item in p_dir.iterdir():
            if item.name == 'source':
                continue
            if item.is_dir():
                shutil.rmtree(item, ignore_errors=True)
            else:
                try:
                    item.unlink()
                except Exception:
                    pass
        update(pid, state='queued', step='extract', cancel=0, error=None, progress='Chạy lại từ đầu')
        return {'ok': True}
    if action == 'remix':
        if not (folder(pid) / 'narration.wav').exists():
            raise HTTPException(409, 'Cần tạo audio thuyết minh trước khi phối âm')
        update(pid, state='queued', step='mix', cancel=0, error=None, progress='Đang chờ phối âm')
        return {'ok': True}
    if action not in ('resume', 'generate') or row['state'] not in ('review', 'failed', 'cancelled'):
        raise HTTPException(409, 'Action unavailable')
    if action == 'generate':
        segments = read_json(folder(pid) / 'segments.json', [])
        if not segments or any(not s.get('translation', '').strip() for s in segments):
            raise HTTPException(400, 'Every segment needs a translation')
    update(pid, state='queued', cancel=0, error=None,
           step='tts' if action == 'generate' else row['step'])
    return {'ok': True}


@app.delete('/api/projects/{pid}')
def delete_project(pid: str):
    row = project(pid)
    if row['state'] == 'running':
        update(pid, cancel=1)
        for _ in range(15):
            time.sleep(0.2)
            with db() as c:
                r = c.execute('SELECT state FROM projects WHERE id=?', (pid,)).fetchone()
            if not r or r['state'] != 'running':
                break
    with db() as c:
        c.execute('DELETE FROM projects WHERE id=?', (pid,))
    p_folder = DATA / pid
    if p_folder.exists():
        shutil.rmtree(p_folder, ignore_errors=True)
    return {'ok': True}


def get_download_filename(project_name: str, export_name: str, src_lang: str = 'ko') -> str:
    import re
    stem = Path(project_name or 'video').stem
    stem = re.sub(r'[\r\n\t"\'\\/]+', '_', stem).strip() or 'video'
    suffixes = {
        'mixed.mp3': f'{stem}_mixed.mp3',
        'mixed.wav': f'{stem}_mixed.wav',
        'narration.mp3': f'{stem}_thuyet_minh.mp3',
        'narration.wav': f'{stem}_thuyet_minh.wav',
        'vi.srt': f'{stem}_vi.srt',
        'ko.srt': f'{stem}_ko.srt',
        'en.srt': f'{stem}_en.srt',
        'ja.srt': f'{stem}_ja.srt',
    }
    return suffixes.get(export_name, f'{stem}_{export_name}')


@app.get('/api/projects/{pid}/files/{name}')
def asset(pid: str, name: str):
    row = project(pid)
    src_lang = row.get('source_language') or 'ko'
    allowed = ('source', 'mixed.mp3', 'mixed.wav', 'narration.wav', 'narration.mp3', 'vi.srt', f'{src_lang}.srt', 'ko.srt', 'en.srt', 'ja.srt')
    if name not in allowed:
        raise HTTPException(404)
    path = folder(pid) / name
    dl_name = get_download_filename(row.get('name') or 'video', name, src_lang)
    if name.endswith('.srt'):
        segments = read_json(folder(pid) / 'segments.json', [])
        if not segments:
            raise HTTPException(404)
        key = 'translation' if name == 'vi.srt' else 'source'
        return Response(subtitles(segments, key),
                        media_type='application/x-subrip; charset=utf-8',
                        headers={'Content-Disposition': f'attachment; filename="{dl_name}"'})
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path, media_type='video/mp4' if name == 'source' else None,
                        filename=None if name == 'source' else dl_name,
                        headers=None if name == 'source' else {'Content-Disposition': f'attachment; filename="{dl_name}"'})


@app.get('/api/projects/{pid}/mix/preview')
def mix_preview(pid: str, start: float = 0.0, duration: float = 15.0):
    project(pid)
    from app.media import render_mix_preview
    start_sec = max(0.0, float(start))
    dur_sec = min(30.0, max(1.0, float(duration)))
    try:
        preview_path = render_mix_preview(pid, start_sec, dur_sec)
        return FileResponse(preview_path, media_type='audio/wav', headers={'Cache-Control': 'no-store'})
    except Exception as e:
        raise HTTPException(400, f'Lỗi tạo nghe thử mix: {str(e)}')


@app.post('/api/voices')
def create_voice(name: str = Form(...), file: UploadFile = None):
    if not file:
        raise HTTPException(400, 'Thiếu file âm thanh mẫu')
    v_name = name.strip()
    if not v_name:
        raise HTTPException(400, 'Tên giọng không được để trống')
    vid = f"clone_{secrets.token_hex(6)}"
    v_dir = DATA / 'voices' / vid
    v_dir.mkdir(parents=True, exist_ok=True)
    raw_path = v_dir / f"upload_{Path(file.filename or 'sample').name}"
    try:
        size = 0
        with raw_path.open('wb') as out:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > 15 * 1024 * 1024:
                    raise HTTPException(413, 'File mẫu không vượt quá 15 MB')
                out.write(chunk)
        if not size:
            raise HTTPException(400, 'File âm thanh rỗng')
        sample_path = v_dir / 'sample.wav'
        try:
            dur = duration(raw_path)
        except Exception:
            try:
                dur = wav_duration(raw_path)
            except Exception:
                dur = 3.0
        if dur < 1.0:
            raise HTTPException(400, 'File mẫu quá ngắn (tối thiểu 1 giây, đề xuất 3-8 giây)')
        if dur > 60.0:
            raise HTTPException(400, 'File mẫu quá dài (tối đa 60 giây, đề xuất 3-8 giây để đạt chất lượng tốt nhất)')
        try:
            run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', raw_path,
                 '-vn', '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', sample_path])
        except (FileNotFoundError, RuntimeError):
            shutil.copyfile(raw_path, sample_path)
        raw_path.unlink(missing_ok=True)
        version_hash = hashlib.sha256(sample_path.read_bytes()).hexdigest()[:16]
        try:
            norm_dur = round(wav_duration(sample_path), 2)
        except Exception:
            norm_dur = round(dur, 2)
        with db() as c:
            c.execute('INSERT INTO voices(id,name,created,sample_file,version,duration) VALUES(?,?,?,?,?,?)',
                      (vid, v_name, time.time(), str(sample_path), version_hash, norm_dur))
        return {'id': vid, 'name': v_name, 'duration': norm_dur, 'version': version_hash}
    except Exception:
        shutil.rmtree(v_dir, ignore_errors=True)
        raise
    finally:
        file.file.close()


@app.get('/api/voices/{vid}/sample')
def get_voice_sample(vid: str):
    with db() as c:
        row = c.execute('SELECT * FROM voices WHERE id=?', (vid,)).fetchone()
    if not row:
        raise HTTPException(404, 'Không tìm thấy giọng')
    path = Path(row['sample_file'])
    if not path.exists():
        raise HTTPException(404, 'File mẫu không tồn tại trên đĩa')
    return FileResponse(path, media_type='audio/wav')


@app.get('/api/voices/{vid}/preview')
def get_voice_preview(vid: str):
    builtin_voice_ids = {v['id'] for v in VOICES}
    if vid in builtin_voice_ids:
        path = DATA / 'voices' / vid / 'preview.wav'
    else:
        with db() as c:
            row = c.execute('SELECT * FROM voices WHERE id=?', (vid,)).fetchone()
        if not row:
            raise HTTPException(404, 'Không tìm thấy giọng')
        path = Path(row['preview_path']) if row.get('preview_path') else DATA / 'voices' / vid / 'preview.wav'
    if not path.exists():
        raise HTTPException(404, 'Chưa có file nghe thử cho giọng này')
    return FileResponse(path, media_type='audio/wav')


class VoicePreviewBody(BaseModel):
    text: str | None = None


@app.post('/api/voices/{vid}/preview')
def trigger_voice_preview(vid: str, body: VoicePreviewBody = None):
    builtin_voice_ids = {v['id'] for v in VOICES}
    if vid in builtin_voice_ids:
        voice_name = vid
    else:
        with db() as c:
            v_row = c.execute('SELECT * FROM voices WHERE id=?', (vid,)).fetchone()
        if not v_row:
            raise HTTPException(404, 'Không tìm thấy giọng')
        voice_name = v_row['name']
    default_text = f"Xin chào, đây là câu đọc thử nghiệm bằng giọng {voice_name}."
    preview_text = (body.text.strip() if body and body.text and body.text.strip()
                    else default_text)
    preview_pid = secrets.token_hex(16)
    p_dir = folder(preview_pid)
    write_json(p_dir / 'segments.json', [
        {'id': 'seg_00001', 'start': 0.0, 'end': 4.0, 'source': '', 'translation': preview_text}
    ])
    with db() as c:
        c.execute('INSERT INTO projects(id,name,state,step,created,voice,pause_review,auto_fit) VALUES(?,?,?,?,?,?,?,?)',
                  (preview_pid, f"Voice Preview: {voice_name}", 'queued', 'tts', time.time(),
                   vid, 0, 1))
    return {'ok': True, 'task_id': preview_pid}


@app.delete('/api/voices/{vid}')
def delete_voice(vid: str):
    with db() as c:
        v_row = c.execute('SELECT * FROM voices WHERE id=?', (vid,)).fetchone()
        if not v_row:
            raise HTTPException(404, 'Không tìm thấy giọng')
        used = c.execute('SELECT COUNT(*) as cnt FROM projects WHERE voice=?', (vid,)).fetchone()['cnt']
        if used > 0:
            raise HTTPException(400, f'Không thể xóa: Giọng này đang được {used} dự án sử dụng. Hãy đổi giọng dự án trước khi xóa.')
        c.execute('DELETE FROM voices WHERE id=?', (vid,))
    v_dir = DATA / 'voices' / vid
    if v_dir.exists():
        shutil.rmtree(v_dir, ignore_errors=True)
    return {'ok': True}


@app.get('/api/projects/{pid}/segments/{sid}/audio')
def segment_audio(pid: str, sid: str):
    row = project(pid)
    manifest = read_json(folder(pid) / 'tts-manifest.json', [])
    record = next((m for m in manifest if m['id'] == sid), None)
    if record is None:
        raise HTTPException(404, 'Chưa tạo audio cho đoạn này')
    path = Path(record['file']).resolve()
    segment = next((s for s in read_json(folder(pid) / 'segments.json', []) if s['id'] == sid), None)
    if segment is None or path.stem != tts_key(segment['translation'], row['voice']):
        raise HTTPException(409, 'Bản dịch hoặc giọng đã đổi. Hãy tạo lại audio cho đoạn này.')
    if path.parent != (folder(pid) / 'tts').resolve() or not path.exists():
        raise HTTPException(404)
    return FileResponse(path, media_type='audio/wav', headers={'Cache-Control': 'no-store'})


@app.get('/api/usage')
def usage_stats():
    from app.system_info import get_usage
    return get_usage()


@app.get('/')
def index():
    return FileResponse(ROOT / 'web/index.html')


app.mount('/static', StaticFiles(directory=ROOT / 'web'), name='static')
