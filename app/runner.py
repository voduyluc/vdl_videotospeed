"""One supervised runner owns the GPU; SQLite preserves the queue across restarts."""
import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

from app.core import DATA, ROOT, db, folder, init_db, python_for, read_json, update

stopping = False
child = None


def stop(*_):
    global stopping
    stopping = True
    if child and child.poll() is None:
        try:
            os.killpg(child.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass


def execute(pid, step):
    global child
    # Every stage runs in its own process group, including llama-server children.
    python = python_for(step) if step in ('stt', 'tts') else sys.executable
    module = 'app.model_worker' if step in ('stt', 'tts') else 'app.stage'
    log = folder(pid) / f'{step}.log'
    with log.open('a', encoding='utf-8') as output:
        child = subprocess.Popen([python, '-m', module, step, pid], cwd=ROOT,
                                 stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
        interrupted = False
        while child.poll() is None:
            with db() as c:
                r = c.execute('SELECT cancel FROM projects WHERE id=?', (pid,)).fetchone()
            if not r or r['cancel'] or stopping:
                interrupted = True
                os.killpg(child.pid, signal.SIGTERM)
                try:
                    child.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL)
                    child.wait()
                break
            time.sleep(0.5)
        code = child.wait()
        child = None
    with db() as c:
        exists = c.execute('SELECT 1 FROM projects WHERE id=?', (pid,)).fetchone()
    if not exists:
        return False
    if interrupted or stopping:
        update(pid, state='queued' if stopping else 'cancelled')
        return False
    if code:
        tail = log.read_text('utf-8', errors='replace')[-4000:]
        update(pid, state='failed', error=tail)
        return False
    return True


def execute_batch(rows, step):
    global child
    ids = [r['id'] for r in rows]
    python = python_for(step) if step in ('stt', 'tts') else sys.executable
    log = folder(ids[0]) / f'{step}.log'
    with log.open('a', encoding='utf-8') as output:
        child = subprocess.Popen([python, '-m', 'app.batch', step, *ids], cwd=ROOT,
                                 stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
        cancelled_ids = []
        while child.poll() is None:
            cancelled_ids = []
            with db() as c:
                for pid in ids:
                    r = c.execute('SELECT cancel FROM projects WHERE id=?', (pid,)).fetchone()
                    if not r or r['cancel']:
                        cancelled_ids.append(pid)
            if stopping or cancelled_ids:
                os.killpg(child.pid, signal.SIGTERM)
                try:
                    child.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL)
                    child.wait()
                break
            time.sleep(0.5)
        code = child.wait()
        child = None
    # Completed jobs keep their committed state. Interrupted jobs resume from cache.
    for pid in ids:
        with db() as c:
            r = c.execute('SELECT * FROM projects WHERE id=?', (pid,)).fetchone()
        if not r:
            continue
        row = dict(r)
        if pid in cancelled_ids:
            update(pid, state='cancelled')
        elif row['state'] == 'running':
            update(pid, state='queued' if stopping or cancelled_ids else 'failed',
                   error=None if stopping or cancelled_ids else log.read_text('utf-8', errors='replace')[-4000:])
        elif code and not stopping and not cancelled_ids and row['state'] == 'queued' and row['step'] == step:
            update(pid, state='failed', error=log.read_text('utf-8', errors='replace')[-4000:])


def main():
    try:
        import fcntl
        from app.core import DATA
        lock = (DATA / 'runner.lock').open('w')
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except (ImportError, AttributeError, OSError):
        pass
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    init_db()
    pipeline_steps = ['extract', 'stt', 'translate', 'tts', 'export', 'mix']
    step_order = {'extract': 0, 'stt': 1, 'translate': 2, 'condense': 3, 'tts': 4, 'export': 5, 'mix': 6}
    while not stopping:
        with db() as c:
            rows = [dict(r) for r in c.execute("SELECT * FROM projects WHERE state='queued' ORDER BY created")]
        # Cancel queued jobs even when another model is currently idle.
        for row in rows:
            if row['cancel']:
                update(row['id'], state='cancelled')
        rows = [r for r in rows if not r['cancel']]
        if not rows:
            time.sleep(1)
            continue
        if os.getenv('QUEUE_MODE', 'file') == 'stage':
            rows.sort(key=lambda r: (step_order.get(r['step'], 99), r['created']))
        row = rows[0]
        pid, step = row['id'], row['step']
        if os.getenv('QUEUE_MODE', 'file') == 'stage' and step in ('stt', 'translate', 'tts'):
            batch = [r for r in rows if r['step'] == step][:32]
            execute_batch(batch, step)
            continue
        update(pid, state='running', error=None, progress=step)
        if execute(pid, step):
            if step == 'translate':
                with db() as c:
                    r = c.execute('SELECT pause_review FROM projects WHERE id=?', (pid,)).fetchone()
                pause = r['pause_review'] if r and 'pause_review' in r.keys() else 1
                if pause:
                    update(pid, state='review', step='tts', progress='Chờ duyệt bản dịch')
                else:
                    update(pid, state='queued', step='tts', progress='Tự động tiếp tục TTS')
            elif step == 'condense':
                update(pid, state='review', step='tts', progress='Đã dùng AI thu gọn câu xong')
            elif step == 'tts' and row.get('name', '').startswith('Voice Preview:'):
                manifest = read_json(folder(pid) / 'tts-manifest.json', [])
                if manifest:
                    preview_wav = Path(manifest[0]['file'])
                    dest = DATA / 'voices' / row['voice'] / 'preview.wav'
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    if preview_wav.exists():
                        shutil.copyfile(preview_wav, dest)
                        with db() as c:
                            c.execute('UPDATE voices SET preview_path=? WHERE id=?', (str(dest), row['voice']))
                update(pid, state='completed', progress='Đã tạo xong câu nghe thử')
            elif step == 'mix':
                update(pid, state='completed', progress='Hoàn tất')
            elif step in pipeline_steps and pipeline_steps.index(step) + 1 < len(pipeline_steps):
                next_step = pipeline_steps[pipeline_steps.index(step) + 1]
                update(pid, state='queued', step=next_step)
            else:
                update(pid, state='completed', progress='Hoàn tất')


if __name__ == '__main__':
    main()
