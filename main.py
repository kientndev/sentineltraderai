"""
SentinelTrader AI — FastAPI Server (Convex Edition)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Delegates all state operations to engine.py, which reads/writes
exclusively via the Convex HTTP API.  The local JSON files
(portfolio_state.json, wallet_state.json) are no longer used.

Start the server:
    uvicorn main:app --host 127.0.0.1 --port 8000 --reload

Required env vars (put in .env.local or export in shell):
    CONVEX_URL  — e.g. https://happy-animal-123.convex.cloud
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import engine  # local module


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SentinelTrader AI API",
    description="Paper-trading backend — state stored in Convex.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/portfolio")
def get_portfolio() -> dict:
    """
    Return the current portfolio state (cash, total value, positions).
    Reprices open positions against the latest vnstock3 data.
    """
    try:
        return engine.get_portfolio()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/scan")
def scan_market() -> dict:
    """
    Trigger a market scan:
    1. Fetch live closing prices via vnstock3.
    2. Make a paper-trading decision (BUY / SELL / HOLD).
    3. Persist the updated portfolio and structured logs to Convex.
    """
    try:
        return engine.scan_market()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/reset")
def reset_portfolio() -> dict:
    """
    Reset the portfolio to 10,000,000 VND cash with no open positions.
    """
    try:
        return engine.reset_portfolio()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Dev entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
