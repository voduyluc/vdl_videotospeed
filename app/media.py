import os
import wave

from app.core import duration, folder, read_json, run, subtitles, update, write_json


def extract(pid):
    p = folder(pid)
    total = duration(p / 'source')
    update(pid, duration=total)
    tmp = p / 'stt.tmp.wav'
    run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', p / 'source', '-map', '0:a:0',
         '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', tmp])
    tmp.replace(p / 'stt.wav')


def export(pid):
    p = folder(pid)
    segments = read_json(p / 'segments.json')
    manifest = read_json(p / 'tts-manifest.json')
    if [s['id'] for s in segments] != [m['id'] for m in manifest]:
        raise ValueError('Incomplete TTS manifest')
    from app.core import db
    with db() as c:
        total = c.execute('SELECT duration FROM projects WHERE id=?', (pid,)).fetchone()['duration']
    max_speed = float(os.getenv('MAX_SPEED', '1.18'))
    if not 1 <= max_speed <= 2:
        raise ValueError('MAX_SPEED must be between 1 and 2')
    rate = 48000
    warnings = []
    position = 0
    tmp = p / 'narration.tmp.wav'
    # Stream PCM sequentially: memory use is independent of the film duration.
    with wave.open(str(tmp), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(rate)

        def silence(frames):
            while frames > 0:
                n = min(frames, rate)
                out.writeframesraw(b'\0\0' * n)
                frames -= n

        for i, (s, m) in enumerate(zip(segments, manifest)):
            start = round(s['start'] * rate)
            silence(max(0, start - position))
            position = max(start, position)
            boundary = segments[i+1]['start'] if i+1 < len(segments) else total
            available = max(0.01, boundary - s['start'])
            # atempo output length is approximate; leave a small boundary margin.
            speed = min(max_speed, max(1, m['duration'] / max(0.01, available - 0.04)))
            clip = p / 'fitted.wav'
            run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', m['file'],
                 '-af', f'atempo={speed:.6f}', '-ar', rate, '-ac', 1, '-c:a', 'pcm_s16le', clip])
            with wave.open(str(clip), 'rb') as audio:
                frames = audio.getnframes()
                if frames > round(available * rate):
                    warnings.append({'id': s['id'], 'overflow_seconds':
                                     round(frames / rate - available, 3)})
                while chunk := audio.readframes(rate):
                    out.writeframesraw(chunk)
                position += frames
            update(pid, progress=f'Ghép {i+1}/{len(segments)}')
        silence(max(0, round(total * rate) - position))
    write_json(p / 'timing-warnings.json', warnings)
    if warnings:
        tmp.unlink(missing_ok=True)
        # Never publish a film with accumulated drift or silently truncate speech.
        raise RuntimeError(f'{len(warnings)} câu vượt thời lượng. Sửa/rút gọn câu được đánh dấu rồi tạo lại.')
    run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', tmp,
         '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', rate, '-c:a', 'pcm_s16le',
         p / 'normalized.wav'])
    (p / 'normalized.wav').replace(p / 'narration.wav')
    tmp.unlink(missing_ok=True)
    run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', p / 'narration.wav',
         '-codec:a', 'libmp3lame', '-b:a', '192k', p / 'narration.tmp.mp3'])
    (p / 'narration.tmp.mp3').replace(p / 'narration.mp3')
    for name, key in [('ko', 'source'), ('vi', 'translation')]:
        (p / f'{name}.srt').write_text(subtitles(segments, key), 'utf-8')
