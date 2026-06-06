import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime
import engine

# Set page config for a premium wide-layout dashboard
st.set_page_config(
    page_title="SentinelTrader AI - Paper Trading Dashboard",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom premium styling for dark mode dashboard
st.markdown("""
<style>
    /* Dark theme settings */
    .stApp {
        background-color: #0d1117;
        color: #c9d1d9;
    }
    
    /* Metrics panel card styling */
    div[data-testid="stMetricValue"] {
        font-family: 'Courier New', monospace;
        font-size: 1.8rem;
        color: #58a6ff;
    }
    div[data-testid="stMetricLabel"] {
        color: #8b949e;
        font-weight: bold;
    }
    
    /* Console Terminal Styling */
    .console-header {
        background-color: #21262d;
        color: #8b949e;
        padding: 6px 12px;
        border-top-left-radius: 6px;
        border-top-right-radius: 6px;
        font-family: 'Courier New', monospace;
        font-size: 0.85rem;
        border: 1px solid #30363d;
        border-bottom: none;
        display: flex;
        justify-content: space-between;
    }
    .console-terminal {
        background-color: #010409;
        color: #39ff14; /* Matrix Green */
        font-family: 'Courier New', Courier, monospace;
        padding: 15px;
        border-bottom-left-radius: 6px;
        border-bottom-right-radius: 6px;
        height: 250px;
        overflow-y: auto;
        border: 1px solid #30363d;
        font-size: 0.9rem;
        line-height: 1.4;
    }
    .console-line {
        margin-bottom: 4px;
        border-left: 3px solid #39ff14;
        padding-left: 8px;
    }
    .console-line-buy {
        color: #58a6ff;
        border-left-color: #58a6ff;
    }
    .console-line-sell {
        color: #ff7b72;
        border-left-color: #ff7b72;
    }
    .console-line-hold {
        color: #8b949e;
        border-left-color: #8b949e;
    }
    
    /* Buttons Custom Colors */
    .stButton>button {
        border-radius: 4px;
        font-weight: 600;
        transition: all 0.2s ease;
    }
</style>
""", unsafe_allow_html=True)

# Load current state
state = engine.load_state()

# Helper to calculate trades
total_trades = sum(1 for log in state["log_history"] if "BUY" in log or "SELL" in log)
active_positions_count = len(state["positions"])

# Header with status indicator
st.markdown("<h1 style='margin-bottom: 0px; padding-bottom: 0px;'>🤖 SentinelTrader AI</h1>", unsafe_allow_html=True)
st.markdown("<p style='color: #8b949e; font-size: 1.1rem; margin-top: 0px;'>Automated Paper Trading & Gemini Decisions</p>", unsafe_allow_html=True)

# Status Badge Row
status_col, spacer_col = st.columns([1, 4])
with status_col:
    if state["bot_running"]:
        st.markdown(
            '<div style="background-color: #1f2e1e; border: 1px solid #238636; color: #3fb950; padding: 6px 12px; border-radius: 20px; text-align: center; font-weight: bold; font-size: 0.9rem;">'
            '● BOT STATUS: RUNNING'
            '</div>', 
            unsafe_allow_html=True
        )
    else:
        st.markdown(
            '<div style="background-color: #2c1e1e; border: 1px solid #f85149; color: #f85149; padding: 6px 12px; border-radius: 20px; text-align: center; font-weight: bold; font-size: 0.9rem;">'
            '○ BOT STATUS: IDLE / PAUSED'
            '</div>', 
            unsafe_allow_html=True
        )

st.write("---")

# Quick metric cards
metric_val, metric_cash, metric_trades, metric_pos = st.columns(4)

with metric_val:
    st.metric(
        label="Total Portfolio Value",
        value=f"{state['portfolio_value']:,.0f} VND"
    )

with metric_cash:
    st.metric(
        label="Available Cash",
        value=f"{state['available_cash']:,.0f} VND"
    )

with metric_trades:
    st.metric(
        label="Total Trades Executed",
        value=f"{total_trades}"
    )

with metric_pos:
    st.metric(
        label="Active Positions",
        value=f"{active_positions_count}"
    )

st.write("")

# Layout split into two columns
col_left, col_right = st.columns([3, 2])

# Left column: Active Portfolio Holdings
with col_left:
    st.subheader("📊 Active Portfolio Holdings")
    
    positions_data = []
    for ticker, pos in state["positions"].items():
        shares = pos["shares"]
        avg_price = pos["avg_price"]
        current_price = engine.MOCK_TICKERS.get(ticker, {}).get("price", avg_price)
        current_val = shares * current_price
        cost_basis = shares * avg_price
        pnl_vnd = current_val - cost_basis
        pnl_pct = (pnl_vnd / cost_basis * 100) if cost_basis > 0 else 0.0
        
        positions_data.append({
            "Ticker": ticker,
            "Shares": f"{shares:,}",
            "Avg Buy Price": f"{avg_price:,.0f} VND",
            "Current Price": f"{current_price:,.0f} VND",
            "Current Value": f"{current_val:,.0f} VND",
            "Profit / Loss": f"{pnl_vnd:+,.0f} VND ({pnl_pct:+.2f}%)"
        })
        
    if positions_data:
        df = pd.DataFrame(positions_data)
        st.dataframe(df, use_container_width=True, hide_index=True)
    else:
        st.info("No active positions held. Bot is waiting to execute trades.")

# Right column: Mock equity curve line chart and interactive action buttons
with col_right:
    st.subheader("📈 Equity Curve (VND)")
    
    # Plot equity history
    equity_hist = state.get("equity_history", [10000000.0])
    
    # Generate clean line chart using Plotly for a premium aesthetic
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        y=equity_hist,
        mode='lines+markers',
        name='Portfolio Value',
        line=dict(color='#58a6ff', width=3),
        marker=dict(size=6, color='#1f6feb'),
        hovertemplate='Index: %{x}<br>Value: %{y:,.0f} VND<extra></extra>'
    ))
    
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        margin=dict(l=0, r=0, t=10, b=0),
        height=240,
        xaxis=dict(
            showgrid=True,
            gridcolor='#21262d',
            tickfont=dict(color='#8b949e'),
            title_font=dict(color='#8b949e')
        ),
        yaxis=dict(
            showgrid=True,
            gridcolor='#21262d',
            tickfont=dict(color='#8b949e'),
            title_font=dict(color='#8b949e'),
            tickformat=","
        )
    )
    
    st.plotly_chart(fig, use_container_width=True, config={'displayModeBar': False})
    
    # Action buttons
    st.write("🔧 **Control Panel**")
    btn_pause, btn_scan, btn_reset = st.columns(3)
    
    with btn_pause:
        pause_label = "⏸️ Pause Bot" if state["bot_running"] else "▶️ Resume Bot"
        if st.button(pause_label, use_container_width=True):
            state = engine.toggle_bot_status()
            st.rerun()
            
    with btn_scan:
        if st.button("⚡ Force Scan", use_container_width=True):
            state = engine.force_scan()
            st.success("Scan executed!")
            st.rerun()
            
    with btn_reset:
        if st.button("🔄 Reset Wallet", use_container_width=True):
            state = engine.reset_wallet()
            st.warning("Wallet state reset!")
            st.rerun()

st.write("---")

# Bottom full-width console-style terminal for the "Gemini Decision Log"
st.subheader("🖥️ Gemini Decision Log")

st.markdown('<div class="console-header"><span>TERMINAL SESSION</span><span>active log</span></div>', unsafe_allow_html=True)

# Build custom terminal HTML list
terminal_content = ""
# Show logs in reverse chronological order (newest first)
for log in reversed(state["log_history"]):
    line_class = "console-line"
    if "BUY" in log:
        line_class += " console-line-buy"
    elif "SELL" in log:
        line_class += " console-line-sell"
    elif "HOLD" in log or "skipped" in log:
        line_class += " console-line-hold"
        
    # Escape quotes and formatting safely
    safe_log = log.replace("<", "&lt;").replace(">", "&gt;")
    terminal_content += f'<div class="{line_class}">{safe_log}</div>'

st.markdown(f'<div class="console-terminal">{terminal_content}</div>', unsafe_allow_html=True)
