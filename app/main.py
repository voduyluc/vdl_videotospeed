import hmac
import os
import secrets
import shutil
import time
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.core import DATA, ROOT, db, folder, read_json, subtitles, tts_key, update, write_json

security = HTTPBasic()


def auth(credentials: HTTPBasicCredentials = Depends(security)):
    password = os.getenv('APP_PASSWORD', '')
    if not password or not (hmac.compare_digest(credentials.username.encode(), b'admin') and
                            hmac.compare_digest(credentials.password.encode(), password.encode())):
        raise HTTPException(401, 'Authentication required', headers={'WWW-Authenticate': 'Basic'})


app = FastAPI(title='Viet Voice Studio', dependencies=[Depends(auth)])


def project(pid):
    with db() as c:
        row = c.execute('SELECT * FROM projects WHERE id=?', (pid,)).fetchone()
    if not row:
        raise HTTPException(404, 'Project not found')
    return dict(row)


@app.get('/api/projects')
def projects():
    with db() as c:
        return [dict(r) for r in c.execute('SELECT * FROM projects ORDER BY created')]


@app.post('/api/projects')
def upload(file: UploadFile):
    pid = secrets.token_hex(16)
    p = folder(pid)
    limit = int(float(os.getenv('MAX_UPLOAD_GB', '12')) * 1024**3)
    size = 0
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
            c.execute('INSERT INTO projects(id,name,state,step,created,voice) VALUES(?,?,?,?,?,?)',
                      (pid, Path(file.filename or 'Video').name, 'queued', 'extract', time.time(),
                       os.getenv('TTS_VOICE', 'Hải Đăng')))
    except Exception:
        shutil.rmtree(p)
        raise
    finally:
        file.file.close()
    return {'id': pid}


@app.get('/api/projects/{pid}')
def detail(pid: str):
    result = project(pid)
    result['segments'] = read_json(folder(pid) / 'segments.json', [])
    result['warnings'] = read_json(folder(pid) / 'timing-warnings.json', [])
    result['exports'] = [n for n in ('narration.wav', 'narration.mp3', 'ko.srt', 'vi.srt')
                         if (folder(pid) / n).exists()]
    if result['segments']:
        for name in ('ko.srt', 'vi.srt'):
            if name not in result['exports']:
                result['exports'].append(name)
    return result


class Segment(BaseModel):
    id: str
    start: float = Field(ge=0)
    end: float = Field(gt=0)
    source: str
    translation: str = Field(max_length=4000)


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


@app.post('/api/projects/{pid}/{action}')
def action(pid: str, action: str):
    row = project(pid)
    if action == 'cancel':
        if row['state'] not in ('running', 'queued'):
            raise HTTPException(409, 'Project is not processing')
        update(pid, cancel=1)
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


@app.get('/api/projects/{pid}/files/{name}')
def asset(pid: str, name: str):
    project(pid)
    if name not in ('source', 'narration.wav', 'narration.mp3', 'ko.srt', 'vi.srt'):
        raise HTTPException(404)
    path = folder(pid) / name
    if name in ('ko.srt', 'vi.srt'):
        segments = read_json(folder(pid) / 'segments.json', [])
        if not segments:
            raise HTTPException(404)
        return Response(subtitles(segments, 'source' if name == 'ko.srt' else 'translation'),
                        media_type='application/x-subrip; charset=utf-8',
                        headers={'Content-Disposition': f'attachment; filename="{name}"'})
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path, media_type='video/mp4' if name == 'source' else None,
                        filename=None if name == 'source' else name)


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


@app.get('/')
def index():
    return FileResponse(ROOT / 'web/index.html')


app.mount('/static', StaticFiles(directory=ROOT / 'web'), name='static')
