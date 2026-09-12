import sys
import os
import time
import socket

# pyrefly: ignore [missing-import]
import uvicorn

def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1.0)
        return s.connect_ex((host, port)) == 0

if __name__ == "__main__":
    try:
        if is_port_in_use(8001):
            print("[AI Summary Service] Port 8001 is already in use / service already active. Running in standby mode.")
            while True:
                time.sleep(3600)
        else:
            uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
    except (KeyboardInterrupt, SystemExit):
        sys.exit(0)
    except Exception as e:
        print(f"[AI Summary Service] Notice: {e}")
        try:
            while True:
                time.sleep(3600)
        except (KeyboardInterrupt, SystemExit):
            sys.exit(0)

