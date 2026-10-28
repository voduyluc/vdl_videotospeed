import importlib
import os
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

# A fresh test-only database. Never touch production data or reset its jobs.
temporary = tempfile.TemporaryDirectory(prefix='.testdata-', dir=Path(__file__).resolve().parents[1])
os.environ['DATA_DIR'] = temporary.name
os.environ['APP_PASSWORD'] = 'test-password'

from app import core
from app.main import app
from fastapi.testclient import TestClient
core.init_db()


class ApiTests(unittest.TestCase):
    def setUp(self):
        core.init_db()
        with core.db() as c:
            c.execute('DELETE FROM projects')
        self.client = TestClient(app)
        self.client.auth = ('admin', 'test-password')

    def create(self):
        response = self.client.post('/api/projects', files={'file': ('movie.mp4', b'video', 'video/mp4')})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['id']

    def review(self, pid):
        segments = [{'id': 's1', 'start': 1, 'end': 3, 'source': '안녕하세요', 'translation': 'Xin chào'}]
        core.write_json(core.folder(pid) / 'segments.json', segments)
        core.update(pid, state='review', step='tts', duration=10)
        return segments

    def test_auth_and_upload(self):
        self.assertEqual(TestClient(app).get('/api/projects').status_code, 401)
        pid = self.create()
        self.assertEqual(self.client.get(f'/api/projects/{pid}').json()['state'], 'queued')
        self.assertEqual(self.client.get(f'/api/projects/{pid}/files/app.db').status_code, 404)

    def test_edit_review_generate_and_invalidation(self):
        pid = self.create()
        segments = self.review(pid)
        old = core.folder(pid) / 'narration.mp3'
        old.write_bytes(b'old')
        segments[0]['translation'] = 'Xin chào bạn'
        r = self.client.put(f'/api/projects/{pid}/segments', json={'segments': segments, 'voice': 'Hải Đăng'})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertFalse(old.exists())
        r = self.client.post(f'/api/projects/{pid}/generate')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.get(f'/api/projects/{pid}').json()['step'], 'tts')
        self.assertEqual(self.client.put(f'/api/projects/{pid}/segments', json={
            'segments': segments, 'voice': 'Hải Đăng'}).status_code, 409)

    def test_reject_invalid_timeline_and_ids(self):
        pid = self.create()
        segments = self.review(pid)
        segments[0]['end'] = .5
        self.assertEqual(self.client.put(f'/api/projects/{pid}/segments', json={
            'segments': segments, 'voice': 'Hải Đăng'}).status_code, 400)
        segments[0]['end'] = 3
        segments[0]['id'] = '../escape'
        self.assertEqual(self.client.put(f'/api/projects/{pid}/segments', json={
            'segments': segments, 'voice': 'Hải Đăng'}).status_code, 400)

    def test_subtitles_before_tts(self):
        pid = self.create()
        self.review(pid)
        r = self.client.get(f'/api/projects/{pid}/files/vi.srt')
        self.assertIn('00:00:01,000 --> 00:00:03,000', r.text)
        self.assertIn('Xin chào', r.text)

    def test_restart_recovers_only_running(self):
        pid = self.create()
        core.update(pid, state='running')
        second = self.create()
        core.update(second, state='review')
        core.init_db()
        self.assertEqual(self.client.get(f'/api/projects/{pid}').json()['state'], 'queued')
        self.assertEqual(self.client.get(f'/api/projects/{second}').json()['state'], 'review')

    def test_empty_upload_and_limit(self):
        r = self.client.post('/api/projects', files={'file': ('empty.mp4', b'')})
        self.assertEqual(r.status_code, 400)
        with patch.dict(os.environ, {'MAX_UPLOAD_GB': '0'}):
            r = self.client.post('/api/projects', files={'file': ('large.mp4', b'x')})
        self.assertEqual(r.status_code, 413)

    def test_empty_translation_cannot_generate(self):
        pid = self.create()
        segments = self.review(pid)
        segments[0]['translation'] = ''
        core.write_json(core.folder(pid) / 'segments.json', segments)
        self.assertEqual(self.client.post(f'/api/projects/{pid}/generate').status_code, 400)


