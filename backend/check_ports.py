import socket
for port in [8000, 8011, 8012]:
    s = socket.socket()
    s.settimeout(0.5)
    res = s.connect_ex(('127.0.0.1', port))
    print(f"Port {port}: {'OPEN' if res == 0 else 'CLOSED'}")
    s.close()
