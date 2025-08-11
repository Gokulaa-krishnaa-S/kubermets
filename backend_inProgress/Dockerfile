FROM python:3.11-slim

WORKDIR /app

# Install dependencies + PostgreSQL
RUN apt-get update && apt-get install -y \
    build-essential \
    postgresql \
    postgresql-contrib \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*


# Copy requirements first (for Docker caching)
COPY requirenments.txt .

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirenments.txt

# Copy app source code + .env file
COPY . .

# Create Postgres data directory
RUN mkdir -p /var/lib/postgresql/data && chown -R postgres:postgres /var/lib/postgresql

EXPOSE 8000 5432

# Run PostgreSQL, setup.py update, then start app
CMD bash -c "\
    chown -R postgres:postgres /var/lib/postgresql && \
    su postgres -c 'initdb -D /var/lib/postgresql/data' && \
    su postgres -c 'pg_ctl -D /var/lib/postgresql/data -o \"-c listen_addresses=*\" -w start' && \
    # python setup.py update && \
    python app.py \
"
