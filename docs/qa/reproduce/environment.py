import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if not os.environ.get('REALTY_CRM_BACKEND'):
    raise RuntimeError('Set REALTY_CRM_BACKEND to the cloned Realty CRM backend directory.')
SOURCE = Path(os.environ['REALTY_CRM_BACKEND']).resolve()
if not (SOURCE / 'manage.py').is_file():
    raise RuntimeError('REALTY_CRM_BACKEND must contain manage.py.')
os.environ['DJANGO_SETTINGS_MODULE'] = 'qa_settings'
os.environ['PYTHONDONTWRITEBYTECODE'] = '1'
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT))
sys.path.insert(1, str(SOURCE))
