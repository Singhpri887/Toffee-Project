from server import ToffeeHandler, SilentThreadingHTTPServer
import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


if __name__ == "__main__":
    host = "0.0.0.0"
    port = int(os.environ.get("PORT", 8000))
    server = SilentThreadingHTTPServer((host, port), ToffeeHandler)
    
    print("\n" + "=" * 68)
    print(">> TOFFEE REAL-TIME CLOUD & SAAS PLATFORM (PYTHON BACKEND) <<")
    print("=" * 68)
    print(f"[*] Local Web App:       http://{host}:{port}")
    print(f"[*] Real-Time SSE Stream: http://{host}:{port}/api/telemetry")
    print(f"[*] System Diagnostics:   http://{host}:{port}/api/system-status")
    print(f"[*] Resume & Case Kit:   http://{host}:{port}/api/resume-kit")
    print(f"[*] API Health Check:    http://{host}:{port}/api/health")
    print("-" * 68)
    print("[+] Tip for Interviewers: Open http://127.0.0.1:8000 to interact with")
    print("    live simulations (Traffic Spike, Regional Failover, DDoS Defense).")
    print("=" * 68 + "\n")
    sys.stdout.flush()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] Gracefully shutting down Toffee server...")
    finally:
        server.server_close()
        print("[INFO] Server closed.")
