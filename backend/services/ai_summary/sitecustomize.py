import sys
import asyncio

# Gracefully suppress multiprocessing / asyncio KeyboardInterrupt tracebacks on Windows termination
try:
    import uvicorn.server
    _orig_server_run = uvicorn.server.Server.run
    def _safe_server_run(self, *args, **kwargs):
        try:
            return _orig_server_run(self, *args, **kwargs)
        except (KeyboardInterrupt, SystemExit, asyncio.CancelledError):
            return None
    uvicorn.server.Server.run = _safe_server_run
except Exception:
    pass

try:
    import uvicorn._subprocess as uvicorn_subp
    _orig_subp = uvicorn_subp.subprocess_started
    def _safe_subp(*args, **kwargs):
        try:
            return _orig_subp(*args, **kwargs)
        except (KeyboardInterrupt, SystemExit, asyncio.CancelledError):
            return None
    uvicorn_subp.subprocess_started = _safe_subp
except Exception:
    pass
