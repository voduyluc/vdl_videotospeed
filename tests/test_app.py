import os
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

from tests.support import core
from app.main import app
from fastapi.testclient import TestClient


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
        self.assertEqual(r.headers['content-type'], 'application/x-subrip; charset=utf-8')

    def test_segment_preview_rejects_stale_text_and_voice(self):
        pid = self.create()
        segments = self.review(pid)
        p = core.folder(pid)
        (p / 'tts').mkdir()
        key = core.tts_key(segments[0]['translation'], 'Hải Đăng')
        path = p / 'tts' / f'{key}.wav'
        path.write_bytes(b'cached-audio')
        core.write_json(p / 'tts-manifest.json', [{'id': 's1', 'file': str(path), 'duration': 1}])
        url = f'/api/projects/{pid}/segments/s1/audio'
        r = self.client.get(url)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.headers['cache-control'], 'no-store')
        self.assertEqual(self.client.get(f'/api/projects/{pid}/segments/missing/audio').status_code, 404)
        segments[0]['translation'] = 'Chào bạn'
        core.write_json(p / 'segments.json', segments)
        self.assertEqual(self.client.get(url).status_code, 409)
        segments[0]['translation'] = 'Xin chào'
        core.write_json(p / 'segments.json', segments)
        core.update(pid, voice='Mai Anh')
        self.assertEqual(self.client.get(url).status_code, 409)

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

    def test_upload_with_voice_and_pause_review_settings(self):
        r = self.client.post('/api/projects', files={'file': ('movie.mp4', b'video', 'video/mp4')},
                             data={'voice': 'Mai Anh', 'pause_review': '0', 'auto_fit': '1'})
        self.assertEqual(r.status_code, 200)
        pid = r.json()['id']
        proj = self.client.get(f'/api/projects/{pid}').json()
        self.assertEqual(proj['voice'], 'Mai Anh')
        self.assertEqual(proj['pause_review'], 0)
        self.assertEqual(proj['auto_fit'], 1)

    def test_patch_project_settings(self):
        pid = self.create()
        r = self.client.patch(f'/api/projects/{pid}/settings', json={'voice': 'Trúc Ly', 'pause_review': False, 'auto_fit': False})
        self.assertEqual(r.status_code, 200)
        proj = self.client.get(f'/api/projects/{pid}').json()
        self.assertEqual(proj['voice'], 'Trúc Ly')
        self.assertEqual(proj['pause_review'], 0)
        self.assertEqual(proj['auto_fit'], 0)

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

    def test_batch_auto_transitions_to_tts_when_pause_disabled(self):
        from app.batch import main
        pid = 'd' * 32
        with core.db() as c:
            c.execute('INSERT OR REPLACE INTO projects(id,name,state,step,created,voice,pause_review) VALUES(?,?,?,?,?,?,?)',
                      (pid, 'batch-no-pause', 'queued', 'translate', 0, 'test', 0))
        with patch('app.translate.translate'), patch('app.translate.engine'):
            main('translate', [pid])
        with core.db() as c:
            row = dict(c.execute('SELECT * FROM projects WHERE id=?', (pid,)).fetchone())
        self.assertEqual(row['state'], 'queued')
        self.assertEqual(row['step'], 'tts')

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
            def save(self, audio, path):
                with wave.open(str(path), 'wb') as out:
                    out.setnchannels(1)
                    out.setsampwidth(2)
                    out.setframerate(16000)
                    out.writeframes(b'\0\0' * 16000)
        model = Model()
        with patch('app.model_worker.duration', side_effect=AssertionError('TTS must not invoke ffprobe')):
            synthesize(pid, model)
            synthesize(pid, model)
            self.assertEqual(model.calls, 1)
            rows[0]['translation'] = 'Chào bạn'
            core.write_json(path, rows)
            synthesize(pid, model)
            self.assertEqual(model.calls, 2)
        self.assertEqual(core.read_json(core.folder(pid) / 'tts-manifest.json')[0]['duration'], 1)

    def test_translation_markdown_and_thinking(self):
        from app.translate import parse_translation
        payload = '{"translations":[{"id":"s1","text":"Chào"}]}'
        for content in (payload, f'```json\n{payload}\n```', f'```\n{payload}\n```',
                        f'<think>reasoning</think>\n```JSON\r\n{payload}\r\n```'):
            with self.subTest(content=content):
                self.assertEqual(parse_translation(content)[0]['text'], 'Chào')
        with self.assertRaises(ValueError):
            parse_translation('```json\ninvalid\n```')

    def test_subtitle_rounding(self):
        self.assertEqual(core.stamp(59.9999), '00:01:00,000')
        self.assertEqual(core.stamp(3600.001), '01:00:00,001')

    def test_path_validation(self):
        with self.assertRaises(ValueError): core.folder('../escape')


if __name__ == '__main__':
    unittest.main()
