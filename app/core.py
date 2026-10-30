import hashlib
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env')
DATA = Path(os.getenv('DATA_DIR', str(ROOT / 'data'))).resolve()
DATA.mkdir(parents=True, exist_ok=True)


@contextmanager
def db():
    connection = sqlite3.connect(DATA / 'app.db', timeout=30)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def init_db():
    with db() as c:
        c.execute('PRAGMA journal_mode=WAL')
        c.execute('''CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, state TEXT NOT NULL,
            step TEXT NOT NULL, progress TEXT NOT NULL DEFAULT '',
            error TEXT, duration REAL DEFAULT 0, created REAL NOT NULL,
            voice TEXT NOT NULL, cancel INTEGER DEFAULT 0,
            pause_review INTEGER DEFAULT 1, auto_fit INTEGER DEFAULT 1,
            source_language TEXT DEFAULT 'ko',
            mix_background_gain REAL DEFAULT 0.25,
            mix_narration_gain REAL DEFAULT 1.0,
            mix_ducking INTEGER DEFAULT 1,
            mix_ducking_attenuation REAL DEFAULT 16.0,
            fit_duration INTEGER DEFAULT 1,
            multi_speaker INTEGER DEFAULT 0,
            voice_male TEXT DEFAULT 'Hải Đăng',
            voice_female TEXT DEFAULT 'Mai Anh',
            mux_video INTEGER DEFAULT 1,
            pause_before_mux INTEGER DEFAULT 1,
            auto_trim_overflow INTEGER DEFAULT 0,
            trim_threshold_pct INTEGER DEFAULT 120,
            sort_order REAL DEFAULT 0)''')
        cols = [r['name'] for r in c.execute('PRAGMA table_info(projects)')]
        if 'subtitle_mode' not in cols:
            c.execute("ALTER TABLE projects ADD COLUMN subtitle_mode TEXT NOT NULL DEFAULT 'direct'")
        if 'pause_review' not in cols:
            c.execute('ALTER TABLE projects ADD COLUMN pause_review INTEGER DEFAULT 1')
        if 'auto_fit' not in cols:
            c.execute('ALTER TABLE projects ADD COLUMN auto_fit INTEGER DEFAULT 1')
        if 'fit_duration' not in cols:
            c.execute('ALTER TABLE projects ADD COLUMN fit_duration INTEGER DEFAULT 1')
        if 'multi_speaker' not in cols:
            c.execute('ALTER TABLE projects ADD COLUMN multi_speaker INTEGER DEFAULT 0')
        if 'voice_male' not in cols:
            c.execute("ALTER TABLE projects ADD COLUMN voice_male TEXT DEFAULT 'Hải Đăng'")
        if 'voice_female' not in cols:
            c.execute("ALTER TABLE projects ADD COLUMN voice_female TEXT DEFAULT 'Mai Anh'")
        if 'source_language' not in cols:
            c.execute("ALTER TABLE projects ADD COLUMN source_language TEXT DEFAULT 'ko'")
        if 'mix_background_gain' not in cols:
            c.execute('ALTER TABLE projects ADD COLUMN mix_background_gain REAL DEFAULT 0.25')
        if 'mix_narration_gain' not in cols:
            c.execute('ALTER TABLE projects ADD COLUMN mix_narration_gain REAL DEFAULT 1.0')
        if 'mix_ducking' not in cols:
            c.execute('ALTER TABLE projects ADD COLUMN mix_ducking INTEGER DEFAULT 1')
        if 'mix_ducking_attenuation' not in cols:
            c.execute('ALTER TABLE projects ADD COLUMN mix_ducking_attenuation REAL DEFAULT 16.0')
        if 'started_at' not in cols:
            c.execute('ALTER TABLE projects ADD COLUMN started_at REAL')
        if 'completed_at' not in cols:
            c.execute('ALTER TABLE projects ADD COLUMN completed_at REAL')
        if 'mux_video' not in cols:
            c.execute('ALTER TABLE projects ADD COLUMN mux_video INTEGER DEFAULT 1')
        if 'pause_before_mux' not in cols:
            c.execute('ALTER TABLE projects ADD COLUMN pause_before_mux INTEGER DEFAULT 1')
        if 'auto_trim_overflow' not in cols:
            c.execute('ALTER TABLE projects ADD COLUMN auto_trim_overflow INTEGER DEFAULT 0')
        if 'trim_threshold_pct' not in cols:
            c.execute('ALTER TABLE projects ADD COLUMN trim_threshold_pct INTEGER DEFAULT 120')
        if 'sort_order' not in cols:
            c.execute('ALTER TABLE projects ADD COLUMN sort_order REAL DEFAULT 0')
        c.execute('''CREATE TABLE IF NOT EXISTS voices (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, created REAL NOT NULL,
            sample_file TEXT NOT NULL, version TEXT NOT NULL,
            duration REAL NOT NULL, preview_path TEXT)''')
        c.execute('''CREATE TABLE IF NOT EXISTS voice_favorites (
            voice_id TEXT PRIMARY KEY,
            is_top INTEGER NOT NULL DEFAULT 1)''')
        c.execute('''CREATE TABLE IF NOT EXISTS project_versions (
            project_id TEXT NOT NULL,
            version_id TEXT NOT NULL,
            voice TEXT NOT NULL,
            created_at REAL NOT NULL,
            has_audio INTEGER DEFAULT 0,
            has_video INTEGER DEFAULT 0,
            PRIMARY KEY (project_id, version_id))''')
        (DATA / 'voices').mkdir(exist_ok=True)
        c.execute("UPDATE projects SET state='queued' WHERE state='running'")


