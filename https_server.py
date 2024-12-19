import http.server
import ssl
import mimetypes
import urllib.request
import urllib.error
import json
from http.client import HTTPSConnection
from urllib.parse import urlparse
import ssl

# Add WASM mime type
mimetypes.add_type('application/wasm', '.wasm')
mimetypes.add_type('application/javascript', '.mjs')

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/proxy/tts':
            self.proxy_request('https://localhost:8050/tts')
        elif self.path == '/proxy/stt':
            self.proxy_request('https://localhost:8060/transcribe')
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
            conn = HTTPSConnection(parsed_url.netloc, context=context)
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

server_address = ('localhost', 8443)
httpd = http.server.HTTPServer(server_address, ProxyHandler)

# Create SSL context
ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ssl_context.load_cert_chain(certfile='cert.pem', keyfile='key.pem')
httpd.socket = ssl_context.wrap_socket(httpd.socket, server_side=True)

print(f'Serving HTTPS on {server_address[0]} port {server_address[1]} (https://localhost:8443/) ...')
print('Proxying STT requests to https://localhost:8060/transcribe')
print('Proxying TTS requests to https://localhost:8050/tts')
httpd.serve_forever()