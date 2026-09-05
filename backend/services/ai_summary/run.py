import sys
import os
import uvicorn

if __name__ == "__main__":
    try:
        uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
    except (KeyboardInterrupt, SystemExit):
        sys.exit(0)
