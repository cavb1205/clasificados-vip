# Imagen de producción del backend Django.
# Build: `docker build -t clasificados-vip-backend ./backend`
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

# Dependencias de sistema mínimas: libpq para psycopg, libjpeg/zlib para Pillow.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 libjpeg62-turbo zlib1g \
    && rm -rf /var/lib/apt/lists/*

# Usuario no-root para correr el proceso.
RUN useradd --create-home --shell /bin/bash --uid 1000 app

WORKDIR /app

# Instalar deps en una capa cacheable.
COPY requirements.txt .
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev libjpeg-dev zlib1g-dev \
    && pip install -r requirements.txt \
    && apt-get purge -y build-essential libpq-dev libjpeg-dev zlib1g-dev \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Código de la app.
COPY . .

# Directorios que se montan como volúmenes (media pública + KYC privado).
RUN mkdir -p /app/media /app/private_media /app/staticfiles \
    && chown -R app:app /app

USER app

EXPOSE 8000

COPY --chown=app:app entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", \
     "--bind=0.0.0.0:8000", \
     "--workers=3", \
     "--threads=2", \
     "--timeout=60", \
     "--access-logfile=-", \
     "--error-logfile=-"]
