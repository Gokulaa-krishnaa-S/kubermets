FROM python:3.11-slim

WORKDIR /app

# Install build dependencies, Postgres client tools, and dev libs
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy app source
COPY . .

EXPOSE 5000

# Wait for DB, run setup, then start app
# CMD bash -c "until pg_isready -h db -p 5432 -U postgres; do echo 'Waiting for Postgres...'; sleep 1; done && python setup.py create && python app.py"

CMD ["python", "setup.py", "create", "&&", "gunicorn", "--bind", "0.0.0.0:5000", "app:app", "--workers=4", "--threads=2", "--timeout=120"]
