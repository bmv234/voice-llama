import http.server
import ssl
import mimetypes
import urllib.request
import urllib.error
import json
from http.client import HTTPConnection, HTTPSConnection
from urllib.parse import urlparse
import ssl

# Add WASM mime type
mimetypes.add_type('application/wasm', '.wasm')
mimetypes.add_type('application/javascript', '.mjs')

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/0.0.0.0/tts':
            self.proxy_request('https://0.0.0.0:8050/tts')
        elif self.path == '/0.0.0.0/stt':
            self.proxy_request('https://0.0.0.0:8060/transcribe')
        elif self.path == '/0.0.0.0/ollama':
            self.proxy_request('http://0.0.0.0:11434/api/chat')
        else:
            super().do_POST()

    def proxy_request(self, target_url):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        # Create an SSL context that ignores certificate validation
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE

        parsed_url = urlparse(target_url)
        try:
            if parsed_url.scheme == 'https':
                conn = HTTPSConnection(parsed_url.netloc, context=context)
            else:
                # For HTTP targets, use regular HTTPConnection
                conn = HTTPConnection(parsed_url.netloc)
            headers = {
                'Content-Type': self.headers.get('Content-Type', 'application/json'),
                'Content-Length': str(len(body) if body else 0)
            }
            
            conn.request('POST', parsed_url.path, body=body, headers=headers)
            response = conn.getresponse()
            
            # Forward the response back to the client
            self.send_response(response.status)
            self.send_header('Content-Type', response.getheader('Content-Type'))
            self.end_headers()
            self.wfile.write(response.read())
            
        except Exception as e:
            self.send_error(500, str(e))
        finally:
            conn.close()

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

server_address = ('0.0.0.0', 8443)
httpd = http.server.HTTPServer(server_address, ProxyHandler)

# Create SSL context
ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ssl_context.load_cert_chain(certfile='cert.pem', keyfile='key.pem')
httpd.socket = ssl_context.wrap_socket(httpd.socket, server_side=True)

print(f'Serving HTTPS on {server_address[0]} port {server_address[1]} (https://0.0.0.0:8443/) ...')
print('Proxying STT requests to https://0.0.0.0:8060/transcribe')
print('Proxying TTS requests to https://0.0.0.0:8050/tts')
httpd.serve_forever()