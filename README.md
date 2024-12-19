# Voice Llama

[![Docker Build](https://github.com/owner/voice-llama/actions/workflows/docker-build.yml/badge.svg)](https://github.com/owner/voice-llama/actions/workflows/docker-build.yml)

A voice-activated LLM chat application that combines voice detection, speech-to-text, text-to-speech, and Ollama LLM capabilities.

## Docker Image

The Docker image is available from the GitHub Container Registry:

```bash
docker pull ghcr.io/owner/voice-llama:latest
```

## Prerequisites

- Docker
- Docker Compose

## Quick Start

1. Clone the repository:
```bash
git clone <repository-url>
cd voice-llama
```

2. Start the application:
```bash
docker compose up --build
```

3. Access the application:
- Open https://localhost:8443 in your browser
- Accept the self-signed certificate warning
- Start chatting with voice or text input

## Features

- Voice Activity Detection (VAD) using @ricky0123/vad-web
- Speech-to-Text (STT) and Text-to-Speech (TTS) capabilities
- Integration with Ollama LLM
- Real-time voice input with visual feedback
- Dark-themed, responsive user interface
- Secure HTTPS communication

## Architecture

- Frontend: HTML, CSS, JavaScript
- Backend: Python HTTPS server
- LLM: Ollama running in Docker
- Services:
  - Voice Activity Detection (Browser-based)
  - Speech-to-Text API (Port 8060)
  - Text-to-Speech API (Port 8050)
  - Ollama API (Port 11434)

## Development

To run the application in development mode:

1. Start the services:
```bash
docker compose up
```

2. The application will hot-reload when you make changes to the files.

## Security Notes

- The application uses self-signed certificates for HTTPS
- In production, replace the self-signed certificates with proper SSL certificates
- All API communication is proxied through the HTTPS server

## License

MIT