def update(pid, **values):
    with db() as c:
        c.execute('UPDATE projects SET ' + ','.join(f'{k}=?' for k in values) + ' WHERE id=?',
                  [*values.values(), pid])


def folder(pid):
    # IDs originate from UUIDs, never from a supplied filesystem path.
    import re
    if not re.fullmatch('[a-f0-9]{32}', pid):
        raise ValueError('Invalid project ID')
    p = DATA / pid
    p.mkdir(exist_ok=True)
    return p


def read_json(path, default=None):
    return json.loads(path.read_text('utf-8')) if path.exists() else default


def write_json(path, value):
    tmp = path.with_suffix(path.suffix + '.tmp')
    text = json.dumps(value, ensure_ascii=False, indent=2)
    tmp.write_text(text, 'utf-8')
    try:
        tmp.replace(path)
    except PermissionError:
        import time
        time.sleep(0.05)
        try:
            tmp.replace(path)
        except PermissionError:
            path.write_text(text, 'utf-8')
            tmp.unlink(missing_ok=True)


def run(args):
    args = list(args)
    if args[0] in ('ffmpeg', 'ffprobe'):
        args[0] = os.getenv(args[0].upper() + '_BIN', args[0])
    result = subprocess.run([str(a) for a in args], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-5000:])
    return result.stdout


def wav_duration(path):
    """Read WAV metadata in-process; handle float WAV from TTS encoders too."""
    import wave
    try:
        with wave.open(str(path), 'rb') as audio:
            return audio.getnframes() / audio.getframerate()
    except wave.Error:
        import soundfile
        info = soundfile.info(str(path))
        return info.frames / info.samplerate


def duration(path):
    path_str = str(path)
    # 0. If it's a WAV file, read metadata directly in-process
    if path_str.lower().endswith('.wav'):
        try:
            val = float(wav_duration(path))
            if val > 0:
                return val
        except Exception:
            pass

    # 1. Try format=duration from container header
    try:
        out = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                   '-of', 'default=noprint_wrappers=1:nokey=1', path_str]).strip()
        if out and out != 'N/A':
            val = float(out)
            if val > 0:
                return val
    except Exception:
        pass

    # 2. Try stream=duration across all streams (video, audio)
    try:
        out = run(['ffprobe', '-v', 'error', '-show_entries', 'stream=duration',
                   '-of', 'default=noprint_wrappers=1:nokey=1', path_str]).strip()
        durations = []
        for line in out.splitlines():
            line = line.strip()
            if line and line != 'N/A':
                try:
                    d = float(line)
                    if d > 0:
                        durations.append(d)
                except ValueError:
                    pass
        if durations:
            return max(durations)
    except Exception:
        pass

    # 3. Try stream tags (e.g. MKV/WebM stores DURATION: 00:01:23.456000000)
    try:
        out = run(['ffprobe', '-v', 'error', '-show_entries', 'stream_tags=DURATION,DURATION-eng',
                   '-of', 'default=noprint_wrappers=1:nokey=1', path_str]).strip()
        for line in out.splitlines():
            line = line.strip()
            if ':' in line:
                parts = line.split(':')
                if len(parts) == 3:
                    try:
                        h, m, s = float(parts[0]), float(parts[1]), float(parts[2])
                        val = h * 3600 + m * 60 + s
                        if val > 0:
                            return val
                    except ValueError:
                        pass
    except Exception:
        pass

    # 4. Fallback: scan container with ffmpeg -c copy -f null -
    try:
        ffmpeg_bin = os.getenv('FFMPEG_BIN', 'ffmpeg')
        proc = subprocess.run(
            [ffmpeg_bin, '-nostdin', '-v', 'info', '-i', path_str,
             '-c', 'copy', '-f', 'null', '-'],
            capture_output=True, text=True, timeout=10
        )
        m_dur = re.search(r'Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)', proc.stderr)
        if m_dur:
            h, m, s = m_dur.groups()
            return float(h) * 3600 + float(m) * 60 + float(s)
        matches = re.findall(r'time=(\d+):(\d+):(\d+(?:\.\d+)?)', proc.stderr)
        if matches:
            last = matches[-1]
            return float(last[0]) * 3600 + float(last[1]) * 60 + float(last[2])
    except Exception:
        pass

    return 0.0


