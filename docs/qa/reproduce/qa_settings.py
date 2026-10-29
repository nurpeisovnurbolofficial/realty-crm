from pathlib import Path
from config.settings import *  # noqa: F403

QA_ROOT = Path(__file__).resolve().parent
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': QA_ROOT / 'qa.sqlite3'}}
CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
DEBUG = True
DEMO_MODE = False
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
JWT_COOKIE_SECURE = False
STATIC_ROOT = QA_ROOT / 'staticfiles'
SECRET_KEY = 'local-synthetic-qa-fixture-not-for-deployment'
