# Multi-stage build: one image with the Django API and the built React app.

# --- Stage 1: build the React app ------------------------------------------------
FROM node:24-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: the Python app that serves the API and the React files -------------
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FRONTEND_DIST=/app/frontend_dist

WORKDIR /app

# Dependencies first, so Docker reuses this layer when only the code changes.
COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend/ ./
COPY --from=frontend /app/frontend/dist /app/frontend_dist

RUN DJANGO_DEBUG=1 python manage.py collectstatic --no-input \
    && useradd --create-home appuser \
    && chown -R appuser /app
USER appuser

EXPOSE 8000
# Render passes the port in $PORT. Migrations run on start: safe for a single instance.
CMD ["sh", "-c", "python manage.py migrate --no-input && python manage.py seed_demo && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2"]
