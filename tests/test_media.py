import os
import shutil
import unittest
import uuid
import wave
from pathlib import Path

# Import the isolated test database setup, also when this module runs separately.
from tests.test_app import core
from app.media import export


@unittest.skipUnless(os.getenv('FFMPEG_BIN') or shutil.which('ffmpeg'), 'FFmpeg required')
class ExportTests(unittest.TestCase):
    def prepare(self, clip_seconds, total=5):
        pid = uuid.uuid4().hex
        p = core.folder(pid)
        with core.db() as c:
            c.execute('INSERT INTO projects(id,name,state,step,duration,created,voice) VALUES(?,?,?,?,?,?,?)',
                      (pid, 'media test', 'running', 'export', total, 0, 'test'))
        clip = p / 'clip.wav'
        with wave.open(str(clip), 'wb') as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(48000)
            out.writeframes(b'\x01\x01' * round(48000 * clip_seconds))
        core.write_json(p / 'segments.json', [
            {'id': 's1', 'start': 1, 'end': 2, 'source': '안녕', 'translation': 'Xin chào'}])
        core.write_json(p / 'tts-manifest.json', [
            {'id': 's1', 'file': str(clip), 'duration': clip_seconds}])
        return pid, p

    def test_export_preserves_video_duration_and_initial_silence(self):
        pid, p = self.prepare(1)
        export(pid)
        with wave.open(str(p / 'narration.wav'), 'rb') as audio:
            self.assertAlmostEqual(audio.getnframes() / audio.getframerate(), 5, places=2)
            self.assertEqual(audio.readframes(24000), b'\0\0' * 24000)
        self.assertGreater((p / 'narration.mp3').stat().st_size, 100)
        self.assertIn('Xin chào', (p / 'vi.srt').read_text('utf-8'))

    def test_overflow_is_reported_without_publishing_drifting_audio(self):
        pid, p = self.prepare(6)
        with core.db() as c:
            c.execute('UPDATE projects SET auto_fit=0 WHERE id=?', (pid,))
        with self.assertRaisesRegex(RuntimeError, 'vượt thời lượng'):
            export(pid)
        self.assertFalse((p / 'narration.wav').exists())
        self.assertFalse((p / 'narration.mp3').exists())
        warnings = core.read_json(p / 'timing-warnings.json')
        self.assertEqual(warnings[0]['id'], 's1')
        self.assertGreater(warnings[0]['overflow_seconds'], 0)

    def test_export_with_auto_fit_compresses_and_succeeds(self):
        pid, p = self.prepare(3)
        export(pid)
        self.assertTrue((p / 'narration.wav').exists())
        self.assertTrue((p / 'narration.mp3').exists())
        with wave.open(str(p / 'narration.wav'), 'rb') as audio:
            self.assertAlmostEqual(audio.getnframes() / audio.getframerate(), 5, places=2)
