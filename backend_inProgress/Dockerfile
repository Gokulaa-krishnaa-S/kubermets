FROM python:3.11-slim

WORKDIR /app

# Install build dependencies, Postgres client tools, and dev libs
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirenments.txt .

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirenments.txt

# Copy app source
COPY . .

EXPOSE 8000

# Wait for DB, run setup, then start app
CMD bash -c "until pg_isready -h db -p 5432 -U postgres; do echo 'Waiting for Postgres...'; sleep 1; done && python setup.py create && python app.py"
