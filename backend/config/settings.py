"""
Django settings for Realty CRM.

Secrets and environment-specific values come from environment variables,
with safe defaults for local development.
"""

import os
import sys
from datetime import timedelta
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
TESTING = sys.argv[1:2] == ['test']


# --- Security -----------------------------------------------------------------

DEBUG = os.environ.get('DJANGO_DEBUG', '1') == '1'

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    if not DEBUG:
        # Never fall back to a key that is public in the repository.
        raise ImproperlyConfigured('DJANGO_SECRET_KEY must be set when DJANGO_DEBUG=0.')
    SECRET_KEY = 'django-insecure-local-dev-key'

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
CSRF_TRUSTED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']  # Vite dev server

# Render sets this variable automatically with the app's public hostname.
RENDER_EXTERNAL_HOSTNAME = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)
    CSRF_TRUSTED_ORIGINS.append(f'https://{RENDER_EXTERNAL_HOSTNAME}')

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True
    SECURE_REDIRECT_EXEMPT = [r'^api/health/$']  # the hosting health check calls plain HTTP inside the network
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    # HSTS: the browser remembers to use only HTTPS for this site (30 days).
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    # HSTS preload needs our own domain (we live on a subdomain of onrender.com), so it is skipped on purpose.
    SILENCED_SYSTEM_CHECKS = ['security.W021']

# Public demo: demo accounts are listed on the login page, deleting is disabled,
# and the demo data is recreated every time the server starts (after each sleep on free hosting).
DEMO_MODE = os.environ.get('DJANGO_DEMO_MODE', '1') == '1'


# --- Applications -------------------------------------------------------------

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'django_filters',
    'drf_spectacular',
    'rest_framework_simplejwt.token_blacklist',  # lets logout and rotation revoke refresh tokens
    'accounts',
    'crm',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',  # picks RU/EN from the Accept-Language header
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# --- Database -----------------------------------------------------------------
# Local development: SQLite file. Production: PostgreSQL (Neon) from DATABASE_URL.

DATABASES = {
    'default': dj_database_url.config(
        default=f'sqlite:///{BASE_DIR / "db.sqlite3"}',
        conn_max_age=600,
        conn_health_checks=True,
    )
}


# --- Cache --------------------------------------------------------------------
# Stored in the database, so all server processes share login-attempt counters.
# (In-memory cache would give every gunicorn worker its own counter.)

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.db.DatabaseCache',
        'LOCATION': 'cache_table',
    }
}


# --- Auth ---------------------------------------------------------------------

ADMIN_LOGIN_MAX_FAILURES = 5  # wrong passwords per IP before the admin login is locked
ADMIN_LOGIN_LOCKOUT_MINUTES = 15

AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# --- REST API -----------------------------------------------------------------

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['accounts.authentication.CookieJWTAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'crm.pagination.StandardPagination',
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_RATES': {'login': '10/min'},  # brute-force protection for the login endpoint
    'EXCEPTION_HANDLER': 'crm.exceptions.api_exception_handler',
}
if RENDER_EXTERNAL_HOSTNAME:
    # Behind Render's proxy: take the client IP from the last X-Forwarded-For entry (earlier ones can be faked),
    # otherwise an attacker could bypass the login throttle by sending a random header.
    REST_FRAMEWORK['NUM_PROXIES'] = 1

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,  # an old refresh token stops working once it has been used
    'UPDATE_LAST_LOGIN': True,
}

# Tokens live in httpOnly cookies: JavaScript cannot read them, so an XSS bug cannot steal them.
JWT_ACCESS_COOKIE = 'access_token'
JWT_REFRESH_COOKIE = 'refresh_token'
JWT_COOKIE_SECURE = not DEBUG
JWT_COOKIE_SAMESITE = 'Lax'

SPECTACULAR_SETTINGS = {
    'TITLE': 'Realty CRM API',
    'DESCRIPTION': 'CRM for a real estate agency: clients, properties, deals pipeline, tasks and analytics.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'ENUM_NAME_OVERRIDES': {
        'ClientKindEnum': 'crm.models.Client.Kind',
        'PropertyKindEnum': 'crm.models.Property.Kind',
        'ActivityKindEnum': 'crm.models.Activity.Kind',
        'PropertyStatusEnum': 'crm.models.Property.Status',
    },
}


# --- Internationalization -----------------------------------------------------

LANGUAGE_CODE = 'en'
LANGUAGES = [('en', 'English'), ('ru', 'Русский')]
TIME_ZONE = 'Asia/Almaty'  # Astana, UTC+5
USE_I18N = True
USE_TZ = True


# --- Static files and the React app -------------------------------------------

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# The built React app (frontend/dist). WhiteNoise serves its files from the site root.
FRONTEND_DIST = Path(os.environ.get('FRONTEND_DIST', BASE_DIR.parent / 'frontend' / 'dist'))
WHITENOISE_ROOT = FRONTEND_DIST if FRONTEND_DIST.exists() else None


def _immutable_file(path, url):
    # Vite puts a content hash into every file name in /assets/, so browsers may cache them forever.
    return url.startswith('/assets/') or url.startswith(f'/{STATIC_URL}')


WHITENOISE_IMMUTABLE_FILE_TEST = _immutable_file

STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}
if TESTING:
    # Tests do not run collectstatic, so the hashed-file manifest does not exist.
    STORAGES['staticfiles'] = {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
