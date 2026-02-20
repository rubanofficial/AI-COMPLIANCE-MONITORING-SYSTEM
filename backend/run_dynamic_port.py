import socket
import sys
import asyncio

if sys.platform.startswith("win"):
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

# find an available port
s = socket.socket()
s.bind(("127.0.0.1", 0))
addr, port = s.getsockname()
s.close()

print(f"Starting server on 127.0.0.1:{port}")

from main import app
import uvicorn

if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=port, log_level='info')
