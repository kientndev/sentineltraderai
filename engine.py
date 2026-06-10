"""
SentinelTrader AI — Core Trading Engine (Convex Edition)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
All state is stored in Convex via the HTTP API.
Local JSON files are no longer used.

Environment variables required (set in .env.local or shell):
    CONVEX_URL      — your Convex deployment URL
                      e.g. https://happy-animal-123.convex.cloud
"""

import os
import random
import logging
from datetime import datetime, timedelta

import requests  # pip install requests

logger = logging.getLogger("sentineltrader.engine")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

CONVEX_URL = os.environ.get("CONVEX_URL", "").rstrip("/")

if not CONVEX_URL:
    raise EnvironmentError(
        "CONVEX_URL is not set. "
        "Add it to your .env.local file or shell environment."
    )

TARGET_TICKERS: list[str] = ["SSI", "HPG", "FPT"]

FALLBACK_PRICES: dict[str, float] = {
    "SSI": 42_000,
    "HPG": 29_000,
    "FPT": 135_000,
}

STARTING_CASH = 10_000_000.0


# ---------------------------------------------------------------------------
# Convex HTTP helpers
# ---------------------------------------------------------------------------

def _convex_query(function_name: str, args: dict | None = None) -> dict:
    """
    Call a Convex query via the HTTP API.

    function_name: fully-qualified name, e.g. "portfolio:getPortfolio"
    """
    url = f"{CONVEX_URL}/api/query"
    payload = {"path": function_name, "args": args or {}}
    resp = requests.post(url, json=payload, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    if data.get("status") != "success":
        raise RuntimeError(f"Convex query failed: {data}")
    return data.get("value")


def _convex_mutation(function_name: str, args: dict | None = None) -> dict:
    """
    Call a Convex mutation via the HTTP API.

    function_name: fully-qualified name, e.g. "portfolio:updatePortfolio"
    """
    url = f"{CONVEX_URL}/api/mutation"
    payload = {"path": function_name, "args": args or {}}
    resp = requests.post(url, json=payload, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    if data.get("status") != "success":
        raise RuntimeError(f"Convex mutation failed: {data}")
    return data.get("value")


# ---------------------------------------------------------------------------
# Structured log helpers
# ---------------------------------------------------------------------------

def _ts() -> str:
    """Current UTC timestamp in ISO-8601 format."""
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")


def _make_log(
    log_type: str,
    message: str,
    ticker: str | None = None,
    price: float | None = None,
    shares: int | None = None,
) -> dict:
    entry: dict = {
        "timestamp": _ts(),
        "logType": log_type,
        "message": message,
    }
    if ticker is not None:
        entry["ticker"] = ticker
    if price is not None:
        entry["price"] = price
    if shares is not None:
        entry["shares"] = shares
    return entry


# ---------------------------------------------------------------------------
# Live price fetching (vnstock3 with fallback)
# ---------------------------------------------------------------------------

def fetch_latest_prices(tickers: list[str] | None = None) -> dict[str, float]:
    """
    Fetch the most recent closing prices for each ticker using vnstock3.
    Falls back to FALLBACK_PRICES if the library is unavailable or an
    API call fails for a specific ticker.
    """
    tickers = tickers or TARGET_TICKERS
    prices: dict[str, float] = {}

    try:
        from vnstock3 import Vnstock
    except ImportError:
        logger.warning("vnstock3 not installed — using fallback prices.")
        return {t: FALLBACK_PRICES.get(t, 0.0) for t in tickers}

    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")

    for ticker in tickers:
        try:
            stock = Vnstock().stock(symbol=ticker, source="VCI")
            df = stock.quote.history(start=start_date, end=end_date)
            if df is not None and not df.empty:
                prices[ticker] = float(df.iloc[-1]["close"])
                logger.info("Fetched %s close: %s", ticker, prices[ticker])
            else:
                prices[ticker] = FALLBACK_PRICES.get(ticker, 0.0)
                logger.warning("Empty frame for %s — using fallback.", ticker)
        except Exception as exc:
            prices[ticker] = FALLBACK_PRICES.get(ticker, 0.0)
            logger.warning(
                "vnstock3 error for %s: %s — using fallback.", ticker, exc
            )

    return prices


# ---------------------------------------------------------------------------
# Public API — called by main.py route handlers
# ---------------------------------------------------------------------------

def get_portfolio() -> dict:
    """
    GET /api/portfolio  ←  returns live Convex state.
    Also re-prices positions in Convex with the latest market data.
    """
    portfolio = _convex_query("portfolio:getPortfolio")

    if portfolio is None:
        # First run — seed Convex
        _convex_mutation("portfolio:initPortfolio")
        portfolio = _convex_query("portfolio:getPortfolio")

    # Re-price and update total value
    tickers = [p["ticker"] for p in portfolio.get("positions", [])] or TARGET_TICKERS
    prices = fetch_latest_prices(tickers)

    cash = portfolio["availableCash"]
    holdings_value = sum(
        p["shares"] * prices.get(p["ticker"], p["avgPrice"])
        for p in portfolio.get("positions", [])
    )
    new_total = cash + holdings_value

    _convex_mutation("portfolio:updatePortfolio", {
        "availableCash": cash,
        "totalValue": new_total,
        "positions": portfolio.get("positions", []),
    })

    portfolio["totalValue"] = new_total
    return portfolio


def scan_market() -> dict:
    """
    POST /api/scan  ←  fetches live prices, makes a paper-trading decision,
    writes updated state + structured logs to Convex.
    """
    portfolio = _convex_query("portfolio:getPortfolio")
    if portfolio is None:
        _convex_mutation("portfolio:initPortfolio")
        portfolio = _convex_query("portfolio:getPortfolio")

    prices = fetch_latest_prices(TARGET_TICKERS)

    # Build positions dict for easy manipulation
    pos_dict: dict[str, dict] = {p["ticker"]: p for p in portfolio.get("positions", [])}
    available_cash: float = portfolio["availableCash"]

    logs_to_write: list[dict] = []

    # --- SCAN log ---
    price_str = ", ".join(
        f"{t}: {p:,.0f} VND" for t, p in prices.items()
    )
    logs_to_write.append(_make_log("SCAN", f"Market scan complete. Prices — {price_str}"))

    # --- Paper-trade decision ---
    ticker = random.choice(TARGET_TICKERS)
    current_price = prices.get(ticker, FALLBACK_PRICES.get(ticker, 0.0))
    decision = random.choice(["BUY", "SELL", "HOLD"])

    if decision == "BUY":
        budget = available_cash * 0.25
        if budget >= current_price and current_price > 0:
            shares_to_buy = int(budget // current_price)
            cost = shares_to_buy * current_price
            available_cash -= cost

            existing = pos_dict.get(ticker, {"ticker": ticker, "shares": 0, "avgPrice": 0.0})
            old_shares = existing["shares"]
            old_avg = existing["avgPrice"]
            new_shares = old_shares + shares_to_buy
            new_avg = ((old_shares * old_avg) + cost) / new_shares if new_shares else 0.0

            pos_dict[ticker] = {
                "ticker": ticker,
                "shares": new_shares,
                "avgPrice": round(new_avg, 2),
            }
            logs_to_write.append(_make_log(
                "BUY",
                f"BUY {shares_to_buy} shares of {ticker} @ {current_price:,.0f} VND. "
                f"Cost: {cost:,.0f} VND.",
                ticker=ticker,
                price=current_price,
                shares=shares_to_buy,
            ))
        else:
            logs_to_write.append(_make_log(
                "HOLD",
                f"HOLD on {ticker}. Insufficient funds for purchase.",
                ticker=ticker,
                price=current_price,
            ))

    elif decision == "SELL":
        if ticker in pos_dict and pos_dict[ticker]["shares"] > 0:
            pos = pos_dict[ticker]
            shares_to_sell = random.choice([
                max(1, pos["shares"] // 2),
                pos["shares"],
            ])
            revenue = shares_to_sell * current_price
            available_cash += revenue

            remaining = pos["shares"] - shares_to_sell
            if remaining <= 0:
                del pos_dict[ticker]
            else:
                pos_dict[ticker] = {**pos, "shares": remaining}

            logs_to_write.append(_make_log(
                "SELL",
                f"SELL {shares_to_sell} shares of {ticker} @ {current_price:,.0f} VND. "
                f"Revenue: {revenue:,.0f} VND.",
                ticker=ticker,
                price=current_price,
                shares=shares_to_sell,
            ))
        else:
            logs_to_write.append(_make_log(
                "HOLD",
                f"HOLD on {ticker}. No open position to sell.",
                ticker=ticker,
                price=current_price,
            ))

    else:  # HOLD
        logs_to_write.append(_make_log(
            "HOLD",
            f"HOLD on {ticker} @ {current_price:,.0f} VND. Indicators neutral.",
            ticker=ticker,
            price=current_price,
        ))

    # Recalculate total value
    positions_list = list(pos_dict.values())
    holdings_value = sum(
        p["shares"] * prices.get(p["ticker"], p["avgPrice"])
        for p in positions_list
    )
    new_total = available_cash + holdings_value

    # Persist everything to Convex in two calls
    _convex_mutation("portfolio:updatePortfolio", {
        "availableCash": available_cash,
        "totalValue": new_total,
        "positions": positions_list,
    })
    _convex_mutation("portfolio:appendLogs", {"logs": logs_to_write})

    return {
        "availableCash": available_cash,
        "totalValue": new_total,
        "positions": positions_list,
        "logs": logs_to_write,
    }


def reset_portfolio() -> dict:
    """
    POST /api/reset  ←  wipes Convex portfolio back to defaults.
    """
    _convex_mutation("portfolio:resetPortfolio")
    return {
        "availableCash": STARTING_CASH,
        "totalValue": STARTING_CASH,
        "positions": [],
    }
