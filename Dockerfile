# Use Python base image
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Copy application files
COPY . .

# Install any needed packages
RUN pip install --no-cache-dir -r requirements.txt || true

# Generate self-signed certificate if not exists
RUN if [ ! -f cert.pem ] || [ ! -f key.pem ]; then \
    apt-get update && \
    apt-get install -y openssl && \
    openssl req -x509 -newkey rsa:4096 -nodes \
    -out /app/cert.pem -keyout /app/key.pem -days 365 \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" && \
    apt-get remove -y openssl && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*; \
    fi

# Expose the HTTPS port
EXPOSE 8443

# Command to run the server
CMD ["python", "https_server.py"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
    CMD curl -k -f https://localhost:8443/ || exit 1