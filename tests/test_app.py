import json
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

    def test_multi_speaker_upload_and_settings(self):
        r = self.client.post('/api/projects', files={'file': ('interview.mp4', b'video', 'video/mp4')},
                             data={'multi_speaker': '1', 'voice_male': 'Hải Đăng', 'voice_female': 'Mai Anh'})
        self.assertEqual(r.status_code, 200)
        pid = r.json()['id']
        proj = self.client.get(f'/api/projects/{pid}').json()
        self.assertEqual(proj['multi_speaker'], 1)
        self.assertEqual(proj['voice_male'], 'Hải Đăng')
        self.assertEqual(proj['voice_female'], 'Mai Anh')

        # Update settings via PATCH
        r_patch = self.client.patch(f'/api/projects/{pid}/settings', json={
            'multi_speaker': 0,
            'voice_male': 'Thiện Minh',
            'voice_female': 'Trúc Ly'
        })
        self.assertEqual(r_patch.status_code, 200)
        proj_updated = self.client.get(f'/api/projects/{pid}').json()
        self.assertEqual(proj_updated['multi_speaker'], 0)
        self.assertEqual(proj_updated['voice_male'], 'Thiện Minh')
        self.assertEqual(proj_updated['voice_female'], 'Trúc Ly')

    def test_settings_constraints_after_processing_started(self):
        pid = self.create()
        self.review(pid)  # Moves project to 'review' state at 'tts' step

        # Changing source_language after processing started must fail with 400
        r_lang = self.client.patch(f'/api/projects/{pid}/settings', json={'source_language': 'en'})
        self.assertEqual(r_lang.status_code, 400)
        self.assertIn('Không thể đổi ngôn ngữ nguồn', r_lang.json()['detail'])

        # Changing multi_speaker after processing started must fail with 400
        r_multi = self.client.patch(f'/api/projects/{pid}/settings', json={'multi_speaker': 1})
        self.assertEqual(r_multi.status_code, 400)
        self.assertIn('Không thể đổi chế độ nhận diện nhiều người nói', r_multi.json()['detail'])

        # But changing voice, mix, or auto_fit settings is still allowed
        r_voice = self.client.patch(f'/api/projects/{pid}/settings', json={
            'voice': 'Thiện Minh',
            'mix_background_gain': 0.35,
            'auto_fit': False
        })
        self.assertEqual(r_voice.status_code, 200)

    def test_reset_action_clears_files_and_restarts_step_1(self):
        pid = self.create()
        self.review(pid)
        p_dir = core.folder(pid)
        (p_dir / 'tts').mkdir(exist_ok=True)
        (p_dir / 'tts' / 'dummy.wav').write_bytes(b'dummy')
        (p_dir / 'narration.wav').write_bytes(b'narration')
        (p_dir / 'stt.wav').write_bytes(b'stt')

        self.assertTrue((p_dir / 'segments.json').exists())
        self.assertTrue((p_dir / 'source').exists())

        r = self.client.post(f'/api/projects/{pid}/reset')
        self.assertEqual(r.status_code, 200)

        # Source must be preserved
        self.assertTrue((p_dir / 'source').exists())
        # Intermediate files must be removed
        self.assertFalse((p_dir / 'segments.json').exists())
        self.assertFalse((p_dir / 'narration.wav').exists())
        self.assertFalse((p_dir / 'stt.wav').exists())
        self.assertFalse((p_dir / 'tts').exists())

        # State must be reset to step 1 (extract, queued)
        proj = self.client.get(f'/api/projects/{pid}').json()
        self.assertEqual(proj['state'], 'queued')
        self.assertEqual(proj['step'], 'extract')

    def test_empty_translation_cannot_generate(self):
        pid = self.create()
        segments = self.review(pid)
        segments[0]['translation'] = ''
        core.write_json(core.folder(pid) / 'segments.json', segments)
        self.assertEqual(self.client.post(f'/api/projects/{pid}/generate').status_code, 400)

    def test_delete_project_cleans_db_and_folder(self):
        pid = self.create()
        p_dir = core.folder(pid)
        self.assertTrue(p_dir.exists())
        r = self.client.delete(f'/api/projects/{pid}')
        self.assertEqual(r.status_code, 200)
        self.assertFalse(p_dir.exists())
        self.assertEqual(self.client.get(f'/api/projects/{pid}').status_code, 404)

    def test_download_filenames_use_original_name_prefix(self):
        pid = self.create()
        self.review(pid)
        # Test subtitles download filename
        r_vi = self.client.get(f'/api/projects/{pid}/files/vi.srt')
        self.assertEqual(r_vi.status_code, 200)
        self.assertIn('movie_vi.srt', r_vi.headers.get('content-disposition', ''))

        r_ko = self.client.get(f'/api/projects/{pid}/files/ko.srt')
        self.assertEqual(r_ko.status_code, 200)
        self.assertIn('movie_ko.srt', r_ko.headers.get('content-disposition', ''))

        # Test audio download filename
        mp3_file = core.folder(pid) / 'narration.mp3'
        mp3_file.write_bytes(b'fake-mp3-bytes')
        r_mp3 = self.client.get(f'/api/projects/{pid}/files/narration.mp3')
        self.assertEqual(r_mp3.status_code, 200)
        self.assertIn('movie_thuyet_minh.mp3', r_mp3.headers.get('content-disposition', ''))

    def test_ui_language_switcher_and_static_assets(self):
        res = self.client.get('/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('id="uiLangSelect"', res.text)
        self.assertIn('data-i18n=', res.text)
        self.assertIn('value="vi"', res.text)
        self.assertIn('value="en"', res.text)

        js_res = self.client.get('/static/app.js')
        self.assertEqual(js_res.status_code, 200)
        self.assertIn('setUiLanguage', js_res.text)
        self.assertIn('vietvoice_ui_lang', js_res.text)

        css_res = self.client.get('/static/style.css')
        self.assertEqual(css_res.status_code, 200)
        self.assertIn('.lang-select', css_res.text)

    def test_usage_stats_endpoint(self):
        r = self.client.get('/api/usage')
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn('cpu', data)
        self.assertIn('ram', data)
        self.assertIn('gpu', data)
        self.assertIn('disk', data)
        self.assertIn('breakdown', data['disk'])
        self.assertIn('video_and_data_bytes', data['disk']['breakdown'])
        self.assertIn('models_bytes', data['disk']['breakdown'])
        self.assertIn('app_and_env_bytes', data['disk']['breakdown'])

    def test_source_language_upload_validation_and_subtitles(self):
        # Valid language en
        r = self.client.post('/api/projects', files={'file': ('english.mp4', b'video', 'video/mp4')},
                             data={'source_language': 'en'})
        self.assertEqual(r.status_code, 200)
        pid_en = r.json()['id']
        detail_en = self.client.get(f'/api/projects/{pid_en}').json()
        self.assertEqual(detail_en['source_language'], 'en')

        # Invalid language
        r_inv = self.client.post('/api/projects', files={'file': ('test.mp4', b'video', 'video/mp4')},
                                 data={'source_language': 'fr'})
        self.assertEqual(r_inv.status_code, 400)

        # Subtitles for ja
        r_ja = self.client.post('/api/projects', files={'file': ('japan.mp4', b'video', 'video/mp4')},
                                data={'source_language': 'ja'})
        pid_ja = r_ja.json()['id']
        segments = [{'id': 's1', 'start': 0, 'end': 2, 'source': 'こんにちは', 'translation': 'Xin chào'}]
        core.write_json(core.folder(pid_ja) / 'segments.json', segments)
        core.update(pid_ja, state='review', step='tts')
        r_sub = self.client.get(f'/api/projects/{pid_ja}/files/ja.srt')
        self.assertEqual(r_sub.status_code, 200)
        self.assertIn('japan_ja.srt', r_sub.headers.get('content-disposition', ''))
        self.assertIn('こんにちは', r_sub.text)

    def test_cloned_voice_crud_protection_and_cache_version(self):
        import io
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(24000)
            w.writeframes(b'\x01\x00' * 72000)  # 3 seconds
        wav_bytes = buf.getvalue()

        # Create clone voice
        r = self.client.post('/api/voices', data={'name': 'Giọng Chị Lan'},
                             files={'file': ('sample.wav', wav_bytes, 'audio/wav')})
        self.assertEqual(r.status_code, 200)
        v_data = r.json()
        vid = v_data['id']
        self.assertTrue(vid.startswith('clone_'))
        self.assertGreater(v_data['duration'], 0)

        # List voices
        r_list = self.client.get('/api/voices')
        self.assertEqual(r_list.status_code, 200)
        self.assertTrue(any(v['id'] == vid for v in r_list.json()))

        # List all voices (for select dropdown)
        r_all = self.client.get('/api/voices/all')
        self.assertEqual(r_all.status_code, 200)
        self.assertTrue(any(v['id'] == vid and v['group'] == '⭐ Giọng nhân bản (Clone)' for v in r_all.json()))

        # Versioned cache key test
        key1 = core.tts_key('Xin chào', vid)
        key_preset = core.tts_key('Xin chào', 'Hải Đăng')
        self.assertNotEqual(key1, key_preset)

        # Use voice in a project -> delete should be protected!
        pid = self.create()
        core.update(pid, voice=vid)
        r_del_blocked = self.client.delete(f'/api/voices/{vid}')
        self.assertEqual(r_del_blocked.status_code, 400)
        self.assertIn('đang được', r_del_blocked.text)

        # Unbind project voice -> delete should succeed
        core.update(pid, voice='Hải Đăng')
        r_del_ok = self.client.delete(f'/api/voices/{vid}')
        self.assertEqual(r_del_ok.status_code, 200)

    def test_audio_mix_ducking_filter_and_settings(self):
        from app.media import build_ducking_filter
        f_duck = build_ducking_filter(0.3, 1.2, ducking=True, attenuation=18.0)
        self.assertIn('sidechaincompress', f_duck)
        self.assertIn('volume=0.300', f_duck)
        self.assertIn('volume=1.200', f_duck)

        f_noduck = build_ducking_filter(0.2, 1.0, ducking=False)
        self.assertNotIn('sidechaincompress', f_noduck)
        self.assertIn('amix', f_noduck)

        pid = self.create()
        # Update mix settings
        r = self.client.patch(f'/api/projects/{pid}/settings', json={
            'mix_background_gain': 0.35,
            'mix_narration_gain': 1.1,
            'mix_ducking': True,
            'mix_ducking_attenuation': 20.0
        })
        self.assertEqual(r.status_code, 200)
        proj = self.client.get(f'/api/projects/{pid}').json()
        self.assertEqual(proj['mix_background_gain'], 0.35)
        self.assertEqual(proj['mix_narration_gain'], 1.1)
        self.assertEqual(proj['mix_ducking'], 1)
        self.assertEqual(proj['mix_ducking_attenuation'], 20.0)

        # Remix action requires narration.wav
        r_remix_err = self.client.post(f'/api/projects/{pid}/remix')
        self.assertEqual(r_remix_err.status_code, 409)

        # Create fake narration.wav -> remix should queue mix step
        (core.folder(pid) / 'narration.wav').write_bytes(b'fake')
        r_remix_ok = self.client.post(f'/api/projects/{pid}/remix')
        self.assertEqual(r_remix_ok.status_code, 200)
        self.assertEqual(self.client.get(f'/api/projects/{pid}').json()['step'], 'mix')

    def test_fit_duration_and_ai_condense(self):
        # 1. Test fit_duration upload default and custom
        r1 = self.client.post('/api/projects', files={'file': ('fit1.mp4', b'video', 'video/mp4')})
        self.assertEqual(r1.status_code, 200)
        pid1 = r1.json()['id']
        det1 = self.client.get(f'/api/projects/{pid1}').json()
        self.assertEqual(det1.get('fit_duration'), 1)

        r2 = self.client.post('/api/projects', files={'file': ('fit2.mp4', b'video', 'video/mp4')},
                              data={'fit_duration': '0'})
        self.assertEqual(r2.status_code, 200)
        pid2 = r2.json()['id']
        det2 = self.client.get(f'/api/projects/{pid2}').json()
        self.assertEqual(det2.get('fit_duration'), 0)

        # Update settings
        self.client.patch(f'/api/projects/{pid2}/settings', json={'fit_duration': True})
        self.assertEqual(self.client.get(f'/api/projects/{pid2}').json().get('fit_duration'), 1)

        # 2. Test condense endpoint queuing
        self.review(pid1)
        r_cond = self.client.post(f'/api/projects/{pid1}/condense', json={'segment_ids': ['s1']})
        self.assertEqual(r_cond.status_code, 200)
        self.assertEqual(self.client.get(f'/api/projects/{pid1}').json()['step'], 'condense')
        self.assertEqual(self.client.get(f'/api/projects/{pid1}').json()['state'], 'queued')

        # 3. Test condense() logic with mock client
        from app.translate import condense
        from unittest.mock import MagicMock
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.json.return_value = {
            'choices': [{
                'message': {
                    'content': '{"translations":[{"id":"s1","text":"Chào"}]}'
                }
            }]
        }
        mock_client.post.return_value = mock_response

        # Call condense directly with mock_client
        condense(pid1, shared_client=mock_client)
        updated_segs = core.read_json(core.folder(pid1) / 'segments.json')
        self.assertEqual(updated_segs[0]['translation'], 'Chào')

        # 4. Test translate() sends max_words when fit_duration is 1
        from app.translate import translate
        mock_client.reset_mock()
        core.write_json(core.folder(pid1) / 'segments.json', [
            {'id': 's1', 'start': 0, 'end': 2, 'source': 'Hello', 'translation': ''}
        ])
        translate(pid1, shared_client=mock_client)
        call_kwargs = mock_client.post.call_args[1]
        sent_body = json.loads(call_kwargs['json']['messages'][1]['content'])
        self.assertIn('max_words', sent_body['segments'][0])


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

    def test_stt_multi_speaker_adaptive_clustering(self):
        import numpy as np
        from app.model_worker import transcribe
        pid = '1' * 32
        with core.db() as c:
            c.execute('INSERT OR REPLACE INTO projects(id,name,state,step,created,voice,multi_speaker,voice_male,voice_female) VALUES(?,?,?,?,?,?,?,?,?)',
                      (pid, 'test_adaptive', 'running', 'stt', 0, 'Hải Đăng', 1, 'Hải Đăng', 'Mai Anh'))

        sr = 16000
        t = np.linspace(0, 2.0, sr * 2, endpoint=False)
        male_audio = (np.sin(2 * np.pi * 110 * t) * 20000).astype(np.int16)
        female_audio = ((np.sin(2 * np.pi * 155 * t) + 0.7 * np.sin(2 * np.pi * 1800 * t)) * 15000).astype(np.int16)
        combined = np.concatenate([male_audio, female_audio, male_audio, female_audio])

        wav_path = core.folder(pid) / 'stt.wav'
        with wave.open(str(wav_path), 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sr)
            wf.writeframes(combined.tobytes())

        class Speech:
            def __init__(self, start, end, text):
                self.start, self.end, self.text = start, end, text

        class Model:
            def transcribe(self, *args, **kwargs):
                return [
                    Speech(0.2, 1.8, 'Musk line 1'),
                    Speech(2.2, 3.8, 'Zanny line 1'),
                    Speech(4.2, 5.8, 'Musk line 2'),
                    Speech(6.2, 7.8, 'Zanny line 2'),
                ], None

        model = Model()
        with patch('app.model_worker.duration', return_value=8.0), patch('app.model_worker.run'):
            transcribe(pid, model)

        segments = core.read_json(core.folder(pid) / 'segments.json')
        self.assertEqual(len(segments), 4)
        # Check that male segments are Hải Đăng and female segments are Mai Anh
        self.assertEqual(segments[0]['speaker'], 'Nam')
        self.assertEqual(segments[0]['voice'], 'Hải Đăng')
        self.assertEqual(segments[1]['speaker'], 'Nữ')
        self.assertEqual(segments[1]['voice'], 'Mai Anh')
        self.assertEqual(segments[2]['speaker'], 'Nam')
        self.assertEqual(segments[2]['voice'], 'Hải Đăng')
        self.assertEqual(segments[3]['speaker'], 'Nữ')
        self.assertEqual(segments[3]['voice'], 'Mai Anh')

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

    def test_runner_step_progression(self):
        import app.runner as runner
        pid = 'e' * 32
        with core.db() as c:
            c.execute('DELETE FROM projects')
            c.execute('INSERT INTO projects(id,name,state,step,created,voice) VALUES(?,?,?,?,?,?)',
                      (pid, 'test_runner', 'queued', 'extract', 0, 'Hải Đăng'))
        def fake_execute(p, s):
            runner.stop()
            return True
        with patch.object(runner, 'execute', side_effect=fake_execute):
            runner.stopping = False
            runner.main()
        with core.db() as c:
            row = dict(c.execute('SELECT * FROM projects WHERE id=?', (pid,)).fetchone())
        self.assertEqual(row['state'], 'queued')
        self.assertEqual(row['step'], 'stt')

    def test_translation_markdown_and_thinking(self):
        from app.translate import parse_translation
        payload = '{"translations":[{"id":"s1","text":"Chào"}]}'
        for content in (payload, f'```json\n{payload}\n```', f'```\n{payload}\n```',
                        f'<think>reasoning</think>\n```JSON\r\n{payload}\r\n```',
                        f'Here is translation:\n```json\n{payload}\n```\nHope it helps!'):
            with self.subTest(content=content):
                self.assertEqual(parse_translation(content)[0]['text'], 'Chào')
        with self.assertRaises(ValueError):
            parse_translation('```json\ninvalid\n```')

    def test_match_translations_resilience(self):
        from app.translate import match_translations
        batch = [{'id': 'seg_00792'}, {'id': 'seg_00793'}]

        # 1. Exact match
        res = match_translations(batch, [{'id': 'seg_00792', 'text': 'A'}, {'id': 'seg_00793', 'text': 'B'}])
        self.assertEqual(res, {'seg_00792': 'A', 'seg_00793': 'B'})

        # 2. Number / stripped ID match (e.g. 792 instead of seg_00792)
        res = match_translations(batch, [{'id': '792', 'text': 'A'}, {'id': '793', 'text': 'B'}])
        self.assertEqual(res, {'seg_00792': 'A', 'seg_00793': 'B'})

        # 3. Integer IDs
        res = match_translations(batch, [{'id': 792, 'text': 'A'}, {'id': 793, 'text': 'B'}])
        self.assertEqual(res, {'seg_00792': 'A', 'seg_00793': 'B'})

        # 4. Positional fallback when allow_positional is True
        res = match_translations(batch, [{'id': 'x1', 'text': 'A'}, {'id': 'x2', 'text': 'B'}], allow_positional=True)
        self.assertEqual(res, {'seg_00792': 'A', 'seg_00793': 'B'})

    def test_classify_audio_gender_pitch(self):
        import numpy as np
        from app.model_worker import classify_audio_gender

        sr = 16000
        duration = 1.0
        t = np.linspace(0, duration, int(sr * duration), endpoint=False)

        # 120 Hz sine wave -> typical male pitch (85-165 Hz)
        male_audio = (np.sin(2 * np.pi * 120 * t) * 32767).astype(np.int16)
        # 220 Hz sine wave -> typical female pitch (165-300 Hz)
        female_audio = (np.sin(2 * np.pi * 220 * t) * 32767).astype(np.int16)

        male_gender, male_f0 = classify_audio_gender(male_audio, sr)
        female_gender, female_f0 = classify_audio_gender(female_audio, sr)

        self.assertEqual(male_gender, 'male')
        self.assertAlmostEqual(male_f0, 120.0, delta=5.0)
        self.assertEqual(female_gender, 'female')
        self.assertAlmostEqual(female_f0, 220.0, delta=5.0)

        # Deep/mature female voice (~152 Hz) with higher formants/spectral centroid (> 1500 Hz)
        # (e.g. Zanny Minton Beddoes in Elon Musk interview)
        female_deep = (
            (np.sin(2 * np.pi * 152 * t) +
             0.7 * np.sin(2 * np.pi * 1824 * t) +
             0.5 * np.sin(2 * np.pi * 2584 * t)) * 16383
        ).astype(np.int16)
        f_deep_gender, f_deep_f0 = classify_audio_gender(female_deep, sr)
        self.assertEqual(f_deep_gender, 'female')
        self.assertAlmostEqual(f_deep_f0, 152.0, delta=6.0)

        # Octave jumping resistance: female voice (190 Hz) with subharmonic interference
        # First-peak picking must identify 190 Hz instead of halving to 95 Hz
        female_subharmonic = (
            (np.sin(2 * np.pi * 190 * t) + 0.5 * np.sin(2 * np.pi * 380 * t)) * 20000
        ).astype(np.int16)
        f_sub_gender, f_sub_f0 = classify_audio_gender(female_subharmonic, sr)
        self.assertEqual(f_sub_gender, 'female')
        self.assertAlmostEqual(f_sub_f0, 190.0, delta=6.0)

    def test_multi_speaker_segment_synthesis_voices(self):
        from app.model_worker import synthesize
        pid = 'd' * 32
        with core.db() as c:
            c.execute('INSERT OR REPLACE INTO projects(id,name,state,step,created,voice,multi_speaker,voice_male,voice_female) VALUES(?,?,?,?,?,?,?,?,?)',
                      (pid, 'test_multi', 'running', 'tts', 0, 'Hải Đăng', 1, 'Hải Đăng', 'Mai Anh'))
        path = core.folder(pid) / 'segments.json'
        # 2 segments: s1 male voice (Hải Đăng), s2 female voice (Mai Anh)
        rows = [
            {'id': 's1', 'start': 0, 'end': 1, 'source': 'a', 'translation': 'Chào anh', 'gender': 'male', 'voice': 'Hải Đăng'},
            {'id': 's2', 'start': 2, 'end': 3, 'source': 'b', 'translation': 'Chào em', 'gender': 'female', 'voice': 'Mai Anh'}
        ]
        core.write_json(path, rows)

        recorded_voices = []
        class MultiVoiceModel:
            def infer(self, text, voice):
                recorded_voices.append(voice)
                return b'audio'
            def save(self, audio, path):
                with wave.open(str(path), 'wb') as out:
                    out.setnchannels(1)
                    out.setsampwidth(2)
                    out.setframerate(16000)
                    out.writeframes(b'\0\0' * 16000)

        model = MultiVoiceModel()
        synthesize(pid, model)
        self.assertEqual(recorded_voices, ['Hải Đăng', 'Mai Anh'])

    def test_subtitle_rounding(self):
        self.assertEqual(core.stamp(59.9999), '00:01:00,000')
        self.assertEqual(core.stamp(3600.001), '01:00:00,001')

    def test_path_validation(self):
        with self.assertRaises(ValueError): core.folder('../escape')


if __name__ == '__main__':
    unittest.main()
