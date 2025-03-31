from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import re

class SecurityMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.allowed_origin = "interviewer.im-brij.com"
        # Common bot user agent patterns
        self.bot_patterns = [
            r"bot",
            r"crawler",
            r"spider",
            r"headless",
            r"scrape",
            r"curl",
            r"wget",
            r"python-requests",
            r"python-urllib",
            r"go-http-client",
            r"java/",
            r"axios",
            r"http-client"
        ]
    
    async def dispatch(self, request: Request, call_next):
        # Check if request is from curl or bot by examining User-Agent
        user_agent = request.headers.get("user-agent", "").lower()
        
        # Block bots and curl
        for pattern in self.bot_patterns:
            if re.search(pattern, user_agent, re.IGNORECASE):
                raise HTTPException(status_code=403, detail="Bot/curl access is forbidden")
        
        # Check the origin/referer
        origin = request.headers.get("origin", "")
        referer = request.headers.get("referer", "")
        
        # Skip check for preflight requests
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Allow health check endpoints without origin checks
        if request.url.path.endswith("/health"):
            return await call_next(request)
            
        # Verify the request has a valid origin or referer from our website
        if not (self.allowed_origin in origin or self.allowed_origin in referer):
            # Allow local development
            if "localhost" in origin or "127.0.0.1" in origin:
                return await call_next(request)
            raise HTTPException(status_code=403, detail="Access forbidden - invalid origin")
            
        return await call_next(request) 