class PipelineTests(unittest.TestCase):
    def test_stt_checkpoint_reuse_and_timestamp_normalization(self):
        from app.model_worker import transcribe
        pid = 'e' * 32
        class Speech:
            def __init__(self, start, end, text):
                self.start, self.end, self.text = start, end, text
        class Model:
            calls = 0
            def transcribe(self, *args, **kwargs):
                self.calls += 1
                return iter([Speech(1, 3, '안녕'), Speech(2.8, 4, '하세요')]), None
        model = Model()
        with patch('app.model_worker.duration', return_value=10), patch('app.model_worker.run'):
            transcribe(pid, model)
            transcribe(pid, model)
        self.assertEqual(model.calls, 1)
        rows = core.read_json(core.folder(pid) / 'segments.json')
        self.assertEqual(rows[1]['start'], 3)
        self.assertEqual(rows[1]['id'], 'seg_00002')

    def test_batch_reuses_model_and_isolates_project_failure(self):
        from app.batch import main
        ids = ['f' * 32, 'a' * 32]
        with core.db() as c:
            for pid in ids:
                c.execute('INSERT OR REPLACE INTO projects(id,name,state,step,created,voice) VALUES(?,?,?,?,?,?)',
                          (pid, 'batch', 'queued', 'stt', 0, 'test'))
        model = object()
        seen = []
        def handler(pid, shared):
            seen.append(shared)
            if pid == ids[0]: raise RuntimeError('bad audio')
        with patch('app.model_worker.load_stt', return_value=model) as load, patch(
                'app.model_worker.transcribe', side_effect=handler):
            main('stt', ids)
        load.assert_called_once()
        self.assertEqual(seen, [model, model])
        with core.db() as c:
            first = dict(c.execute('SELECT * FROM projects WHERE id=?', (ids[0],)).fetchone())
            second = dict(c.execute('SELECT * FROM projects WHERE id=?', (ids[1],)).fetchone())
        self.assertEqual(first['state'], 'failed')
        self.assertEqual(second['state'], 'queued')
        self.assertEqual(second['step'], 'translate')

    def test_translation_retry_validation_and_resume(self):
        from app.translate import translate
        pid = 'b' * 32
        segments = [{'id': 's1', 'start': 0, 'end': 2, 'source': '안녕', 'translation': ''}]
        core.write_json(core.folder(pid) / 'segments.json', segments)
        class Result:
            def __init__(self, text): self.text = text
            def raise_for_status(self): pass
            def json(self): return {'choices': [{'message': {'content': self.text}}]}
        class Engine:
            calls = 0
            def post(self, *args, **kwargs):
                self.calls += 1
                return Result('{"translations":[{"id":"wrong","text":"x"}]}' if self.calls == 1
                              else '{"translations":[{"id":"s1","text":"Chào"}]}')
        engine = Engine()
        translate(pid, engine)
        self.assertEqual(engine.calls, 2)
        self.assertEqual(core.read_json(core.folder(pid) / 'segments.json')[0]['translation'], 'Chào')
        translate(pid, engine)
        self.assertEqual(engine.calls, 2)

    def test_tts_cache_survives_restart_and_changes(self):
        from app.model_worker import synthesize
        pid = 'c' * 32
        with core.db() as c:
            c.execute('INSERT OR REPLACE INTO projects(id,name,state,step,created,voice) VALUES(?,?,?,?,?,?)',
                      (pid, 'test', 'running', 'tts', 0, 'Hải Đăng'))
        path = core.folder(pid) / 'segments.json'
        rows = [{'id': 's1', 'start': 0, 'end': 1, 'source': 'a', 'translation': 'Chào'}]
        core.write_json(path, rows)
        class Model:
            calls = 0
            def infer(self, text, voice): self.calls += 1; return b'audio'
            def save(self, audio, path): Path(path).write_bytes(audio)
        model = Model()
        with patch('app.model_worker.duration', return_value=1):
            synthesize(pid, model)
            synthesize(pid, model)
            self.assertEqual(model.calls, 1)
            rows[0]['translation'] = 'Chào bạn'
            core.write_json(path, rows)
            synthesize(pid, model)
            self.assertEqual(model.calls, 2)

    def test_subtitle_rounding(self):
        self.assertEqual(core.stamp(59.9999), '00:01:00,000')
        self.assertEqual(core.stamp(3600.001), '01:00:00,001')

    def test_path_validation(self):
        with self.assertRaises(ValueError): core.folder('../escape')


if __name__ == '__main__':
    unittest.main()
