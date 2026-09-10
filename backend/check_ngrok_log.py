import os
os.environ['no_proxy'] = '*'
os.environ.pop('http_proxy', None)
os.environ.pop('https_proxy', None)
import urllib.request
import json

try:
    req = urllib.request.Request('http://127.0.0.1:4040/api/requests/http?limit=20')
    res = urllib.request.urlopen(req)
    data = json.loads(res.read())
    print(f"Total requests: {len(data.get('requests', []))}")
    for r in data.get('requests', []):
        print(r.get('uri'), r.get('response', {}).get('status_code'))
except Exception as e:
    print("Error:", e)
