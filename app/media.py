import os
import wave

from app.core import duration, folder, read_json, run, subtitles, update, wav_duration, write_json


def extract(pid):
    p = folder(pid)
    tmp = p / 'stt.tmp.wav'
    run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', p / 'source', '-map', '0:a:0',
         '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', tmp])
    tmp.replace(p / 'stt.wav')
    # Extract pristine stereo background audio for mixing stage
    bg_tmp = p / 'background.tmp.wav'
    run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', p / 'source', '-map', '0:a:0',
         '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', bg_tmp])
    bg_tmp.replace(p / 'background.wav')
    try:
        total = duration(p / 'source')
    except Exception:
        total = 0.0
    if not total or total <= 0:
        total = wav_duration(p / 'stt.wav')
    update(pid, duration=total)


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
        row = c.execute('SELECT duration, auto_fit, source_language FROM projects WHERE id=?', (pid,)).fetchone()
        row = dict(row) if row else {}
        total = row.get('duration', 0)
        auto_fit = row.get('auto_fit', 1)
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

    src_lang = row.get('source_language') or 'ko'
    for name, key in [(src_lang, 'source'), ('vi', 'translation')]:
        (p / f'{name}.srt').write_text(subtitles(segments, key), 'utf-8')


def build_ducking_filter(bg_gain=0.25, narr_gain=1.0, ducking=True, attenuation=16.0) -> str:
    ratio = max(2.0, min(20.0, float(attenuation) / 2.0))
    bg_gain = max(0.0, min(3.0, float(bg_gain)))
    narr_gain = max(0.0, min(3.0, float(narr_gain)))
    if ducking:
        return (
            f"[0:a]volume={bg_gain:.3f}[bg];"
            f"[1:a]pan=stereo|c0=c0|c1=c0,volume={narr_gain:.3f},asplit=2[narr_sc][narr_mix];"
            f"[bg][narr_sc]sidechaincompress=threshold=0.02:ratio={ratio:.1f}:attack=25:release=280[ducked_bg];"
            f"[ducked_bg][narr_mix]amix=inputs=2:duration=first:dropout_transition=2:weights=1 1,alimiter=limit=0.98[out]"
        )
    else:
        return (
            f"[0:a]volume={bg_gain:.3f}[bg];"
            f"[1:a]pan=stereo|c0=c0|c1=c0,volume={narr_gain:.3f}[narr];"
            f"[bg][narr]amix=inputs=2:duration=first:dropout_transition=2:weights=1 1,alimiter=limit=0.98[out]"
        )


def mix(pid):
    p = folder(pid)
    from app.core import db
    with db() as c:
        row = dict(c.execute('SELECT * FROM projects WHERE id=?', (pid,)).fetchone())
    bg_gain = row.get('mix_background_gain', 0.25)
    narr_gain = row.get('mix_narration_gain', 1.0)
    ducking = bool(row.get('mix_ducking', 1))
    attenuation = row.get('mix_ducking_attenuation', 16.0)

    bg_path = p / 'background.wav'
    if not bg_path.exists() and (p / 'source').exists():
        run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', p / 'source', '-map', '0:a:0',
             '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', bg_path])

    narr_path = p / 'narration.wav'
    if not narr_path.exists():
        raise RuntimeError('Chưa có file narration.wav để phối âm')

    update(pid, progress='Phối âm nền & thuyết minh (FFmpeg)')
    filter_str = build_ducking_filter(bg_gain, narr_gain, ducking, attenuation)
    tmp_wav = p / 'mixed.tmp.wav'
    run(['ffmpeg', '-nostdin', '-y', '-v', 'error',
         '-i', bg_path, '-i', narr_path,
         '-filter_complex', filter_str,
         '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s16le', tmp_wav])
    tmp_wav.replace(p / 'mixed.wav')

    tmp_mp3 = p / 'mixed.tmp.mp3'
    run(['ffmpeg', '-nostdin', '-y', '-v', 'error',
         '-i', p / 'mixed.wav', '-codec:a', 'libmp3lame', '-b:a', '192k', tmp_mp3])
    tmp_mp3.replace(p / 'mixed.mp3')
    update(pid, progress='Hoàn tất')


def render_mix_preview(pid, start_sec=0.0, duration_sec=15.0):
    p = folder(pid)
    from app.core import db
    with db() as c:
        row = dict(c.execute('SELECT * FROM projects WHERE id=?', (pid,)).fetchone())
    bg_gain = row.get('mix_background_gain', 0.25)
    narr_gain = row.get('mix_narration_gain', 1.0)
    ducking = bool(row.get('mix_ducking', 1))
    attenuation = row.get('mix_ducking_attenuation', 16.0)

    bg_path = p / 'background.wav'
    if not bg_path.exists() and (p / 'source').exists():
        run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', p / 'source', '-map', '0:a:0',
             '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', bg_path])

    narr_path = p / 'narration.wav'
    if not narr_path.exists():
        raise RuntimeError('Chưa có file narration.wav để nghe thử mix')

    preview_out = p / 'mix_preview.wav'
    filter_str = build_ducking_filter(bg_gain, narr_gain, ducking, attenuation)
    run(['ffmpeg', '-nostdin', '-y', '-v', 'error',
         '-ss', str(start_sec), '-t', str(duration_sec), '-i', bg_path,
         '-ss', str(start_sec), '-t', str(duration_sec), '-i', narr_path,
         '-filter_complex', filter_str,
         '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s16le', preview_out])
    return preview_out


def mux(pid: str):
    p = folder(pid)
    source_video = p / 'source'
    if not source_video.exists():
        raise RuntimeError('File video gốc không tồn tại')

    # Priority for audio track: mixed.wav (lossless) -> mixed.mp3 -> narration.wav -> narration.mp3
    audio_path = None
    for name in ('mixed.wav', 'mixed.mp3', 'narration.wav', 'narration.mp3'):
        f = p / name
        if f.exists() and f.stat().st_size > 0:
            audio_path = f
            break

    if not audio_path:
        raise RuntimeError('Chưa có file audio thuyết minh/phối âm để ghép vào video')

    update(pid, progress='Ghép audio vào video gốc (FFmpeg)')
    tmp_out = p / 'dubbed_video.tmp.mp4'
    final_out = p / 'dubbed_video.mp4'
    tmp_out.unlink(missing_ok=True)

    # 1. Fast stream copy for video track (-c:v copy)
    try:
        run(['ffmpeg', '-nostdin', '-y', '-v', 'error',
             '-i', source_video,
             '-i', audio_path,
             '-map', '0:v:0',
             '-map', '1:a:0',
             '-c:v', 'copy',
             '-c:a', 'aac', '-b:a', '192k',
             '-movflags', '+faststart',
             '-shortest',
             tmp_out])
    except Exception:
        # Fallback: re-encode video with fast libx264 if stream copy fails
        tmp_out.unlink(missing_ok=True)
        run(['ffmpeg', '-nostdin', '-y', '-v', 'error',
             '-i', source_video,
             '-i', audio_path,
             '-map', '0:v:0',
             '-map', '1:a:0',
             '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22',
             '-c:a', 'aac', '-b:a', '192k',
             '-movflags', '+faststart',
             '-shortest',
             tmp_out])

    tmp_out.replace(final_out)
    update(pid, progress='Đã ghép xong video')
    return final_out
