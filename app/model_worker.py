"""Short-lived GPU processes. Model imports never enter the web/API process."""
import hashlib
import math
import os
import sys

from app.core import duration, folder, read_json, run, update, write_json


def load_stt():
    from faster_whisper import WhisperModel
    return WhisperModel(os.getenv('WHISPER_MODEL', 'large-v3'),
                        device=os.getenv('WHISPER_DEVICE', 'cuda'),
                        compute_type=os.getenv('WHISPER_COMPUTE', 'int8_float16'))


def transcribe(pid, model=None):
    p = folder(pid)
    total = duration(p / 'stt.wav')
    chunk_seconds = int(os.getenv('STT_CHUNK_SECONDS', '300'))
    if chunk_seconds < 30:
        raise ValueError('STT_CHUNK_SECONDS must be >= 30')
    model = model or load_stt()
    result = []
    # Disjoint audio windows preserve a deterministic checkpoint boundary. A small
    # boundary sentence can require manual correction; do not silently duplicate it.
    for i in range(math.ceil(total / chunk_seconds)):
        checkpoint = p / f'stt-{i:05}.json'
        if checkpoint.exists():
            rows = read_json(checkpoint)
        else:
            offset = i * chunk_seconds
            chunk = p / 'chunk.wav'
            run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-ss', offset,
                 '-i', p / 'stt.wav', '-t', chunk_seconds, chunk])
            segments, _ = model.transcribe(str(chunk), language='ko', task='transcribe',
                                            vad_filter=True, beam_size=5,
                                            condition_on_previous_text=False)
            rows = [{'start': offset + s.start, 'end': min(total, offset + s.end),
                     'source': s.text.strip()} for s in segments if s.text.strip()]
            write_json(checkpoint, rows)
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

    from app.core import db
    with db() as c:
        voice = c.execute('SELECT voice FROM projects WHERE id=?', (pid,)).fetchone()['voice']
    p = folder(pid)
    (p / 'tts').mkdir(exist_ok=True)
    segments = read_json(p / 'segments.json')
    model = model or load_tts()
    manifest = []
    for i, s in enumerate(segments):
        text = s['translation'].strip()
        if not text:
            raise ValueError(f"Missing translation: {s['id']}")
        key = hashlib.sha256((text + '\0' + voice + '\0vieneu-3.8.3-v3turbo').encode()).hexdigest()
        path = p / 'tts' / f'{key}.wav'
        if not path.exists():
            temporary = path.with_name(key + '.tmp.wav')
            model.save(model.infer(text, voice=voice), str(temporary))
            duration(temporary)  # Verify the file before publishing the checkpoint.
            temporary.replace(path)
        manifest.append({'id': s['id'], 'file': str(path), 'duration': duration(path)})
        write_json(p / 'tts-manifest.json', manifest)
        update(pid, progress=f'TTS {i+1}/{len(segments)}')


if __name__ == '__main__':
    {'stt': transcribe, 'tts': synthesize}[sys.argv[1]](sys.argv[2])
