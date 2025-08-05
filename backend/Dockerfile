FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (optional: if you use Postgres, Pillow, etc.)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*


COPY requirements/common.txt requirements/
COPY requirements/develop.txt requirements/

RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements/common.txt
RUN pip install --no-cache-dir -r requirements/develop.txt

# Copy the app
COPY . .

# Expose FastAPI port
EXPOSE 8000

CMD ["python", "wsgi.py"]
