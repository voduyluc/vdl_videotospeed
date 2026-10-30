import copy
import json
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

from tests.support import core
from app.main import app
from app.references import ReferenceIndex, apply_references, validate_match
from fastapi.testclient import TestClient


class Reply:
    def __init__(self, data): self.data = data
    def raise_for_status(self): pass
    def json(self): return {'choices': [{'message': {'content': json.dumps(self.data, ensure_ascii=False)}}]}


class Client:
    def __init__(self, query=None, match=None):
        self.calls = []
        self.query = query or {}
        self.match = match

    def post(self, url, json, **kwargs):
        import json as codec
        payload = codec.loads(json['messages'][1]['content'])
        self.calls.append(payload)
        if 'candidates' not in payload:
            if 'segments' in payload and 'glossary' in payload:
                return Reply({'translations': [{'id': s['id'], 'text': 'Bản dịch mới cho câu không khớp'}
                                                for s in payload['segments']]})
            return Reply({'queries': [{'id': s['id'], 'text': self.query.get(s['id'], '')}
                                      for s in payload['segments']]})
        return Reply(self.match(payload) if self.match else {'matches': []})


def segment(sid, text, start=1):
    return {'id': sid, 'start': start, 'end': start+2, 'source': text, 'translation': '',
            'gender': 'female', 'voice': 'Mai Anh'}


def cue(sid, text):
    return {'id': sid, 'start': 3600, 'end': 3610, 'text': text}


