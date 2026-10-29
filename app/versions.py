import re
import shutil
import time
from pathlib import Path
from app.core import DATA, db, folder, read_json, update, write_json

CANDIDATE_EXPORTS = (
    'dubbed_video.mp4', 'mixed.mp3', 'mixed.wav',
    'narration.wav', 'narration.mp3', 'vi.srt',
    'ko.srt', 'en.srt', 'ja.srt', 'zh.srt'
)


def format_voice_label(row: dict) -> str:
    if not row:
        return 'Hải Đăng'
    if row.get('multi_speaker'):
        vm = row.get('voice_male') or 'Hải Đăng'
        vf = row.get('voice_female') or 'Mai Anh'
        return f"Nam: {vm}, Nữ: {vf}"
    return row.get('voice') or 'Hải Đăng'


def get_project_versions(pid: str, row: dict | None = None) -> dict:
    p_dir = folder(pid)
    v_file = p_dir / 'versions.json'
    src_lang = (row.get('source_language') if row else None) or 'ko'
    candidate_set = CANDIDATE_EXPORTS + (f'{src_lang}.srt',)

    if not v_file.exists():
        has_audio = any((p_dir / f).exists() for f in ('mixed.wav', 'mixed.mp3', 'narration.wav', 'narration.mp3'))
        has_video = (p_dir / 'dubbed_video.mp4').exists()
        current_exports = [f for f in candidate_set if (p_dir / f).exists()]
        init_ver = {
            'id': 'v1.0',
            'voice': format_voice_label(row or {}),
            'created_at': (row.get('completed_at') if row else None) or (row.get('created') if row else None) or time.time(),
            'is_current': True,
            'has_audio': has_audio,
            'has_video': has_video,
            'exports': list(dict.fromkeys(current_exports))
        }
        data = {
            'current_version_id': 'v1.0',
            'versions': [init_ver]
        }
        if p_dir.exists():
            write_json(v_file, data)
        return data

    data = read_json(v_file, {'current_version_id': 'v1.0', 'versions': []})
    cur_id = data.get('current_version_id', 'v1.0')
    versions_list = data.get('versions', [])

    # Synchronize current version with disk
    for v in versions_list:
        if v['id'] == cur_id:
            v['is_current'] = True
            v['has_audio'] = any((p_dir / f).exists() for f in ('mixed.wav', 'mixed.mp3', 'narration.wav', 'narration.mp3'))
            v['has_video'] = (p_dir / 'dubbed_video.mp4').exists()
            current_exports = [f for f in candidate_set if (p_dir / f).exists()]
            v['exports'] = list(dict.fromkeys(current_exports))
            if row:
                v['voice'] = format_voice_label(row)
        else:
            v['is_current'] = False
            ver_dir = p_dir / 'versions' / v['id']
            if ver_dir.exists():
                v['has_audio'] = any((ver_dir / f).exists() for f in ('mixed.wav', 'mixed.mp3', 'narration.wav', 'narration.mp3'))
                v['has_video'] = (ver_dir / 'dubbed_video.mp4').exists()
                ver_exports = [f for f in candidate_set if (ver_dir / f).exists()]
                v['exports'] = list(dict.fromkeys(ver_exports))

    # Ensure current version is in versions_list
    if not any(v['id'] == cur_id for v in versions_list):
        has_audio = any((p_dir / f).exists() for f in ('mixed.wav', 'mixed.mp3', 'narration.wav', 'narration.mp3'))
        has_video = (p_dir / 'dubbed_video.mp4').exists()
        current_exports = [f for f in candidate_set if (p_dir / f).exists()]
        new_v = {
            'id': cur_id,
            'voice': format_voice_label(row or {}),
            'created_at': time.time(),
            'is_current': True,
            'has_audio': has_audio,
            'has_video': has_video,
            'exports': list(dict.fromkeys(current_exports))
        }
        versions_list.insert(0, new_v)

    data['versions'] = versions_list
    if p_dir.exists():
        write_json(v_file, data)
    return data


