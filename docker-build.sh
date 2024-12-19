#!/bin/bash
docker build -t voice-llama .
echo "To run Voice Llama:"
echo "docker run -p 8443:8443 voice-llama"