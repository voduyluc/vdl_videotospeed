import os
import tempfile
from pathlib import Path

# One shared fixture, whether unittest discovers modules or imports the package.
temporary = tempfile.TemporaryDirectory(prefix='.testdata-', dir=Path(__file__).resolve().parents[1])
os.environ['DATA_DIR'] = temporary.name
os.environ['APP_PASSWORD'] = 'test-password'

from app import core
core.init_db()
