"""Finite stage batch. Reuse one loaded model, while checkpointing each project."""
import sys
import traceback
from contextlib import nullcontext

from app.core import db, update


def main(step, ids):
    if step == 'translate':
        from app.translate import engine, translate
        context = engine()
        handler = translate
    else:
        from app.model_worker import load_stt, load_tts, transcribe, synthesize
        context = nullcontext(load_stt() if step == 'stt' else load_tts())
        handler = transcribe if step == 'stt' else synthesize
    with context as model:
        for pid in ids:
            with db() as c:
                row = c.execute('SELECT state,cancel FROM projects WHERE id=?', (pid,)).fetchone()
            if row['state'] != 'queued' or row['cancel']:
                continue
            update(pid, state='running', progress=step, error=None)
            try:
                handler(pid, model)
                if step == 'translate':
                    update(pid, state='review', step='tts', progress='Chờ duyệt bản dịch')
                else:
                    update(pid, state='queued', step='translate' if step == 'stt' else 'export')
            except Exception:
                update(pid, state='failed', error=traceback.format_exc()[-4000:])


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2:])
