"""Short-lived GPU processes. Model imports never enter the web/API process."""
import math
import os
import sys

from app.core import duration, folder, read_json, run, tts_key, update, wav_duration, write_json


def _patch_av():
    try:
        import av
        _original_open = av.open

        def _patched_open(*args, **kwargs):
            try:
                return _original_open(*args, **kwargs)
            except TypeError as e:
                if 'metadata_errors' in str(e):
                    kwargs.pop('metadata_errors', None)
                    return _original_open(*args, **kwargs)
                raise

        av.open = _patched_open
    except Exception:
        pass


def load_stt():
    _patch_av()
    from faster_whisper import WhisperModel
    return WhisperModel(os.getenv('WHISPER_MODEL', 'large-v3'),
                        device=os.getenv('WHISPER_DEVICE', 'cuda'),
                        compute_type=os.getenv('WHISPER_COMPUTE', 'int8_float16'))


def classify_audio_gender(samples, sr=16000):
    """Estimate fundamental frequency (pitch) using normalized autocorrelation in pure NumPy."""
    import numpy as np
    if len(samples) < int(sr * 0.08):
        return None, None
    if isinstance(samples, np.ndarray) and samples.dtype == np.int16:
        samples = samples.astype(np.float32) / 32768.0
    win_len = int(sr * 0.05)  # 50ms
    hop = int(sr * 0.025)     # 25ms
    pitches = []
    min_lag = int(sr / 350)   # ~45
    max_lag = int(sr / 75)    # ~213
    for i in range(0, len(samples) - win_len, hop):
        frame = samples[i:i+win_len]
        energy = np.sum(frame ** 2)
        if energy < 1e-4:
            continue
        frame = frame - np.mean(frame)
        corr = np.correlate(frame, frame, mode='full')[win_len-1:]
        if corr[0] <= 0:
            continue
        norm_corr = corr / corr[0]
        search_range = norm_corr[min_lag:max_lag]
        if len(search_range) == 0:
            continue
        peak_idx = int(np.argmax(search_range)) + min_lag
        if norm_corr[peak_idx] > 0.35:
            pitches.append(sr / peak_idx)
    if not pitches:
        return None, None
    median_f0 = float(np.median(pitches))
    gender = 'male' if median_f0 < 165.0 else 'female'
    return gender, median_f0


def transcribe(pid, model=None):
    from app.core import db
    p = folder(pid)
    total = duration(p / 'stt.wav')
    chunk_seconds = int(os.getenv('STT_CHUNK_SECONDS', '300'))
    if chunk_seconds < 30:
        raise ValueError('STT_CHUNK_SECONDS must be >= 30')
    with db() as c:
        row = c.execute('SELECT source_language, multi_speaker, voice_male, voice_female, voice FROM projects WHERE id=?', (pid,)).fetchone()
    lang = row['source_language'] if row and 'source_language' in row.keys() and row['source_language'] else 'ko'
    multi_speaker = row['multi_speaker'] if row and 'multi_speaker' in row.keys() else 0
    voice_male = row['voice_male'] if row and 'voice_male' in row.keys() and row['voice_male'] else 'Hải Đăng'
    voice_female = row['voice_female'] if row and 'voice_female' in row.keys() and row['voice_female'] else 'Mai Anh'
    default_voice = row['voice'] if row and 'voice' in row.keys() and row['voice'] else voice_male
    model = model or load_stt()
    result = []
    # Disjoint audio windows preserve a deterministic checkpoint boundary. A small
    # boundary sentence can require manual correction; do not silently duplicate it.
    for i in range(math.ceil(total / chunk_seconds)):
        checkpoint = p / f'stt-{i:05}.json'
        rows = None
        if checkpoint.exists():
            data = read_json(checkpoint)
            if isinstance(data, dict) and data.get('language') == lang:
                rows = data.get('rows', [])
            elif isinstance(data, list) and lang == 'ko':
                rows = data
        if rows is None:
            offset = i * chunk_seconds
            chunk = p / 'chunk.wav'
            run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-ss', offset,
                 '-i', p / 'stt.wav', '-t', chunk_seconds, chunk])
            segments, _ = model.transcribe(str(chunk), language=lang, task='transcribe',
                                            vad_filter=True, beam_size=5,
                                            condition_on_previous_text=False)
            rows = [{'start': offset + s.start, 'end': min(total, offset + s.end),
                     'source': s.text.strip()} for s in segments if s.text.strip()]
            write_json(checkpoint, {'language': lang, 'rows': rows})
        result.extend(rows)
        update(pid, progress=f'STT {i+1}/{math.ceil(total/chunk_seconds)}')
    # Normalize occasional timestamp overlaps without shifting later dialogue.
    normalized = []
    for s in result:
        start = max(s['start'], normalized[-1]['end'] if normalized else 0)
        if s['end'] > start:
            normalized.append(dict(s, start=start, id=f'seg_{len(normalized)+1:05}', translation=''))
    if not normalized:
        raise RuntimeError('Không nhận dạng được lời thoại. Kiểm tra track audio đầu tiên.')

    if multi_speaker and (p / 'stt.wav').exists():
        import wave
        import numpy as np
        try:
            with wave.open(str(p / 'stt.wav'), 'rb') as wf:
                sr = wf.getframerate()
                total_frames = wf.getnframes()
                last_gender = 'male'
                for s in normalized:
                    start_f = max(0, min(total_frames, int(s['start'] * sr)))
                    end_f = max(0, min(total_frames, int(s['end'] * sr)))
                    n_frames = end_f - start_f
                    if n_frames > int(sr * 0.08):
                        wf.setpos(start_f)
                        raw_bytes = wf.readframes(n_frames)
                        samples = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                        gender, _ = classify_audio_gender(samples, sr)
                    else:
                        gender = None
                    if not gender:
                        gender = last_gender
                    last_gender = gender
                    s['gender'] = gender
                    s['speaker'] = 'Nam' if gender == 'male' else 'Nữ'
                    s['voice'] = voice_male if gender == 'male' else voice_female
        except Exception:
            for s in normalized:
                s['gender'] = 'male'
                s['speaker'] = 'Nam'
                s['voice'] = voice_male
    else:
        for s in normalized:
            s['gender'] = None
            s['speaker'] = None
            s['voice'] = default_voice

    write_json(p / 'segments.json', normalized)


