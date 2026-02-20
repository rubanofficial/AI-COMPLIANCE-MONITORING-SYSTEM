import uvicorn
import sys
import asyncio


if __name__ == "__main__":
    if sys.platform.startswith("win"):
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    from main import app

    # Find an available port dynamically
    import socket

    def _find_free_port(host: str, start_port: int = 8000, max_attempts: int = 10) -> int:
        """Find the first available port starting from start_port."""
        for port in range(start_port, start_port + max_attempts):
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                s.bind((host, port))
                s.close()
                return port
            except Exception:
                continue
        raise RuntimeError(f"No free ports found between {start_port} and {start_port + max_attempts - 1}")

    host = "127.0.0.1"
    preferred_port = 8000
    
    port_to_use = _find_free_port(host, preferred_port)
    if port_to_use != preferred_port:
        print(f"Port {preferred_port} is in use; using port {port_to_use}")

    uvicorn.run(app, host=host, port=port_to_use, log_level="debug")