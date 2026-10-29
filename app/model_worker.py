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
    """Estimate speaker gender from speech audio using normalized autocorrelation with
    first-prominent-peak selection, low-frequency pre-emphasis, and spectral centroid fusion.
    """
    import numpy as np
    if len(samples) < int(sr * 0.08):
        return None, None
    if isinstance(samples, np.ndarray) and samples.dtype == np.int16:
        samples = samples.astype(np.float32) / 32768.0

    # 1. Pre-emphasis / high-pass filter: y[n] = x[n] - 0.95 * x[n-1]
    # Attenuates low-frequency rumble (< 70 Hz), room HVAC noise, and DC bias
    pre_emp = np.empty_like(samples)
    pre_emp[0] = samples[0]
    pre_emp[1:] = samples[1:] - 0.95 * samples[:-1]

    win_len = int(sr * 0.05)   # 50ms window
    hop = int(sr * 0.025)      # 25ms hop
    min_lag = max(2, int(sr / 500))  # Up to 500 Hz (~32 samples at 16kHz)
    max_lag = min(win_len - 2, int(sr / 65))   # Down to 65 Hz (~246 samples at 16kHz)

    pitches = []
    centroids = []

    for i in range(0, len(samples) - win_len, hop):
        raw_frame = samples[i:i+win_len]
        energy = np.sum(raw_frame ** 2)
        if energy < 1e-4:
            continue

        frame = pre_emp[i:i+win_len]
        frame = frame - np.mean(frame)

        corr = np.correlate(frame, frame, mode='full')[win_len - 1:]
        if corr[0] <= 0:
            continue
        norm_corr = corr / corr[0]

        # Search for local peaks in [min_lag, max_lag]
        search = norm_corr[min_lag:max_lag]
        if len(search) < 3:
            continue

        peaks = []
        for k in range(min_lag + 1, min_lag + len(search) - 1):
            if norm_corr[k] > norm_corr[k - 1] and norm_corr[k] >= norm_corr[k + 1]:
                if norm_corr[k] >= 0.28:
                    peaks.append((k, norm_corr[k]))

        if not peaks:
            continue

        max_peak_val = max(p[1] for p in peaks)
        # Select first prominent peak (at least 65% of max peak height) to prevent octave doubling (pitch halving)
        chosen_lag = None
        for lag, val in peaks:
            if val >= 0.65 * max_peak_val:
                alpha = norm_corr[lag - 1]
                beta = norm_corr[lag]
                gamma = norm_corr[lag + 1]
                denom = 2 * (2 * beta - alpha - gamma)
                delta = (gamma - alpha) / denom if abs(denom) > 1e-6 else 0.0
                chosen_lag = lag + delta
                break

        if chosen_lag and chosen_lag > 0:
            f0 = sr / chosen_lag
            if 65.0 <= f0 <= 500.0:
                pitches.append(f0)
                fft = np.abs(np.fft.rfft(raw_frame * np.hanning(win_len)))
                freqs = np.fft.rfftfreq(win_len, d=1.0/sr)
                sc = np.sum(freqs * fft) / (np.sum(fft) + 1e-8)
                centroids.append(sc)

    if not pitches:
        return None, None

    median_f0 = float(np.median(pitches))
    median_sc = float(np.median(centroids)) if centroids else 1300.0

    # Composite gender score combining pitch and spectral centroid:
    # Female vocal tract length is ~15% shorter than male, giving higher formants and spectral centroid (> 1500 Hz).
    # Typical adult male mean F0 is ~110-120 Hz; adult female is ~180-220 Hz.
    # Base threshold: 148 Hz. If a mature female voice has lower pitch (~150-160 Hz),
    # high spectral centroid elevates composite score to correctly classify as female.
    composite_score = median_f0 + 0.035 * (median_sc - 1300.0)
    gender = 'male' if composite_score < 148.0 else 'female'
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
                
                # Pass 1: compute pitch and features for each segment
                seg_results = []
                all_valid_pitches = []
                for s in normalized:
                    start_f = max(0, min(total_frames, int(s['start'] * sr)))
                    end_f = max(0, min(total_frames, int(s['end'] * sr)))
                    n_frames = end_f - start_f
                    if n_frames > int(sr * 0.08):
                        wf.setpos(start_f)
                        raw_bytes = wf.readframes(n_frames)
                        samples = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                        gender, f0 = classify_audio_gender(samples, sr)
                    else:
                        gender, f0 = None, None
                    seg_results.append((gender, f0))
                    if f0 is not None and 65.0 <= f0 <= 500.0:
                        all_valid_pitches.append(f0)

                # Video-level adaptive calibration for 2-speaker dialogues/interviews (e.g. 1 male, 1 female)
                adaptive_thresh = None
                if len(all_valid_pitches) >= 4:
                    arr = np.array(all_valid_pitches)
                    c1, c2 = float(np.percentile(arr, 25)), float(np.percentile(arr, 75))
                    for _ in range(8):
                        g1 = arr[np.abs(arr - c1) <= np.abs(arr - c2)]
                        g2 = arr[np.abs(arr - c1) > np.abs(arr - c2)]
                        if len(g1) == 0 or len(g2) == 0:
                            break
                        c1 = float(np.mean(g1))
                        c2 = float(np.mean(g2))
                    if c1 > c2:
                        c1, c2 = c2, c1
                    # Two distinct speaker clusters spanning across male/female ranges
                    if (c2 - c1 >= 25.0) and (c1 < 145.0) and (c2 > 140.0):
                        adaptive_thresh = (c1 + c2) / 2.0

                last_gender = 'male'
                for idx, s in enumerate(normalized):
                    gender, f0 = seg_results[idx]
                    if adaptive_thresh is not None and f0 is not None:
                        gender = 'female' if f0 >= adaptive_thresh else 'male'
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
