"""A small in-memory sliding-window rate limiter.

Per-process and per-client-IP: enough to blunt token guessing and abuse of a single instance. Behind
several workers or a proxy, enforce limits at the proxy as well.
"""
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, Request


class RateLimiter:
    def __init__(self, limit: int, window_seconds: float) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Wait a moment and try again.",
                headers={"Retry-After": str(int(self.window))},
            )
        hits.append(now)

    def reset(self) -> None:
        self._hits.clear()

    def dependency(self):
        def _check(request: Request) -> None:
            self.check(request.client.host if request.client else "unknown")

        return _check
