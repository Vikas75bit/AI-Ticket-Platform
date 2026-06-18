# Use an official lightweight Python runtime environment
FROM python:3.11-slim

# Set system environment adjustments to keep Python fast and clean
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Establish our secure app operations working directory
WORKDIR /app

# Install system dependencies needed for compiling certain packages if necessary
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy only the requirements sheet first to optimize Docker build caching layers
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of your local application code into the container layout
COPY . /app/

# Expose the internal port for FastAPI documentation visibility
EXPOSE 8000
