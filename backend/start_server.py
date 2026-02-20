import uvicorn
import sys
import asyncio
import socket
import json

if __name__ == "__main__":
    if sys.platform.startswith("win"):
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    from main import app

    def find_free_port(host: str, preferred_port: int = 8006) -> int:
        """Find a free port starting from preferred_port."""
        for port in range(preferred_port, preferred_port + 20):
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                s.bind((host, port))
                s.close()
                return port
            except:
                continue
        raise RuntimeError(f"No free ports found")

    host = "127.0.0.1"
    preferred_port = 8006
    
    port_to_use = find_free_port(host, preferred_port)
    
    # Save the port to a config file for frontend
    config = {"backend_url": f"http://{host}:{port_to_use}"}
    with open("server_config.json", "w") as f:
        json.dump(config, f, indent=2)
    
    print("=" * 60)
    print(f"🚀 Backend server starting on http://{host}:{port_to_use}")
    print("=" * 60)
    
    if port_to_use != preferred_port:
        print(f"⚠️  Port {preferred_port} was in use, using port {port_to_use}")
        print(f"\n📝 Update frontend API URL to: http://localhost:{port_to_use}")
        print(f"   File: frontend/src/services/api.ts")
        print(f"   Change: const API_BASE_URL = 'http://localhost:{port_to_use}';")
    
    print("\n✅ Server configuration saved to: backend/server_config.json")
    print("=" * 60)
    print()

    uvicorn.run(app, host=host, port=port_to_use, log_level="info")
