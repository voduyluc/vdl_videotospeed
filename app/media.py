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


def build_atempo_filter(speed: float) -> str:
    speed = max(0.2, min(5.0, speed))
    filters = []
    current = speed
    while current > 2.0:
        filters.append('atempo=2.0')
        current /= 2.0
    while current < 0.5:
        filters.append('atempo=0.5')
        current /= 0.5
    filters.append(f'atempo={current:.6f}')
    return ','.join(filters)


def apply_fade_out(raw_bytes: bytes, fade_frames: int = 2400) -> bytes:
    import array
    samples = array.array('h')
    samples.frombytes(raw_bytes)
    total = len(samples)
    actual_fade = min(total, fade_frames)
    if actual_fade <= 0:
        return raw_bytes
    start = total - actual_fade
    for idx in range(actual_fade):
        factor = (actual_fade - idx) / actual_fade
        samples[start + idx] = int(samples[start + idx] * factor)
    return samples.tobytes()


def export(pid):
    p = folder(pid)
    segments = read_json(p / 'segments.json')
    manifest = read_json(p / 'tts-manifest.json')
    if [s['id'] for s in segments] != [m['id'] for m in manifest]:
        raise ValueError('Incomplete TTS manifest')
    from app.core import db
    with db() as c:
        row = c.execute('SELECT duration, auto_fit FROM projects WHERE id=?', (pid,)).fetchone()
        total = row['duration']
        auto_fit = row['auto_fit'] if row and 'auto_fit' in row.keys() else 1
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
            needed_speed = m['duration'] / max(0.01, available - 0.04)
            if auto_fit:
                speed = min(3.0, max(1.0, needed_speed))
            else:
                speed = min(max_speed, max(1.0, needed_speed))

            clip = p / 'fitted.wav'
            atempo_str = build_atempo_filter(speed)
            run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', m['file'],
                 '-af', atempo_str, '-ar', rate, '-ac', 1, '-c:a', 'pcm_s16le', clip])
            with wave.open(str(clip), 'rb') as audio:
                frames = audio.getnframes()
                actual_dur = frames / rate
                max_frames = round(available * rate)
                if frames > max_frames:
                    warnings.append({
                        'id': s['id'],
                        'available_seconds': round(available, 2),
                        'actual_seconds': round(actual_dur, 2),
                        'overflow_seconds': round(actual_dur - available, 3),
                        'audio_duration': round(m['duration'], 2),
                    })
                    if auto_fit:
                        raw_chunk = audio.readframes(max_frames)
                        raw_chunk = apply_fade_out(raw_chunk)
                        out.writeframesraw(raw_chunk)
                        position += max_frames
                    else:
                        while chunk := audio.readframes(rate):
                            out.writeframesraw(chunk)
                        position += frames
                else:
                    while chunk := audio.readframes(rate):
                        out.writeframesraw(chunk)
                    position += frames
            update(pid, progress=f'Ghép {i+1}/{len(segments)}')
        silence(max(0, round(total * rate) - position))
    write_json(p / 'timing-warnings.json', warnings)
    if warnings and not auto_fit:
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
