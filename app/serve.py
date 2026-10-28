import os

from app.core import db

if __name__ == '__main__':
    # Schema setup is owned by runner. API waits instead of resetting live jobs.
    import time
    for _ in range(60):
        try:
            with db() as c:
                c.execute('SELECT id FROM projects LIMIT 1')
            break
        except Exception:
            time.sleep(1)
    else:
        raise RuntimeError('Database not initialized; start vietvoice-worker first')
    import uvicorn
    uvicorn.run('app.main:app', host=os.getenv('HOST', '127.0.0.1'),
                port=int(os.getenv('PORT', '8080')), workers=1)
