import React, { useState, useEffect } from 'react';

export default function App() {
  const [state, setState] = useState({
    bot_running: true,
    available_cash: 10000000.0,
    portfolio_value: 10000000.0,
    positions: {},
    log_history: [],
    equity_history: [10000000.0]
  });
  const [loading, setLoading] = useState(true);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch (err) {
      console.error("Error fetching state:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    // Poll every 3 seconds
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async () => {
    try {
      const res = await fetch('/api/toggle', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleScan = async () => {
    try {
      const res = await fetch('/api/scan', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReset = async () => {
    if (window.confirm("Are you sure you want to reset the wallet?")) {
      try {
        const res = await fetch('/api/reset', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setState(data);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const positionsList = Object.entries(state.positions);
  const totalTrades = state.log_history.filter(log => log.includes("BUY") || log.includes("SELL")).length;

  return (
    <div style={styles.container}>
      {/* Header & Status */}
      <header style={styles.header}>
        <h1 style={styles.title}>SentinelTrader</h1>
        <span style={{
          ...styles.statusIndicator,
          color: state.bot_running ? '#3fb950' : '#f85149'
        }}>
          {state.bot_running ? '● AI ACTIVE' : '○ PAUSED'}
        </span>
      </header>

      {/* Metrics Row */}
      <section style={styles.metricsRow}>
        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>PORTFOLIO VALUE</div>
          <div style={styles.metricValue}>
            {state.portfolio_value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            <span style={styles.currency}> VND</span>
          </div>
        </div>
        <div style={styles.divider}></div>
        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>AVAILABLE CASH</div>
          <div style={styles.metricValue}>
            {state.available_cash.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            <span style={styles.currency}> VND</span>
          </div>
        </div>
        <div style={styles.divider}></div>
        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>ACTIVE POSITIONS</div>
          <div style={styles.metricValue}>{positionsList.length}</div>
        </div>
        <div style={styles.divider}></div>
        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>TOTAL TRADES</div>
          <div style={styles.metricValue}>{total_trades}</div>
        </div>
      </section>

      <hr style={styles.hr} />

      {/* Main Split Layout */}
      <div style={styles.mainGrid}>
        {/* Left Column: Live Portfolio Holdings */}
        <section style={styles.gridColumn}>
          <h2 style={styles.sectionTitle}>LIVE PORTFOLIO HOLDINGS</h2>
          {positionsList.length === 0 ? (
            <div style={styles.emptyCard}>
              Portfolio empty. Sitting in cash awaiting market signals.
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Ticker</th>
                    <th style={styles.th}>Shares</th>
                    <th style={styles.th}>Avg Price</th>
                    <th style={styles.th}>Market Value</th>
                  </tr>
                </thead>
                <tbody>
                  {positionsList.map(([ticker, pos]) => {
                    const mockPrices = { FPT: 135000, VNM: 68000, HPG: 29000, VIC: 42000, VCB: 92000, MWG: 62000 };
                    const currentPrice = mockPrices[ticker] || pos.avg_price;
                    const currentValue = pos.shares * currentPrice;
                    return (
                      <tr key={ticker} style={styles.tr}>
                        <td style={styles.td}><strong>{ticker}</strong></td>
                        <td style={styles.td}>{pos.shares.toLocaleString()}</td>
                        <td style={styles.td}>{pos.avg_price.toLocaleString(undefined, { maximumFractionDigits: 0 })} VND</td>
                        <td style={styles.td}>{currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} VND</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right Column: Actions / Equity History */}
        <section style={styles.gridColumn}>
          <h2 style={styles.sectionTitle}>CONTROL PANEL</h2>
          <div style={styles.buttonGroup}>
            <button onClick={handleToggle} style={styles.button}>
              {state.bot_running ? 'Pause AI' : 'Resume AI'}
            </button>
            <button onClick={handleScan} style={styles.button}>
              Force Scan
            </button>
            <button onClick={handleReset} style={styles.buttonReset}>
              Reset Wallet
            </button>
          </div>

          <h2 style={{ ...styles.sectionTitle, marginTop: '30px' }}>EQUITY TREND</h2>
          <div style={styles.equityMiniFeed}>
            {state.equity_history.length > 0 && (
              <div style={styles.equitySummary}>
                Current Valuation: {state.portfolio_value.toLocaleString()} VND 
                <span style={{
                  color: state.portfolio_value >= 10000000 ? '#3fb950' : '#f85149',
                  marginLeft: '10px'
                }}>
                  ({(((state.portfolio_value - 10000000) / 10000000) * 100).toFixed(2)}% PnL)
                </span>
              </div>
            )}
            <div style={styles.equitySparkline}>
              {state.equity_history.slice(-10).map((val, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  flexDirection: 'column-reverse',
                  alignItems: 'center',
                  height: '60px',
                  width: '30px',
                  background: '#161b22',
                  border: '1px solid #222831',
                  borderRadius: '2px',
                  position: 'relative'
                }}>
                  <div style={{
                    height: `${Math.min(100, Math.max(10, ((val - 9000000) / 2000000) * 100))}%`,
                    width: '100%',
                    background: val >= 10000000 ? '#3fb950' : '#f85149',
                    borderRadius: '1px'
                  }}></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <hr style={styles.hr} />

      {/* Bottom: Gemini Decision Log */}
      <section style={{ paddingBottom: '40px' }}>
        <h2 style={styles.sectionTitle}>GEMINI DECISION LOG</h2>
        <div style={styles.terminal}>
          {state.log_history.length === 0 ? (
            <div style={{ color: '#768390', fontStyle: 'italic' }}>Terminal awaiting events...</div>
          ) : (
            [...state.log_history].reverse().map((log, idx) => {
              let logColor = '#adbac7';
              if (log.includes("BUY")) logColor = '#58a6ff';
              else if (log.includes("SELL")) logColor = '#f85149';
              else if (log.includes("HOLD") || log.includes("skipped")) logColor = '#768390';

              return (
                <div key={idx} style={{ ...styles.terminalLine, color: logColor }}>
                  {log}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 20px',
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '20px',
    marginBottom: '40px',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: '800',
    letterSpacing: '-1.5px',
    color: '#ffffff',
  },
  statusIndicator: {
    fontSize: '0.85rem',
    fontWeight: '700',
    letterSpacing: '1.5px',
    fontFamily: 'monospace',
  },
  metricsRow: {
    display: 'flex',
    gap: '60px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: '1 1 auto',
  },
  metricLabel: {
    fontSize: '0.7rem',
    fontWeight: '700',
    color: '#768390',
    letterSpacing: '2px',
    marginBottom: '8px',
  },
  metricValue: {
    fontSize: '2.2rem',
    fontWeight: '800',
    color: '#ffffff',
  },
  currency: {
    fontSize: '1.1rem',
    color: '#768390',
    fontWeight: '400',
  },
  divider: {
    borderLeft: '1px solid #222831',
    height: '60px',
    alignSelf: 'center',
  },
  hr: {
    margin: '40px 0',
    border: 'none',
    borderTop: '1px solid #222831',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '3fr 2fr',
    gap: '60px',
  },
  gridColumn: {
    display: 'flex',
    flexDirection: 'column',
  },
  sectionTitle: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#768390',
    letterSpacing: '1.5px',
    marginBottom: '20px',
  },
  emptyCard: {
    border: '1px dashed #222831',
    borderRadius: '4px',
    padding: '60px 20px',
    textAlign: 'center',
    color: '#768390',
    fontSize: '0.9rem',
  },
  tableWrapper: {
    border: '1px solid #222831',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  th: {
    background: '#12161f',
    padding: '12px 16px',
    fontSize: '0.8rem',
    color: '#768390',
    borderBottom: '1px solid #222831',
  },
  tr: {
    borderBottom: '1px solid #222831',
  },
  td: {
    padding: '14px 16px',
    fontSize: '0.9rem',
    color: '#adbac7',
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  button: {
    background: '#12161f',
    color: '#adbac7',
    border: '1px solid #222831',
    borderRadius: '4px',
    padding: '12px',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s',
  },
  buttonReset: {
    background: 'transparent',
    color: '#f85149',
    border: '1px solid rgba(248, 81, 73, 0.2)',
    borderRadius: '4px',
    padding: '12px',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s',
  },
  equityMiniFeed: {
    border: '1px solid #222831',
    borderRadius: '4px',
    padding: '20px',
    background: '#0c0f16',
  },
  equitySummary: {
    fontSize: '0.85rem',
    color: '#adbac7',
    marginBottom: '15px',
  },
  equitySparkline: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-end',
  },
  terminal: {
    background: '#07090e',
    border: '1px solid #161b22',
    borderRadius: '4px',
    padding: '20px',
    maxHeight: '220px',
    overflowY: 'auto',
    fontFamily: 'monospace',
    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)',
  },
  terminalLine: {
    fontSize: '0.85rem',
    lineHeight: '1.6',
    marginBottom: '4px',
  }
};
