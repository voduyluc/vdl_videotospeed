import os
import shutil
import unittest
import uuid
import wave
from pathlib import Path
from unittest.mock import patch

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

    def test_mix_creates_mixed_audio_files(self):
        from app.media import mix
        pid, p = self.prepare(1)
        export(pid)
        bg_file = p / 'background.wav'
        with wave.open(str(bg_file), 'wb') as out:
            out.setnchannels(2)
            out.setsampwidth(2)
            out.setframerate(48000)
            out.writeframes(b'\x02\x00\x02\x00' * (48000 * 5))
        mix(pid)
        self.assertTrue((p / 'mixed.wav').exists())
        self.assertTrue((p / 'mixed.mp3').exists())
        with wave.open(str(p / 'mixed.wav'), 'rb') as audio:
            self.assertEqual(audio.getnchannels(), 2)
            self.assertAlmostEqual(audio.getnframes() / audio.getframerate(), 5, places=2)


class DurationTests(unittest.TestCase):
    def test_duration_handles_na_and_stream_fallback(self):
        from app.core import duration

        def mock_run(args):
            args_str = ' '.join(str(a) for a in args)
            if 'format=duration' in args_str:
                return 'N/A\n'
            if 'stream=duration' in args_str:
                return 'N/A\n14.75\n'
            return ''

        with patch('app.core.run', side_effect=mock_run):
            self.assertEqual(duration(Path('dummy.mp4')), 14.75)

    def test_duration_handles_all_na_returns_zero_without_raising(self):
        from app.core import duration

        with patch('app.core.run', return_value='N/A\n'), \
             patch('subprocess.run', return_value=type('Proc', (), {'stderr': ''})()):
            self.assertEqual(duration(Path('dummy.ts')), 0.0)

    def test_extract_falls_back_to_wav_duration_when_source_duration_is_na(self):
        from app.media import extract
        pid = uuid.uuid4().hex
        p = core.folder(pid)
        with core.db() as c:
            c.execute('INSERT INTO projects(id,name,state,step,duration,created,voice) VALUES(?,?,?,?,?,?,?)',
                      (pid, 'extract test', 'running', 'extract', 0, 0, 'test'))
        (p / 'source').write_bytes(b'fake_video')

        def mock_ffmpeg(args):
            args_str = ' '.join(str(a) for a in args)
            if 'stt.tmp.wav' in args_str:
                with wave.open(str(p / 'stt.tmp.wav'), 'wb') as out:
                    out.setnchannels(1)
                    out.setsampwidth(2)
                    out.setframerate(16000)
                    out.writeframes(b'\0\0' * (16000 * 3))
            elif 'background.tmp.wav' in args_str:
                with wave.open(str(p / 'background.tmp.wav'), 'wb') as out:
                    out.setnchannels(2)
                    out.setsampwidth(2)
                    out.setframerate(48000)
                    out.writeframes(b'\0\0\0\0' * (48000 * 3))
            return ''

        with patch('app.media.run', side_effect=mock_ffmpeg), \
             patch('app.media.has_audio_stream', return_value=True), \
             patch('app.media.duration', return_value=0.0):
            extract(pid)
            with core.db() as c:
                row = c.execute('SELECT * FROM projects WHERE id=?', (pid,)).fetchone()
            self.assertAlmostEqual(row['duration'], 3.0, places=1)

    def test_parse_srt_various_formats(self):
        from app.core import parse_srt
        raw = """1
00:00:01,200 --> 00:00:03,500
Line 1
<i>Line 1 subtitle</i>

2
00:01:05.000 --> 00:01:08.000 position:50%
Line 2 with tags <b>bold</b>
"""
        segs = parse_srt(raw)
        self.assertEqual(len(segs), 2)
        self.assertEqual(segs[0]['id'], 's1')
        self.assertEqual(segs[0]['start'], 1.2)
        self.assertEqual(segs[0]['end'], 3.5)
        self.assertEqual(segs[0]['text'], 'Line 1 Line 1 subtitle')
        self.assertEqual(segs[1]['start'], 65.0)
        self.assertEqual(segs[1]['end'], 68.0)
        self.assertEqual(segs[1]['text'], 'Line 2 with tags bold')

    def test_create_silent_wav(self):
        from app.core import create_silent_wav
        dest = core.DATA / 'silent_test.wav'
        try:
            create_silent_wav(dest, duration_sec=2.0, channels=2, sample_rate=48000)
            with wave.open(str(dest), 'rb') as audio:
                self.assertEqual(audio.getnchannels(), 2)
                self.assertEqual(audio.getframerate(), 48000)
                self.assertEqual(audio.getnframes(), 48000 * 2)
        finally:
            dest.unlink(missing_ok=True)

    def test_extract_on_video_without_audio_stream(self):
        from app.media import extract
        pid = uuid.uuid4().hex
        p = core.folder(pid)
        with core.db() as c:
            c.execute('INSERT INTO projects(id,name,state,step,duration,created,voice) VALUES(?,?,?,?,?,?,?)',
                      (pid, 'extract no audio', 'running', 'extract', 0, 0, 'test'))
        (p / 'source').write_bytes(b'fake_silent_video')

        with patch('app.media.has_audio_stream', return_value=False), \
             patch('app.media.duration', return_value=4.0):
            extract(pid)
            self.assertTrue((p / 'stt.wav').exists())
            self.assertTrue((p / 'background.wav').exists())
            with wave.open(str(p / 'stt.wav'), 'rb') as a:
                self.assertEqual(a.getnchannels(), 1)
                self.assertEqual(a.getframerate(), 16000)
                self.assertEqual(a.getnframes(), 16000 * 4)
            with wave.open(str(p / 'background.wav'), 'rb') as a:
                self.assertEqual(a.getnchannels(), 2)
                self.assertEqual(a.getframerate(), 48000)
                self.assertEqual(a.getnframes(), 48000 * 4)
            with core.db() as c:
                row = c.execute('SELECT * FROM projects WHERE id=?', (pid,)).fetchone()
            self.assertAlmostEqual(row['duration'], 4.0, places=1)
