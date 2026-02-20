import socket
import subprocess
import sys

def kill_process_on_port(port: int):
    """Kill any process using the specified port on Windows."""
    try:
        # Find process using the port
        result = subprocess.run(
            f'netstat -ano | findstr :{port}',
            shell=True,
            capture_output=True,
            text=True
        )
        
        if result.stdout:
            lines = result.stdout.strip().split('\n')
            pids = set()
            
            for line in lines:
                parts = line.split()
                if len(parts) >= 5 and 'LISTENING' in line:
                    pid = parts[-1]
                    pids.add(pid)
            
            for pid in pids:
                print(f"Killing process {pid} on port {port}...")
                subprocess.run(f'taskkill /F /PID {pid}', shell=True, capture_output=True)
                print(f"✓ Killed process {pid}")
                
            return True
        return False
    except Exception as e:
        print(f"Error killing process on port {port}: {e}")
        return False

def check_port_free(port: int) -> bool:
    """Check if a port is free."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", port))
        s.close()
        return True
    except:
        return False

if __name__ == "__main__":
    print("🧹 Cleaning up ports 8000-8002...")
    
    for port in [8000, 8001, 8002]:
        if not check_port_free(port):
            print(f"\n📍 Port {port} is in use")
            kill_process_on_port(port)
        else:
            print(f"✓ Port {port} is already free")
    
    print("\n✓ Cleanup complete! You can now run:")
    print("  python run.py")
