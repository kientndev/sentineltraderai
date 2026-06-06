import os
import json
import time
from datetime import datetime
import random

STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wallet_state.json")

# Mock database of tickers and current prices in VND
MOCK_TICKERS = {
    "FPT": {"name": "FPT Corporation", "price": 135000},
    "VNM": {"name": "Vinamilk", "price": 68000},
    "HPG": {"name": "Hoa Phat Group", "price": 29000},
    "VIC": {"name": "Vingroup", "price": 42000},
    "VCB": {"name": "Vietcombank", "price": 92000},
    "MWG": {"name": "Mobile World Group", "price": 62000}
}

DEFAULT_STATE = {
    "bot_running": True,
    "available_cash": 10000000.0,  # 10M VND
    "portfolio_value": 10000000.0,
    "positions": {},  # Format: {ticker: {"shares": float, "avg_price": float}}
    "log_history": [
        f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Bot initialized. Ready for paper trading."
    ],
    "equity_history": [10000000.0]  # List of portfolio value snapshots
}

def load_state() -> dict:
    """Load the state from wallet_state.json, or return default if not exists/corrupted."""
    if not os.path.exists(STATE_FILE):
        save_state(DEFAULT_STATE)
        return DEFAULT_STATE
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            state = json.load(f)
            # Ensure all keys are present (for backward compatibility / safety)
            for k, v in DEFAULT_STATE.items():
                if k not in state:
                    state[k] = v
            return state
    except Exception as e:
        # If corrupted, rewrite to default
        save_state(DEFAULT_STATE)
        return DEFAULT_STATE

def save_state(state: dict):
    """Save the state dictionary to wallet_state.json."""
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving state: {e}")

def add_log(state: dict, message: str):
    """Utility to add a timestamped log message to the log history."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"[{timestamp}] {message}"
    state["log_history"].append(log_entry)
    # Limit logs to last 100 entries to prevent file bloat
    if len(state["log_history"]) > 100:
        state["log_history"] = state["log_history"][-100:]

def update_portfolio_value(state: dict) -> float:
    """Calculate the total portfolio value based on cash and current positions' prices."""
    cash = state.get("available_cash", 10000000.0)
    positions = state.get("positions", {})
    
    holdings_value = 0.0
    for ticker, pos in positions.items():
        shares = pos.get("shares", 0)
        current_price = MOCK_TICKERS.get(ticker, {}).get("price", pos.get("avg_price", 0))
        holdings_value += shares * current_price
        
    total_val = cash + holdings_value
    state["portfolio_value"] = total_val
    return total_val

def reset_wallet() -> dict:
    """Reset the wallet state to default values."""
    state = {
        "bot_running": DEFAULT_STATE["bot_running"],
        "available_cash": 10000000.0,
        "portfolio_value": 10000000.0,
        "positions": {},
        "log_history": [
            f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Wallet reset requested. State initialized back to 10,000,000 VND."
        ],
        "equity_history": [10000000.0]
    }
    save_state(state)
    return state

def toggle_bot_status() -> dict:
    """Toggle the RUNNING / IDLE status of the bot."""
    state = load_state()
    state["bot_running"] = not state["bot_running"]
    status_str = "RUNNING" if state["bot_running"] else "PAUSED (IDLE)"
    add_log(state, f"Bot status toggled. Current state: {status_str}")
    save_state(state)
    return state

def force_scan() -> dict:
    """Simulate a paper trading scan decision by buying or selling a mock security."""
    state = load_state()
    
    # Calculate portfolio value first
    update_portfolio_value(state)
    
    # Randomly decide to Buy, Sell, or Hold a stock from our MOCK_TICKERS
    decision_type = random.choice(["BUY", "SELL", "HOLD"])
    ticker = random.choice(list(MOCK_TICKERS.keys()))
    current_price = MOCK_TICKERS[ticker]["price"]
    
    if decision_type == "BUY" and state["bot_running"]:
        # Let's decide to buy some shares using at most 20% of available cash
        max_buy_budget = state["available_cash"] * 0.20
        if max_buy_budget >= current_price:
            shares_to_buy = int(max_buy_budget // current_price)
            if shares_to_buy > 0:
                cost = shares_to_buy * current_price
                state["available_cash"] -= cost
                
                # Update positions
                pos = state["positions"].get(ticker, {"shares": 0, "avg_price": 0.0})
                old_shares = pos["shares"]
                old_avg = pos["avg_price"]
                
                new_shares = old_shares + shares_to_buy
                new_avg = ((old_shares * old_avg) + cost) / new_shares
                
                state["positions"][ticker] = {
                    "shares": new_shares,
                    "avg_price": new_avg
                }
                
                add_log(state, f"DECISION: BUY {shares_to_buy} shares of {ticker} @ {current_price:,.0f} VND. Cost: {cost:,.0f} VND.")
            else:
                add_log(state, f"DECISION: HOLD. Insufficient budget to buy {ticker}.")
        else:
            add_log(state, f"DECISION: HOLD. Cash budget too low to buy {ticker}.")
            
    elif decision_type == "SELL" and state["bot_running"] and ticker in state["positions"]:
        # Sell half or all owned shares of this ticker
        pos = state["positions"][ticker]
        shares_owned = pos["shares"]
        if shares_owned > 0:
            shares_to_sell = random.choice([int(shares_owned // 2), int(shares_owned)])
            if shares_to_sell == 0:
                shares_to_sell = int(shares_owned)
                
            revenue = shares_to_sell * current_price
            state["available_cash"] += revenue
            
            pos["shares"] -= shares_to_sell
            if pos["shares"] <= 0:
                del state["positions"][ticker]
            else:
                state["positions"][ticker] = pos
                
            profit_loss = (current_price - pos["avg_price"]) * shares_to_sell
            add_log(state, f"DECISION: SELL {shares_to_sell} shares of {ticker} @ {current_price:,.0f} VND. Revenue: {revenue:,.0f} VND. Estimated PnL: {profit_loss:+,.0f} VND.")
        else:
            add_log(state, f"DECISION: HOLD. No holdings in {ticker} to sell.")
            
    else:
        # HOLD or Bot is paused
        if not state["bot_running"]:
            add_log(state, "SCAN: Scan skipped because bot is PAUSED.")
        else:
            add_log(state, f"DECISION: HOLD. Checked {ticker} @ {current_price:,.0f} VND - indicators neutral.")
            
    # Re-calculate values and record in equity curve
    new_total = update_portfolio_value(state)
    state["equity_history"].append(new_total)
    
    # Keep equity history capped to avoid loading huge arrays
    if len(state["equity_history"]) > 100:
        state["equity_history"] = state["equity_history"][-100:]
        
    save_state(state)
    return state
