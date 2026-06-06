import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import engine

# Set page config for a premium wide-layout dashboard
st.set_page_config(
    page_title="SentinelTrader",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom premium minimalist styling for dark mode dashboard
st.markdown("""
<style>
    /* Dark theme settings */
    .stApp {
        background-color: #0b0e14;
        color: #e1e4e8;
    }
    
    /* Hide default Streamlit sidebar & decoration */
    [data-testid="sidebar-content"] {
        display: none !important;
    }
    [data-testid="collapsedControl"] {
        display: none !important;
    }
    header {
        display: none !important;
    }
    footer {
        display: none !important;
    }
    
    /* Custom button overrides for minimalist, flat theme */
    div.stButton > button {
        background-color: #12161f !important;
        color: #adbac7 !important;
        border: 1px solid #222831 !important;
        border-radius: 4px !important;
        font-weight: 500 !important;
        font-size: 0.85rem !important;
        padding: 10px 16px !important;
        transition: all 0.2s ease !important;
        width: 100% !important;
    }
    div.stButton > button:hover {
        color: #ffffff !important;
        border-color: #4f5b66 !important;
        background-color: #1a202c !important;
    }
    
    /* Divider spacing */
    hr {
        margin: 1.5rem 0 !important;
        border-color: #222831 !important;
    }
</style>
""", unsafe_allow_html=True)

# Load current state
state = engine.load_state()

# Helper stats
total_trades = sum(1 for log in state["log_history"] if "BUY" in log or "SELL" in log)
active_positions_count = len(state["positions"])

# Header with status indicator
status_text = "● AI ACTIVE" if state["bot_running"] else "○ PAUSED"
status_color = "#3fb950" if state["bot_running"] else "#f85149"

st.markdown(f"""
<div style="display: flex; align-items: baseline; gap: 15px; margin-top: 10px; margin-bottom: 25px;">
    <span style="font-size: 2.2rem; font-weight: 800; letter-spacing: -1px; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">SentinelTrader</span>
    <span style="font-size: 0.85rem; font-weight: 700; color: {status_color}; letter-spacing: 1px; font-family: monospace;">{status_text}</span>
</div>
""", unsafe_allow_html=True)

# Typography & Metrics (Clean Row HTML)
st.markdown(f"""
<div style="display: flex; gap: 80px; margin-bottom: 25px; flex-wrap: wrap;">
    <div>
        <div style="font-size: 0.75rem; font-weight: 700; color: #768390; letter-spacing: 1.5px; margin-bottom: 6px;">PORTFOLIO VALUE</div>
        <div style="font-size: 2rem; font-weight: 700; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
            {state['portfolio_value']:,.0f} <span style="font-size: 1.1rem; color: #768390; font-weight: 400;">VND</span>
        </div>
    </div>
    <div style="border-left: 1px solid #222831; height: 50px; align-self: center;"></div>
    <div>
        <div style="font-size: 0.75rem; font-weight: 700; color: #768390; letter-spacing: 1.5px; margin-bottom: 6px;">AVAILABLE CASH</div>
        <div style="font-size: 2rem; font-weight: 700; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
            {state['available_cash']:,.0f} <span style="font-size: 1.1rem; color: #768390; font-weight: 400;">VND</span>
        </div>
    </div>
    <div style="border-left: 1px solid #222831; height: 50px; align-self: center;"></div>
    <div>
        <div style="font-size: 0.75rem; font-weight: 700; color: #768390; letter-spacing: 1.5px; margin-bottom: 6px;">ACTIVE POSITIONS</div>
        <div style="font-size: 2rem; font-weight: 700; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
            {active_positions_count}
        </div>
    </div>
</div>
""", unsafe_allow_html=True)

st.markdown("<hr>", unsafe_allow_html=True)

# Layout: 2 Columns
col_left, col_right = st.columns([3, 2], gap="large")

# Left Column: Holdings
with col_left:
    st.markdown("<div style='font-size: 0.9rem; font-weight: 700; color: #ffffff; margin-bottom: 15px; letter-spacing: 0.5px;'>LIVE PORTFOLIO HOLDINGS</div>", unsafe_allow_html=True)
    
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
            "Avg Price": f"{avg_price:,.0f} VND",
            "Current Price": f"{current_price:,.0f} VND",
            "Market Value": f"{current_val:,.0f} VND",
            "Unrealized PnL": f"{pnl_vnd:+,.0f} ({pnl_pct:+.2f}%)"
        })
        
    if positions_data:
        df = pd.DataFrame(positions_data)
        st.dataframe(df, use_container_width=True, hide_index=True)
    else:
        st.markdown(
            '<div style="border: 1px dashed #222831; border-radius: 4px; padding: 40px; text-align: center; color: #768390; font-size: 0.9rem; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">'
            'Portfolio empty. Sitting in cash awaiting market signals.'
            '</div>', 
            unsafe_allow_html=True
        )

# Right Column: Equity curve and actions
with col_right:
    st.markdown("<div style='font-size: 0.9rem; font-weight: 700; color: #ffffff; margin-bottom: 15px; letter-spacing: 0.5px;'>PERFORMANCE CURVE</div>", unsafe_allow_html=True)
    
    # Plotly Equity Curve
    equity_hist = state.get("equity_history", [10000000.0])
    
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        y=equity_hist,
        mode='lines',
        line=dict(color='#3fb950' if equity_hist[-1] >= 10000000.0 else '#f85149', width=2),
        hovertemplate='Value: %{y:,.0f} VND<extra></extra>'
    ))
    
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        margin=dict(l=0, r=0, t=5, b=5),
        height=180,
        xaxis=dict(showgrid=False, visible=False),
        yaxis=dict(
            showgrid=True,
            gridcolor='#161b22',
            tickfont=dict(color='#768390', size=9),
            tickformat=","
        )
    )
    
    st.plotly_chart(fig, use_container_width=True, config={'displayModeBar': False})
    
    # Minimalist Control Buttons
    btn_pause, btn_scan, btn_reset = st.columns(3, gap="small")
    
    with btn_pause:
        pause_label = "Pause AI" if state["bot_running"] else "Resume AI"
        if st.button(pause_label):
            engine.toggle_bot_status()
            st.rerun()
            
    with btn_scan:
        if st.button("Force Scan"):
            engine.force_scan()
            st.rerun()
            
    with btn_reset:
        if st.button("Reset Wallet"):
            engine.reset_wallet()
            st.rerun()

st.markdown("<hr>", unsafe_allow_html=True)

# Bottom full-width clean developer console terminal
st.markdown("<div style='font-size: 0.9rem; font-weight: 700; color: #ffffff; margin-bottom: 15px; letter-spacing: 0.5px;'>GEMINI DECISION LOG</div>", unsafe_allow_html=True)

# Compile logs into pristine code-block style console
terminal_content = ""
for log in reversed(state["log_history"]):
    color = "#adbac7"  # Neutral
    if "BUY" in log:
        color = "#58a6ff"  # Info / Buy
    elif "SELL" in log:
        color = "#f85149"  # Warn / Sell
    elif "neutral" in log or "HOLD" in log:
        color = "#768390"  # Muted / Hold
        
    terminal_content += f'<div style="color: {color}; margin-bottom: 3px; font-family: monospace; font-size: 0.85rem;">{log}</div>'

st.markdown(
    f'<div style="background-color: #07090e; border: 1px solid #161b22; border-radius: 4px; padding: 15px; max-height: 200px; overflow-y: auto; box-shadow: inset 0 0 10px rgba(0,0,0,0.5);">'
    f'{terminal_content}'
    f'</div>',
    unsafe_allow_html=True
)
