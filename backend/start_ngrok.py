# pyrefly: ignore [missing-import]
from pyngrok import ngrok
import time
import sys

def main():
    import os
    os.environ['no_proxy'] = '*'
    os.environ['NO_PROXY'] = '*'
    os.environ.pop('http_proxy', None)
    os.environ.pop('HTTP_PROXY', None)
    try:
        # Start a tunnel on 127.0.0.1:8012 explicitly to avoid IPv6 issues
        http_tunnel = ngrok.connect("127.0.0.1:8012")
        print("NGROK_URL=" + http_tunnel.public_url, flush=True)
        # Keep the process alive
        while True:
            time.sleep(10)
    except KeyboardInterrupt:
        print("\nShutting down ngrok tunnel.")
        ngrok.kill()
        sys.exit(0)

if __name__ == '__main__':
    main()
