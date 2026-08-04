# Use a lightweight python base image
FROM python:3.10-slim

# Set environment variables for clean logs and performance
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Set work directory
WORKDIR /workspace

# Install system dependencies required for compilation of C++ libraries (e.g. FAISS/PyMuPDF)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements first to optimize Docker layer caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the entire backend application code
COPY . .

# Create directories for file uploads and FAISS index persistence
RUN mkdir -p uploads faiss_index

# Expose uvicorn port
EXPOSE 8000

# Start application using uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
