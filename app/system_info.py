import ctypes
import os
import shutil
import subprocess
import time
from pathlib import Path

from app.core import DATA, ROOT

_breakdown_cache = {'time': 0, 'data': None}


def dir_size(path: Path | str) -> int:
    p = Path(path)
    if not p.exists():
        return 0
    if p.is_file():
        try:
            return p.stat().st_size
        except OSError:
            return 0
    total = 0
    try:
        for entry in os.scandir(p):
            try:
                if entry.is_file(follow_symlinks=False):
                    total += entry.stat().st_size
                elif entry.is_dir(follow_symlinks=False):
                    total += dir_size(entry.path)
            except OSError:
                continue
    except OSError:
        pass
    return total


def get_disk_breakdown():
    now = time.time()
    if _breakdown_cache['data'] and (now - _breakdown_cache['time'] < 15):
        return _breakdown_cache['data']

    # 1. Video files & Project data
    video_bytes = dir_size(DATA)

    # 2. AI Models: models dir + HuggingFace cache
    models_dir = ROOT / 'models'
    hf_cache = Path(os.getenv('HF_HOME', str(Path.home() / '.cache/huggingface')))
    models_bytes = dir_size(models_dir) + dir_size(hf_cache)

    # 3. App code & Python environments
    venvs = [ROOT / '.venv', ROOT / '.venv-stt', ROOT / '.venv-tts', ROOT / 'vendor']
    app_bytes = sum(dir_size(v) for v in venvs) + dir_size(ROOT / 'web') + dir_size(ROOT / 'app')

    result = {
        'video_and_data_bytes': video_bytes,
        'video_and_data_mb': round(video_bytes / 1024**2, 1),
        'video_and_data_gb': round(video_bytes / 1024**3, 2),
        'models_bytes': models_bytes,
        'models_mb': round(models_bytes / 1024**2, 1),
        'models_gb': round(models_bytes / 1024**3, 2),
        'app_and_env_bytes': app_bytes,
        'app_and_env_mb': round(app_bytes / 1024**2, 1),
        'app_and_env_gb': round(app_bytes / 1024**3, 2),
    }
    _breakdown_cache['time'] = now
    _breakdown_cache['data'] = result
    return result


def get_disk():
    total, used, free = shutil.disk_usage(DATA)
    total_gb = round(total / 1024**3, 1)
    used_gb = round(used / 1024**3, 1)
    free_gb = round(free / 1024**3, 1)
    pct = round((used / total) * 100, 1) if total > 0 else 0.0
    return {
        'total_gb': total_gb,
        'used_gb': used_gb,
        'free_gb': free_gb,
        'usage_pct': pct,
        'breakdown': get_disk_breakdown()
    }


def get_cpu():
    cores = os.cpu_count() or 1
    pct = 0.0
    if os.name == 'nt':
        try:
            class FILETIME(ctypes.Structure):
                _fields_ = [('dwLowDateTime', ctypes.c_ulong), ('dwHighDateTime', ctypes.c_ulong)]

            def to_int(ft):
                return (ft.dwHighDateTime << 32) | ft.dwLowDateTime

            idle, kernel, user = FILETIME(), FILETIME(), FILETIME()
            ctypes.windll.kernel32.GetSystemTimes(ctypes.byref(idle), ctypes.byref(kernel), ctypes.byref(user))
            i1, t1 = to_int(idle), to_int(kernel) + to_int(user)
            time.sleep(0.06)
            ctypes.windll.kernel32.GetSystemTimes(ctypes.byref(idle), ctypes.byref(kernel), ctypes.byref(user))
            i2, t2 = to_int(idle), to_int(kernel) + to_int(user)
            dt, di = t2 - t1, i2 - i1
            pct = round(max(0.0, min(100.0, (1.0 - di / dt) * 100)), 1) if dt > 0 else 0.0
        except Exception:
            pass
    else:
        try:
            def sample():
                with open('/proc/stat') as f:
                    fields = [float(x) for x in f.readline().strip().split()[1:8]]
                return sum(fields), fields[3]

            t1, i1 = sample()
            time.sleep(0.06)
            t2, i2 = sample()
            dt, di = t2 - t1, i2 - i1
            pct = round(max(0.0, min(100.0, (1.0 - di / dt) * 100)), 1) if dt > 0 else 0.0
        except Exception:
            pass
    return {'cores': cores, 'usage_pct': pct}


def get_ram():
    total_gb, used_gb, free_gb, pct = 0.0, 0.0, 0.0, 0.0
    if os.name == 'nt':
        try:
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ('dwLength', ctypes.c_ulong), ('dwMemoryLoad', ctypes.c_ulong),
                    ('ullTotalPhys', ctypes.c_ulonglong), ('ullAvailPhys', ctypes.c_ulonglong),
                    ('ullTotalPageFile', ctypes.c_ulonglong), ('ullAvailPageFile', ctypes.c_ulonglong),
                    ('ullTotalVirtual', ctypes.c_ulonglong), ('ullAvailVirtual', ctypes.c_ulonglong),
                    ('sullAvailExtendedVirtual', ctypes.c_ulonglong)
                ]

            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
            total_gb = round(stat.ullTotalPhys / 1024**3, 2)
            free_gb = round(stat.ullAvailPhys / 1024**3, 2)
            used_gb = round(total_gb - free_gb, 2)
            pct = round(stat.dwMemoryLoad, 1)
        except Exception:
            pass
    else:
        try:
            info = {}
            for line in Path('/proc/meminfo').read_text().splitlines():
                parts = line.split(':')
                if len(parts) == 2:
                    info[parts[0].strip()] = parts[1].strip()
            total_kb = int(info.get('MemTotal', '0 kB').split()[0])
            avail_kb = int(info.get('MemAvailable', '0 kB').split()[0])
            total_gb = round(total_kb / 1024**2, 2)
            free_gb = round(avail_kb / 1024**2, 2)
            used_gb = round(total_gb - free_gb, 2)
            pct = round((used_gb / total_gb) * 100, 1) if total_gb > 0 else 0.0
        except Exception:
            pass
    return {'total_gb': total_gb, 'used_gb': used_gb, 'free_gb': free_gb, 'usage_pct': pct}


def get_gpu():
    try:
        r = subprocess.run(['nvidia-smi', '--query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu',
                            '--format=csv,noheader,nounits'], capture_output=True, text=True, timeout=3)
        if r.returncode == 0 and r.stdout.strip():
            parts = [p.strip() for p in r.stdout.strip().splitlines()[0].split(',')]
            if len(parts) >= 5:
                name = parts[0]
                tot = float(parts[1])
                used = float(parts[2])
                free = float(parts[3])
                util = float(parts[4])
                vram_pct = round((used / tot) * 100, 1) if tot > 0 else 0.0
                return {
                    'available': True,
                    'name': name,
                    'vram_total_mb': round(tot),
                    'vram_used_mb': round(used),
                    'vram_free_mb': round(free),
                    'vram_usage_pct': vram_pct,
                    'gpu_util_pct': round(util)
                }
    except Exception:
        pass
    return {
        'available': False,
        'name': 'Không phát hiện GPU NVIDIA',
        'vram_total_mb': 0,
        'vram_used_mb': 0,
        'vram_free_mb': 0,
        'vram_usage_pct': 0.0,
        'gpu_util_pct': 0.0
    }


def get_usage():
    return {
        'cpu': get_cpu(),
        'ram': get_ram(),
        'gpu': get_gpu(),
        'disk': get_disk()
    }
