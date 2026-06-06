from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import engine

app = FastAPI(title="SentinelTrader AI API")

# Setup CORS to allow requests from frontend development server (Vite default is 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for local paper trading setup
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/state")
def get_state():
    """Retrieve the current state of the wallet and bot."""
    return engine.load_state()

@app.post("/api/toggle")
def toggle_status():
    """Toggle the bot RUNNING/PAUSED status."""
    return engine.toggle_bot_status()

@app.post("/api/scan")
def force_scan():
    """Trigger a simulated scan and execute trading actions if active."""
    return engine.force_scan()

@app.post("/api/reset")
def reset_state():
    """Reset the wallet back to starting values."""
    return engine.reset_wallet()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
