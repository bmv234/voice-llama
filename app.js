class VoiceLlama {
    constructor() {
        this.chatContainer = document.getElementById('chatContainer');
        this.textInput = document.getElementById('textInput');
        this.micButton = document.getElementById('micButton');
        this.sendButton = document.getElementById('sendButton');
        this.vad = null;
        this.isListening = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.sttAvailable = false;
        this.ttsAvailable = false;
        this.chatHistory = [];
        this.currentMessageDiv = null;

        // Initialize with a welcome message
        this.addMessage('Welcome to Voice Llama! Checking service availability...', 'bot');
        
        // Check services and initialize
        this.initializeServices();
    }

    async initializeServices() {
        await Promise.all([
            this.checkSTTService(),
            this.checkTTSService()
        ]);

        this.initializeEventListeners();
        this.initializeVAD();

        // Update status after all checks
        const status = [];
        if (this.sttAvailable) status.push('Speech-to-Text');
        if (this.ttsAvailable) status.push('Text-to-Speech');
        
        const availableServices = status.length > 0 
            ? `Available services: ${status.join(', ')}`
            : 'Running in text-only mode';
            
        this.addMessage(availableServices, 'bot');
    }

    async checkSTTService() {
        try {
            const response = await fetch('/proxy/stt', {
                method: 'OPTIONS'
            });
            this.sttAvailable = response.ok;
            console.log('STT service available');
        } catch (error) {
            console.error('STT service not available:', error);
            this.sttAvailable = false;
        }
    }

    async checkTTSService() {
        try {
            const response = await fetch('/proxy/tts', {
                method: 'OPTIONS'
            });
            this.ttsAvailable = response.ok;
            console.log('TTS service available');
        } catch (error) {
            console.error('TTS service not available:', error);
            this.ttsAvailable = false;
        }
    }

    async initializeVAD() {
        if (!this.sttAvailable) {
            this.micButton.disabled = true;
            this.micButton.style.opacity = '0.5';
            this.micButton.title = 'Speech-to-Text service not available';
            return;
        }

        try {
            this.vad = await window.vad.MicVAD.new({
                modelUrl: 'lib/silero_vad_legacy.onnx',
                workletUrl: 'lib/vad.worklet.bundle.min.js',
                threshold: 0.9,
                minSpeechFrames: 10,
                onSpeechStart: () => {
                    console.log('Speech started');
                    this.startRecording();
                    this.micButton.style.backgroundColor = '#28a745';
                },
                onSpeechEnd: () => {
                    console.log('Speech ended');
                    this.stopRecording();
                    this.micButton.style.backgroundColor = this.isListening ? '#dc3545' : '#dc3545';
                },
                onVADMisfire: () => {
                    console.log('VAD misfire');
                    this.stopRecording();
                    this.micButton.style.backgroundColor = this.isListening ? '#dc3545' : '#dc3545';
                },
                modelFrameLength: 1024,
                modelSampleRate: 16000
            });
            console.log('VAD initialized successfully');
            this.addMessage('Voice detection initialized. Click the microphone to start speaking.', 'bot');
        } catch (error) {
            console.error('Error initializing VAD:', error);
            this.addMessage('Voice detection initialization failed. Please use text input.', 'bot');
            this.micButton.disabled = true;
            this.micButton.style.opacity = '0.5';
        }
    }

    initializeEventListeners() {
        this.sendButton.addEventListener('click', () => this.handleSendMessage());
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSendMessage();
        });
        this.micButton.addEventListener('click', () => this.toggleVoiceInput());
    }

    async toggleVoiceInput() {
        if (!this.vad || !this.sttAvailable) {
            this.addMessage('Voice input is not available. Please use text input.', 'bot');
            return;
        }

        try {
            if (this.isListening) {
                await this.vad.stop();
                this.micButton.classList.remove('active');
                this.micButton.style.backgroundColor = '#dc3545';
            } else {
                await this.vad.start();
                this.micButton.classList.add('active');
                this.micButton.style.backgroundColor = '#dc3545';
                this.addMessage('Listening... Speak now.', 'bot');
            }
            this.isListening = !this.isListening;
        } catch (error) {
            console.error('Error toggling voice input:', error);
            this.addMessage('Error with voice input. Please try again.', 'bot');
            this.isListening = false;
            this.micButton.classList.remove('active');
            this.micButton.style.backgroundColor = '#dc3545';
        }
    }

    startRecording() {
        if (this.mediaRecorder) return;

        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                this.mediaRecorder = new MediaRecorder(stream);
                this.audioChunks = [];

                this.mediaRecorder.addEventListener('dataavailable', event => {
                    this.audioChunks.push(event.data);
                });

                this.mediaRecorder.addEventListener('stop', () => {
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                    this.sendAudioToSTT(audioBlob);
                });

                this.mediaRecorder.start();
            })
            .catch(error => {
                console.error('Error accessing microphone:', error);
                this.addMessage('Error accessing microphone. Please check permissions.', 'bot');
            });
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.mediaRecorder = null;
        }
    }

    async sendAudioToSTT(audioBlob) {
        if (!this.sttAvailable) {
            this.addMessage('Speech-to-Text service is not available.', 'bot');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'audio.wav');

            const response = await fetch('/proxy/stt', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('STT API request failed');

            const data = await response.json();
            if (data.text) {
                this.textInput.value = data.text;
                this.handleSendMessage();
                console.log(`Language: ${data.language}, Confidence: ${data.language_probability}`);
            }
        } catch (error) {
            console.error('Error in STT:', error);
            this.addMessage('Error converting speech to text. Please try again or use text input.', 'bot');
        }
    }

    async handleSendMessage() {
        const message = this.textInput.value.trim();
        if (!message) return;

        // Add user message to chat history and display
        this.chatHistory.push({ role: 'user', content: message });
        this.addMessage(message, 'user');
        this.textInput.value = '';
        this.sendButton.disabled = true;

        try {
            const response = await fetch('http://localhost:11434/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama3.2',
                    messages: [
                        { role: 'user', content: message }
                    ]
                })
            });

            if (!response.ok) throw new Error('Ollama API request failed');

            // Create a new message div for streaming response
            this.currentMessageDiv = document.createElement('div');
            this.currentMessageDiv.className = 'message bot-message';
            this.chatContainer.appendChild(this.currentMessageDiv);
            let fullResponse = '';

            // Set up streaming response handling
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                // Process the chunk
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;

                    try {
                        const data = JSON.parse(line);
                        if (data.message?.content) {
                            fullResponse += data.message.content;
                            this.currentMessageDiv.textContent = fullResponse;
                            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
                        }
                    } catch (e) {
                        console.error('Error parsing JSON:', e);
                    }
                }
            }

            // Add the complete response to chat history
            if (fullResponse) {
                this.chatHistory.push({ role: 'assistant', content: fullResponse });
                if (this.ttsAvailable) {
                    this.speakResponse(fullResponse);
                }
            }

        } catch (error) {
            console.error('Error in Ollama API:', error);
            this.addMessage('Error: Make sure Ollama is running locally (http://localhost:11434) with llama3.2 model', 'bot');
        } finally {
            this.sendButton.disabled = false;
            this.currentMessageDiv = null;
        }
    }

    async speakResponse(text) {
        if (!this.ttsAvailable) return;

        try {
            const response = await fetch('/proxy/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text })
            });

            if (!response.ok) throw new Error('TTS API request failed');

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            await audio.play();
        } catch (error) {
            console.error('Error in TTS:', error);
            // Silently fail TTS - don't show error message to user since they can still read the response
        }
    }

    addMessage(text, sender) {
        if (sender === 'bot' && this.currentMessageDiv) {
            this.currentMessageDiv.textContent = text;
        } else {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${sender}-message`;
            messageDiv.textContent = text;
            this.chatContainer.appendChild(messageDiv);
        }
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.voiceLlama = new VoiceLlama();
});