def load_tts():
    from vieneu import Vieneu
    return Vieneu(mode='v3turbo', max_batch_size=1)


def synthesize(pid, model=None):
    from pathlib import Path
    from app.core import db
    with db() as c:
        row = c.execute('SELECT voice, voice_male, voice_female, multi_speaker FROM projects WHERE id=?', (pid,)).fetchone()
        project_voice = row['voice'] if row and 'voice' in row.keys() and row['voice'] else 'Hải Đăng'
        all_voices = [dict(v) for v in c.execute('SELECT * FROM voices')]
        v_map = {v['id']: v for v in all_voices}
    p = folder(pid)
    (p / 'tts').mkdir(exist_ok=True)
    segments = read_json(p / 'segments.json')
    model = model or load_tts()

    def ensure_voice_registered(v_name):
        v_info = v_map.get(v_name)
        if v_info:
            sample_file = Path(v_info['sample_file'])
            registered = getattr(model, '_registered_clone_voices', set())
            if v_name not in registered:
                if hasattr(model, 'add_voice') and sample_file.exists():
                    try:
                        model.add_voice(v_name, str(sample_file))
                        registered.add(v_name)
                        setattr(model, '_registered_clone_voices', registered)
                    except Exception:
                        pass
        return v_info

    manifest = []
    for i, s in enumerate(segments):
        text = s['translation'].strip()
        if not text:
            raise ValueError(f"Missing translation: {s['id']}")
        seg_voice = s.get('voice') or project_voice
        key = tts_key(text, seg_voice)
        path = p / 'tts' / f'{key}.wav'
        if not path.exists():
            temporary = path.with_name(key + '.tmp.wav')
            v_info = ensure_voice_registered(seg_voice)
            registered_voices = getattr(model, '_registered_clone_voices', set())
            if seg_voice in registered_voices:
                audio_res = model.infer(text, voice=seg_voice)
            elif v_info and Path(v_info['sample_file']).exists():
                audio_res = model.infer(text, ref_audio=str(v_info['sample_file']))
            else:
                audio_res = model.infer(text, voice=seg_voice)
            model.save(audio_res, str(temporary))
            seconds = wav_duration(temporary)  # Verify before publishing the checkpoint.
            temporary.replace(path)
        else:
            seconds = wav_duration(path)
        manifest.append({'id': s['id'], 'file': str(path), 'duration': seconds})
        write_json(p / 'tts-manifest.json', manifest)
        update(pid, progress=f'TTS {i+1}/{len(segments)}')


if __name__ == '__main__':
    {'stt': transcribe, 'tts': synthesize}[sys.argv[1]](sys.argv[2])
