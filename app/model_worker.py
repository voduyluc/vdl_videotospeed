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


def transcribe(pid, model=None):
    from app.core import db
    p = folder(pid)
    total = duration(p / 'stt.wav')
    chunk_seconds = int(os.getenv('STT_CHUNK_SECONDS', '300'))
    if chunk_seconds < 30:
        raise ValueError('STT_CHUNK_SECONDS must be >= 30')
    with db() as c:
        row = c.execute('SELECT source_language FROM projects WHERE id=?', (pid,)).fetchone()
    lang = row['source_language'] if row and 'source_language' in row.keys() and row['source_language'] else 'ko'
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
    write_json(p / 'segments.json', normalized)


def load_tts():
    from vieneu import Vieneu
    return Vieneu(mode='v3turbo', max_batch_size=1)


def synthesize(pid, model=None):
    from pathlib import Path
    from app.core import db
    with db() as c:
        row = c.execute('SELECT voice FROM projects WHERE id=?', (pid,)).fetchone()
        voice = row['voice']
        v_row = c.execute('SELECT * FROM voices WHERE id=?', (voice,)).fetchone()
    p = folder(pid)
    (p / 'tts').mkdir(exist_ok=True)
    segments = read_json(p / 'segments.json')
    model = model or load_tts()

    # Pre-register clone voice profile into model once if supported
    sample_file = None
    if v_row:
        sample_file = Path(v_row['sample_file'])
        registered = getattr(model, '_registered_clone_voices', set())
        if voice not in registered:
            if hasattr(model, 'add_voice') and sample_file.exists():
                try:
                    model.add_voice(voice, str(sample_file))
                    registered.add(voice)
                    setattr(model, '_registered_clone_voices', registered)
                except Exception:
                    pass

    manifest = []
    for i, s in enumerate(segments):
        text = s['translation'].strip()
        if not text:
            raise ValueError(f"Missing translation: {s['id']}")
        key = tts_key(text, voice)
        path = p / 'tts' / f'{key}.wav'
        if not path.exists():
            temporary = path.with_name(key + '.tmp.wav')
            registered_voices = getattr(model, '_registered_clone_voices', set())
            if voice in registered_voices:
                audio_res = model.infer(text, voice=voice)
            elif v_row and sample_file and sample_file.exists():
                audio_res = model.infer(text, ref_audio=str(sample_file))
            else:
                audio_res = model.infer(text, voice=voice)
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