def archive_and_create_new_version(pid: str, row: dict, new_voice: str | None = None,
                                   new_voice_male: str | None = None,
                                   new_voice_female: str | None = None) -> dict:
    p_dir = folder(pid)
    has_audio = any((p_dir / f).exists() for f in ('mixed.wav', 'mixed.mp3', 'narration.wav', 'narration.mp3'))
    has_video = (p_dir / 'dubbed_video.mp4').exists()

    data = get_project_versions(pid, row)
    cur_id = data.get('current_version_id', 'v1.0')

    # If no audio or video has been generated yet for the current version, just update voice
    if not has_audio and not has_video:
        new_row = dict(row)
        if new_voice:
            new_row['voice'] = new_voice
        if new_voice_male:
            new_row['voice_male'] = new_voice_male
        if new_voice_female:
            new_row['voice_female'] = new_voice_female
        new_label = format_voice_label(new_row)
        for v in data.get('versions', []):
            if v['id'] == cur_id:
                v['voice'] = new_label
        write_json(p_dir / 'versions.json', data)
        return data

    # Current version has audio/video -> archive it!
    v_dir = p_dir / 'versions' / cur_id
    v_dir.mkdir(parents=True, exist_ok=True)

    # 1. Move audio & video files into archive directory
    move_files = ('dubbed_video.mp4', 'mixed.mp3', 'mixed.wav', 'narration.wav', 'narration.mp3', 'tts-manifest.json')
    for f in move_files:
        src = p_dir / f
        if src.exists():
            shutil.move(str(src), str(v_dir / f))

    # 2. Copy subtitle and segment files into archive directory
    src_lang = row.get('source_language') or 'ko'
    copy_files = ('vi.srt', f'{src_lang}.srt', 'ko.srt', 'en.srt', 'ja.srt', 'zh.srt', 'segments.json')
    for f in copy_files:
        src = p_dir / f
        if src.exists():
            shutil.copy2(str(src), str(v_dir / f))

    # 3. Clean working tts cache
    if (p_dir / 'tts').exists():
        shutil.rmtree(str(p_dir / 'tts'), ignore_errors=True)

    # 4. Mark old version
    candidate_set = CANDIDATE_EXPORTS + (f'{src_lang}.srt',)
    archived_exports = [f for f in candidate_set if (v_dir / f).exists()]
    for v in data.get('versions', []):
        if v['id'] == cur_id:
            v['is_current'] = False
            v['has_audio'] = any((v_dir / f).exists() for f in ('mixed.wav', 'mixed.mp3', 'narration.wav', 'narration.mp3'))
            v['has_video'] = (v_dir / 'dubbed_video.mp4').exists()
            v['exports'] = list(dict.fromkeys(archived_exports))

    # 5. Determine next version ID (e.g. v1.0 -> v1.1, v1.1 -> v1.2)
    existing_ids = [v['id'] for v in data.get('versions', [])]
    minors = []
    for vid in existing_ids:
        m = re.match(r'v1\.(\d+)', vid)
        if m:
            minors.append(int(m.group(1)))
    next_minor = (max(minors) + 1) if minors else 1
    next_id = f"v1.{next_minor}"

    # 6. Format voice label for new version
    new_row = dict(row)
    if new_voice:
        new_row['voice'] = new_voice
    if new_voice_male:
        new_row['voice_male'] = new_voice_male
    if new_voice_female:
        new_row['voice_female'] = new_voice_female
    new_voice_label = format_voice_label(new_row)

    # 7. New version has subtitles only, NO audio or video
    new_exports = [f for f in ('vi.srt', f'{src_lang}.srt', 'ko.srt', 'en.srt', 'ja.srt', 'zh.srt') if (p_dir / f).exists()]
    new_ver = {
        'id': next_id,
        'voice': new_voice_label,
        'created_at': time.time(),
        'is_current': True,
        'has_audio': False,
        'has_video': False,
        'exports': list(dict.fromkeys(new_exports))
    }

    data['versions'] = [new_ver] + [v for v in data['versions'] if v['id'] != next_id]
    data['current_version_id'] = next_id
    write_json(p_dir / 'versions.json', data)

    # 8. Record in SQLite table
    try:
        with db() as c:
            c.execute('INSERT OR REPLACE INTO project_versions (project_id, version_id, voice, created_at, has_audio, has_video) VALUES (?, ?, ?, ?, ?, ?)',
                      (pid, cur_id, format_voice_label(row), row.get('completed_at') or time.time(), 1 if has_audio else 0, 1 if has_video else 0))
            c.execute('INSERT OR REPLACE INTO project_versions (project_id, version_id, voice, created_at, has_audio, has_video) VALUES (?, ?, ?, ?, ?, ?)',
                      (pid, next_id, new_voice_label, time.time(), 0, 0))
    except Exception:
        pass

    return data


def restore_version(pid: str, ver_id: str, row: dict) -> dict:
    from fastapi import HTTPException
    p_dir = folder(pid)
    data = get_project_versions(pid, row)
    target = next((v for v in data.get('versions', []) if v['id'] == ver_id), None)
    if not target:
        raise HTTPException(404, f'Phiên bản {ver_id} không tồn tại')

    cur_id = data.get('current_version_id', 'v1.0')
    if ver_id == cur_id:
        return data

    v_dir = p_dir / 'versions' / ver_id
    if not v_dir.exists():
        raise HTTPException(404, f'Thư mục dữ liệu phiên bản {ver_id} không tồn tại')

    # If current version has audio/video, archive current version to versions/{cur_id}
    has_audio = any((p_dir / f).exists() for f in ('mixed.wav', 'mixed.mp3', 'narration.wav', 'narration.mp3'))
    has_video = (p_dir / 'dubbed_video.mp4').exists()
    if has_audio or has_video:
        cur_v_dir = p_dir / 'versions' / cur_id
        cur_v_dir.mkdir(parents=True, exist_ok=True)
        for f in ('dubbed_video.mp4', 'mixed.mp3', 'mixed.wav', 'narration.wav', 'narration.mp3', 'tts-manifest.json'):
            src = p_dir / f
            if src.exists():
                shutil.move(str(src), str(cur_v_dir / f))
        for f in ('vi.srt', 'ko.srt', 'en.srt', 'ja.srt', 'zh.srt', 'segments.json'):
            src = p_dir / f
            if src.exists():
                shutil.copy2(str(src), str(cur_v_dir / f))

    # Copy target version files back to p_dir
    for item in v_dir.iterdir():
        if item.is_file():
            shutil.copy2(str(item), str(p_dir / item.name))

    # Update current version ID
    data['current_version_id'] = ver_id
    for v in data.get('versions', []):
        v['is_current'] = (v['id'] == ver_id)
    write_json(p_dir / 'versions.json', data)

    # Sync project row
    new_voice = target.get('voice', 'Hải Đăng')
    update_vals = {'state': 'completed', 'step': 'mux', 'error': None, 'progress': f'Đã khôi phục phiên bản {ver_id}'}
    if not row.get('multi_speaker'):
        update_vals['voice'] = new_voice
    update(pid, **update_vals)

    return data
