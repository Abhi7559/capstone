FROM python:3.12-slim-bookworm

WORKDIR /app

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy project metadata & lockfile first for layer caching
COPY pyproject.toml uv.lock ./

# Install dependencies using uv sync into virtual environment
RUN uv sync --frozen --no-dev

# Copy application source code and migrations
COPY alembic.ini ./
COPY alembic ./alembic
COPY core ./core
COPY dao ./dao
COPY database ./database
COPY dependencies ./dependencies
COPY exceptions ./exceptions
COPY models ./models
COPY routes ./routes
COPY schemas ./schemas
COPY services ./services
COPY templates ./templates
COPY main.py ./
COPY entrypoint.sh ./

RUN chmod +x ./entrypoint.sh

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app" \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HOST=0.0.0.0

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
