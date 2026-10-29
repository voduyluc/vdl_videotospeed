import json
import hashlib
import os
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
            fit_duration INTEGER DEFAULT 1)''')
        cols = [r['name'] for r in c.execute('PRAGMA table_info(projects)')]
        if 'pause_review' not in cols:
            c.execute('ALTER TABLE projects ADD COLUMN pause_review INTEGER DEFAULT 1')
        if 'auto_fit' not in cols:
            c.execute('ALTER TABLE projects ADD COLUMN auto_fit INTEGER DEFAULT 1')
        if 'fit_duration' not in cols:
            c.execute('ALTER TABLE projects ADD COLUMN fit_duration INTEGER DEFAULT 1')
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
        c.execute('''CREATE TABLE IF NOT EXISTS voices (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, created REAL NOT NULL,
            sample_file TEXT NOT NULL, version TEXT NOT NULL,
            duration REAL NOT NULL, preview_path TEXT)''')
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
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2), 'utf-8')
    tmp.replace(path)


def run(args):
    args = list(args)
    if args[0] in ('ffmpeg', 'ffprobe'):
        args[0] = os.getenv(args[0].upper() + '_BIN', args[0])
    result = subprocess.run([str(a) for a in args], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-5000:])
    return result.stdout


def duration(path):
    return float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                      '-of', 'default=noprint_wrappers=1:nokey=1', path]).strip())


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