def get_voice_version(voice):
    try:
        with db() as c:
            row = c.execute('SELECT version FROM voices WHERE id=?', (voice,)).fetchone()
        if row and row['version']:
            return row['version']
    except Exception:
        pass
    return 'preset'


def tts_key(text, voice, version=None):
    if version is None:
        version = get_voice_version(voice)
    if version == 'preset':
        payload = text.strip() + '\0' + voice + '\0vieneu-3.8.3-v3turbo'
    else:
        payload = text.strip() + '\0' + voice + '\0' + str(version) + '\0vieneu-3.8.3-v3turbo'
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def python_for(stage):
    env = ROOT / ('.venv-stt' if stage == 'stt' else '.venv-tts')
    return str(env / 'bin/python') if os.name != 'nt' else sys.executable


def stamp(seconds):
    ms = round(seconds * 1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'


def subtitles(segments, language):
    return '\n\n'.join(f"{i}\n{stamp(s['start'])} --> {stamp(s['end'])}\n{s.get(language, '')}"
                       for i, s in enumerate(segments, 1)) + '\n'


def parse_time(time_str: str) -> float:
    time_str = time_str.strip().replace(',', '.')
    parts = time_str.split(':')
    if len(parts) == 3:
        h, m, s = float(parts[0]), float(parts[1]), float(parts[2])
        return h * 3600 + m * 60 + s
    elif len(parts) == 2:
        m, s = float(parts[0]), float(parts[1])
        return m * 60 + s
    return float(time_str)


def parse_srt(content):
    """Parse standard SRT (or WebVTT-like) subtitle text into list of segment dicts."""
    if not content:
        return []
    if isinstance(content, bytes):
        content = content.decode('utf-8', errors='replace')
    content = content.lstrip('\ufeff').replace('\r\n', '\n').replace('\r', '\n')
    blocks = re.split(r'\n\s*\n', content.strip())
    segments = []
    idx = 1
    for block in blocks:
        lines = [l.strip() for l in block.split('\n') if l.strip()]
        if not lines:
            continue
        arrow_line_idx = -1
        for i, line in enumerate(lines):
            if '-->' in line:
                arrow_line_idx = i
                break
        if arrow_line_idx == -1:
            continue
        parts = lines[arrow_line_idx].split('-->')
        if len(parts) != 2:
            continue
        try:
            start = parse_time(parts[0])
            end = parse_time(parts[1].strip().split()[0])
            if end <= start:
                end = start + 1.0
        except Exception:
            continue
        text_lines = lines[arrow_line_idx + 1:]
        clean_text = re.sub(r'<[^>]+>', '', ' '.join(text_lines)).strip()
        if not clean_text:
            continue
        segments.append({
            'id': f's{idx}',
            'start': round(max(0.0, start), 2),
            'end': round(max(start + 0.1, end), 2),
            'text': clean_text
        })
        idx += 1
    return segments


def has_audio_stream(path):
    """Check if the media file contains at least one audio stream."""
    try:
        out = run(['ffprobe', '-v', 'error', '-select_streams', 'a:0',
                   '-show_entries', 'stream=codec_type',
                   '-of', 'default=noprint_wrappers=1:nokey=1', str(path)]).strip()
        return bool(out)
    except Exception:
        return False


def create_silent_wav(path, duration_sec, channels=1, sample_rate=16000):
    """Generate a clean PCM 16-bit silent WAV file with specified duration and channels."""
    import wave
    duration_sec = max(0.5, float(duration_sec or 1.0))
    num_frames = int(round(sample_rate * duration_sec))
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(channels)
        out.setsampwidth(2)
        out.setframerate(sample_rate)
        chunk_frames = min(sample_rate, num_frames)
        chunk_bytes = b'\x00' * (chunk_frames * channels * 2)
        remaining = num_frames
        while remaining > 0:
            to_write = min(remaining, chunk_frames)
            out.writeframes(chunk_bytes[:to_write * channels * 2])
            remaining -= to_write