class ReferenceTests(unittest.TestCase):
    def setUp(self):
        self.pid = uuid.uuid4().hex
        self.p = core.folder(self.pid)
        with core.db() as c:
            c.execute('''INSERT INTO projects(id,name,state,step,created,voice,source_language,subtitle_mode,duration)
                         VALUES(?,?,?,?,?,?,?,?,?)''',
                      (self.pid, 'reference', 'running', 'translate', 0, 'Mai Anh', 'en', 'reference', 30))

    def prepare(self, segments, source=None, vi=None):
        core.write_json(self.p / 'segments.json', segments)
        core.write_json(self.p / 'subtitle-references.json', {'source': source or [], 'vi': vi or []})

    def test_shifted_source_many_cues_one_segment_and_resume(self):
        rows = [segment('s1', 'Please bring the blue suitcase to the station')]
        self.prepare(rows, source=[cue('r1', 'Please bring the blue suitcase'), cue('r2', 'to the station')])
        client = Client()
        original = copy.deepcopy(rows)
        apply_references(self.pid, rows, client)
        self.assertEqual(rows[0]['reference']['source']['reference_ids'], ['r1', 'r2'])
        self.assertEqual((rows[0]['start'], rows[0]['end'], rows[0]['voice']), (1, 3, 'Mai Anh'))
        self.assertEqual(core.read_json(self.p / 'stt-original.json'), original)
        self.assertEqual(client.calls, [])
        apply_references(self.pid, rows, client)
        self.assertEqual(client.calls, [])

    def test_repeated_dialogue_not_accepted_as_anchor(self):
        rows = [segment('s1', 'Please bring the blue suitcase')]
        self.prepare(rows, source=[cue('r1', rows[0]['source']), cue('r2', 'A totally different scene'),
                                   cue('r3', rows[0]['source'])])
        apply_references(self.pid, rows, Client())
        self.assertNotEqual(rows[0]['reference']['source']['status'], 'matched')
        self.assertEqual(rows[0]['source'], 'Please bring the blue suitcase')

    def test_vi_reference_split_over_two_video_segments(self):
        rows = [segment('s1', 'Bring the blue suitcase'), segment('s2', 'to the station', 4)]
        vi = 'Mang chiếc vali màu xanh đến nhà ga'
        self.prepare(rows, vi=[cue('r1', vi)])
        def match(payload):
            c = next(c for c in payload['candidates'] if c['segment_ids'] == ['s1', 's2'])
            return {'matches': [{'candidate_id': c['candidate_id'], 'confidence': .99,
                                  'texts': ['Mang chiếc vali màu xanh', 'đến nhà ga'], 'reason': 'same dialogue'}]}
        client = Client({'s1': 'Mang chiếc vali màu xanh', 's2': 'đến nhà ga'}, match)
        apply_references(self.pid, rows, client)
        self.assertEqual([s['translation'] for s in rows], ['Mang chiếc vali màu xanh', 'đến nhà ga'])
        self.assertEqual([s['start'] for s in rows], [1, 4])
        count = len(client.calls)
        apply_references(self.pid, rows, client)
        self.assertEqual(len(client.calls), count)

    def test_invalid_id_low_confidence_and_hallucinated_text_rejected(self):
        c = {'candidate_id': 'c0', 'segment_ids': ['s1'], 'reference_ids': ['r1'],
             'start': 0, 'end': 1, 'text': 'Mang chiếc vali màu xanh'}
        by_id = {'s1': segment('s1', 'Bring the blue suitcase')}
        for match in (
            {'candidate_id': 'invented', 'confidence': .99, 'texts': [c['text']]},
            {'candidate_id': 'c0', 'confidence': .6, 'texts': [c['text']]},
            {'candidate_id': 'c0', 'confidence': float('nan'), 'texts': [c['text']]},
            {'candidate_id': 'c0', 'confidence': .99, 'texts': ['Nội dung bịa hoàn toàn khác']},
            {'candidate_id': 'c0', 'confidence': .99, 'texts': [c['text'], 'extra']},
        ):
            with self.subTest(match=match):
                self.assertIsNone(validate_match(match, [c], by_id, 'vi'))

    def test_reference_failure_falls_back_to_translation_same_engine(self):
        from app.translate import translate
        rows = [segment('s1', 'The train is leaving the station now')]
        self.prepare(rows, vi=[cue('r1', 'Hôm nay tôi đi mua bánh mì')])
        client = Client({'s1': 'Chuyến tàu đang rời nhà ga'})
        with patch('app.translate.engine') as engine:
            engine.return_value.__enter__.return_value = client
            translate(self.pid)
        engine.assert_called_once()
        result = core.read_json(self.p / 'segments.json')[0]
        self.assertEqual(result['translation'], 'Bản dịch mới cho câu không khớp')
        self.assertEqual(result['reference']['vi']['status'], 'unmatched')

    def test_model_unavailable_marks_review_without_replacing_stt(self):
        rows = [segment('s1', 'The train is leaving the station now')]
        self.prepare(rows, vi=[cue('r1', 'Chuyến tàu đang rời nhà ga')])
        client = Client()
        client.post = lambda *a, **kw: (_ for _ in ()).throw(RuntimeError('offline'))
        apply_references(self.pid, rows, client)
        self.assertEqual(rows[0]['translation'], '')
        self.assertEqual(rows[0]['reference']['vi']['status'], 'uncertain')

    def test_missing_translation_failure_is_not_silently_source_text(self):
        from app.translate import translate
        rows = [segment('s1', 'The train is leaving the station now')]
        self.prepare(rows, vi=[cue('r1', 'Chuyến tàu đang rời nhà ga')])
        client = Client()
        client.post = lambda *a, **kw: (_ for _ in ()).throw(RuntimeError('offline'))
        with self.assertRaisesRegex(RuntimeError, 'Không dịch được'):
            translate(self.pid, client)
        self.assertEqual(core.read_json(self.p / 'segments.json')[0]['translation'], '')

    def test_correct_source_typo_with_model_without_changing_timeline(self):
        rows = [segment('s1', 'Please bring the blue suitcaze to the station')]
        corrected = 'Please bring the blue suitcase to the station'
        self.prepare(rows, source=[cue('r1', corrected)])
        def match(payload):
            return {'matches': [{'candidate_id': payload['candidates'][0]['candidate_id'],
                                 'confidence': .99, 'texts': [corrected]}]}
        apply_references(self.pid, rows, Client(match=match))
        self.assertEqual(rows[0]['source'], corrected)
        self.assertIn('suitcaze', rows[0]['reference']['source']['original_text'])
        self.assertEqual((rows[0]['start'], rows[0]['end']), (1, 3))

    def test_reference_order_cannot_rewind_or_reuse_cues(self):
        first = 'Please bring the blue suitcase to the station'
        second = 'The pilot is waiting near the red helicopter'
        rows = [segment('s1', first), segment('s2', second, 4)]
        self.prepare(rows, source=[cue('r1', second), cue('r2', first)])
        apply_references(self.pid, rows, Client())
        self.assertEqual(rows[0]['reference']['source']['status'], 'matched')
        self.assertNotEqual(rows[1]['reference']['source']['status'], 'matched')

    def test_reference_mode_rejects_silent_video_without_inventing_timing(self):
        from app.media import extract
        self.prepare([], vi=[cue('r1', 'Chuyến tàu đang rời nhà ga')])
        (self.p / 'source').write_bytes(b'video')
        with patch('app.media.has_audio_stream', return_value=False), patch('app.media.duration', return_value=4):
            with self.assertRaisesRegex(RuntimeError, 'Dùng trực tiếp'):
                extract(self.pid)

    def test_input_change_cannot_reuse_checkpoint(self):
        rows = [segment('s1', 'The train is leaving the station now')]
        self.prepare(rows, source=[cue('r1', rows[0]['source'])])
        apply_references(self.pid, rows, Client())
        core.write_json(self.p / 'subtitle-references.json', {'source': [cue('r2', 'changed')]})
        with self.assertRaisesRegex(ValueError, 'inputs changed'):
            apply_references(self.pid, rows, Client())

    def test_migration_defaults_old_projects_to_direct(self):
        with tempfile.TemporaryDirectory(dir=core.DATA) as tmp, patch.object(core, 'DATA', Path(tmp)):
            with core.db() as c:
                c.execute('CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT,state TEXT,step TEXT,progress TEXT,error TEXT,duration REAL,created REAL,voice TEXT,cancel INTEGER)')
                c.execute("INSERT INTO projects(id,name,state,step,voice) VALUES('old','old','completed','tts','Mai Anh')")
            core.init_db()
            with core.db() as c:
                self.assertEqual(c.execute("SELECT subtitle_mode FROM projects WHERE id='old'").fetchone()[0], 'direct')


class ReferenceApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.client.auth = ('admin', 'test-password')

    def upload(self, mode='reference', text='Please bring the blue suitcase'):
        return self.client.post('/api/projects', data={'subtitle_mode': mode, 'source_language': 'en'}, files={
            'file': ('movie.mp4', b'video'),
            'subtitle_src': ('source.srt', f'1\n01:00:00,000 --> 01:00:03,000\n{text}\n'.encode())})

    def test_reference_upload_keeps_video_timeline_and_survives_reset(self):
        from app.runner import after_extract
        r = self.upload()
        self.assertEqual(r.status_code, 200, r.text)
        pid = r.json()['id']
        p = core.folder(pid)
        self.assertFalse((p / 'segments.json').exists())
        row = self.client.get(f'/api/projects/{pid}').json()
        self.assertEqual(after_extract(pid, row)['step'], 'stt')
        core.update(pid, state='review')
        self.assertEqual(self.client.post(f'/api/projects/{pid}/reset').status_code, 200)
        self.assertTrue((p / 'subtitle-references.json').exists())
        self.assertTrue((p / 'uploaded-source.srt').exists())

    def test_direct_mode_still_skips_stt(self):
        from app.runner import after_extract
        r = self.upload('direct')
        pid = r.json()['id']
        row = self.client.get(f'/api/projects/{pid}').json()
        self.assertEqual(after_extract(pid, row)['step'], 'translate')
        self.assertEqual(row['segments'][0]['start'], 3600)

    def test_invalid_mode_and_bad_srt(self):
        self.assertEqual(self.upload('unknown').status_code, 400)
        r = self.client.post('/api/projects', data={'subtitle_mode': 'reference'}, files={
            'file': ('movie.mp4', b'v'), 'subtitle_src': ('bad.srt', b'not subtitles')})
        self.assertEqual(r.status_code, 400)

    def test_editor_preserves_reference_metadata(self):
        pid = self.upload().json()['id']
        rows = [segment('s1', 'Please bring the blue suitcase')]
        rows[0]['translation'] = 'Mang vali màu xanh'
        rows[0]['reference'] = {'vi': {'status': 'matched', 'reference_ids': ['r1'], 'original_text': ''}}
        core.write_json(core.folder(pid) / 'segments.json', rows)
        core.update(pid, state='review', duration=10)
        rows[0]['translation'] = 'Hãy mang chiếc vali màu xanh'
        self.assertEqual(self.client.put(f'/api/projects/{pid}/segments', json={
            'segments': rows, 'voice': 'Mai Anh'}).status_code, 200)
        ref = core.read_json(core.folder(pid) / 'segments.json')[0]['reference']['vi']
        self.assertEqual(ref['reference_ids'], ['r1'])
        self.assertTrue(ref['edited'])
