"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Types (mirror the Convex schema)
// ---------------------------------------------------------------------------

interface Position {
  ticker: string;
  shares: number;
  avgPrice: number;
}

interface TradeLog {
  _id: string;
  timestamp: string;
  logType: string;
  message: string;
  ticker?: string;
  price?: number;
  shares?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FASTAPI_BASE = "http://127.0.0.1:8000";

function formatVND(value: number) {
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
}

function logColor(logType: string) {
  switch (logType) {
    case "BUY":    return "text-accent";
    case "SELL":   return "text-paused";
    case "HOLD":   return "text-foreground/40";
    case "SCAN":   return "text-sky-400";
    default:       return "text-foreground/60";
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  // --- Live data from Convex (auto-updating) ---
  const portfolio   = useQuery(api.portfolio.getPortfolio);
  const recentLogs  = useQuery(api.portfolio.getRecentLogs, { limit: 100 });

  // --- Convex mutations (used for reset only) ---
  const resetMutation = useMutation(api.portfolio.resetPortfolio);

  // --- Local UI state ---
  const [botActive, setBotActive]   = useState(true);
  const [scanning,  setScanning]    = useState(false);
  const [resetting, setResetting]   = useState(false);
  const [error,     setError]       = useState<string | null>(null);

  // --- Derived values (safe defaults while Convex loads) ---
  const availableCash  = portfolio?.availableCash  ?? 10_000_000;
  const totalValue     = portfolio?.totalValue     ?? 10_000_000;
  const positions: Position[] = portfolio?.positions ?? [];
  const logs: TradeLog[]      = recentLogs ?? [];

  // ---------------------------------------------------------------------------
  // Handlers — call FastAPI, which writes to Convex; Convex pushes update here
  // ---------------------------------------------------------------------------

  async function handleScan() {
    if (!botActive) return;
    setScanning(true);
    setError(null);
    try {
      const res = await fetch(`${FASTAPI_BASE}/api/scan`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function handleReset() {
    if (!confirm("Reset portfolio to 10,000,000 VND?")) return;
    setResetting(true);
    setError(null);
    try {
      // Call Convex mutation directly — no need to go through FastAPI for reset
      await resetMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <main className="max-w-6xl mx-auto px-6 py-12 flex flex-col min-h-screen justify-between">

      {/* ── Header ── */}
      <div>
        <header className="flex items-baseline gap-4 mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight text-white">
            SentinelTrader
          </h1>
          <span
            className={`text-xs font-bold tracking-widest font-mono uppercase transition-colors duration-300 ${
              botActive ? "text-accent" : "text-paused"
            }`}
          >
            {botActive ? "● AI ACTIVE" : "○ PAUSED"}
          </span>
          {portfolio === undefined && (
            <span className="text-xs text-foreground/40 font-mono ml-2">
              connecting…
            </span>
          )}
        </header>

        {/* ── Error banner ── */}
        {error && (
          <div className="mb-6 rounded border border-paused/30 bg-paused/5 px-4 py-3 text-xs text-paused font-mono">
            ⚠ {error}
          </div>
        )}

        {/* ── Metrics grid ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="border-l border-border pl-6 py-1">
            <div className="text-[10px] font-bold text-foreground/50 tracking-widest uppercase mb-1">
              PORTFOLIO VALUE
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {formatVND(totalValue)}
              <span className="text-sm font-normal text-foreground/50 ml-1">VND</span>
            </div>
          </div>

          <div className="border-l border-border pl-6 py-1">
            <div className="text-[10px] font-bold text-foreground/50 tracking-widest uppercase mb-1">
              AVAILABLE CASH
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {formatVND(availableCash)}
              <span className="text-sm font-normal text-foreground/50 ml-1">VND</span>
            </div>
          </div>

          <div className="border-l border-border pl-6 py-1">
            <div className="text-[10px] font-bold text-foreground/50 tracking-widest uppercase mb-1">
              ACTIVE POSITIONS
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {positions.length}
            </div>
          </div>
        </section>

        <hr className="border-border my-8" />

        {/* ── Workspace ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Holdings table */}
          <div className="lg:col-span-2">
            <h2 className="text-[10px] font-bold tracking-widest text-foreground/50 uppercase mb-4">
              LIVE PORTFOLIO HOLDINGS
            </h2>
            {positions.length === 0 ? (
              <div className="border border-dashed border-border rounded p-16 text-center text-sm text-foreground/40">
                Portfolio empty. Sitting in cash awaiting market signals.
              </div>
            ) : (
              <div className="border border-border rounded overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#12161f]/30 border-b border-border">
                      <th className="py-3 px-4 text-xs font-semibold text-foreground/50">Ticker</th>
                      <th className="py-3 px-4 text-xs font-semibold text-foreground/50 text-right">Shares</th>
                      <th className="py-3 px-4 text-xs font-semibold text-foreground/50 text-right">Avg Price</th>
                      <th className="py-3 px-4 text-xs font-semibold text-foreground/50 text-right">Market Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((pos) => {
                      const currentValue = pos.shares * pos.avgPrice;
                      return (
                        <tr key={pos.ticker} className="border-b border-border last:border-0 hover:bg-[#12161f]/10">
                          <td className="py-4 px-4 text-sm font-semibold text-white">{pos.ticker}</td>
                          <td className="py-4 px-4 text-sm text-right text-white">{pos.shares.toLocaleString()}</td>
                          <td className="py-4 px-4 text-sm text-right text-foreground/75">
                            {formatVND(pos.avgPrice)} VND
                          </td>
                          <td className="py-4 px-4 text-sm text-right text-white">
                            {formatVND(currentValue)} VND
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Controls */}
          <div>
            <h2 className="text-[10px] font-bold tracking-widest text-foreground/50 uppercase mb-4">
              CONTROLS
            </h2>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setBotActive((v) => !v)}
                className="w-full bg-[#12161f] text-white border border-border rounded py-3 text-xs font-semibold hover:border-foreground/40 hover:bg-[#161b24] transition-all"
              >
                {botActive ? "Pause AI Session" : "Resume AI Session"}
              </button>

              <button
                onClick={handleScan}
                disabled={!botActive || scanning}
                className="w-full bg-[#12161f] text-white border border-border rounded py-3 text-xs font-semibold hover:border-foreground/40 hover:bg-[#161b24] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {scanning ? "Scanning…" : "Force Market Scan"}
              </button>

              <button
                onClick={handleReset}
                disabled={resetting}
                className="w-full bg-transparent text-paused border border-paused/25 rounded py-3 text-xs font-semibold hover:border-paused/50 hover:bg-paused/5 transition-all disabled:opacity-40"
              >
                {resetting ? "Resetting…" : "Reset Account Balance"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Decision log ── */}
      <div className="mt-12">
        <h2 className="text-[10px] font-bold tracking-widest text-foreground/50 uppercase mb-4">
          TRADE DECISION LOG
        </h2>
        <div className="bg-terminalBg border border-border rounded p-5 h-48 overflow-y-auto font-mono custom-scrollbar">
          {logs.length === 0 ? (
            <p className="text-xs text-foreground/30">No logs yet. Run a market scan to get started.</p>
          ) : (
            logs.map((log) => (
              <div key={log._id} className={`text-xs leading-6 ${logColor(log.logType)}`}>
                <span className="text-foreground/30 mr-3">[{log.timestamp.replace("T", " ")}]</span>
                <span className="text-foreground/50 mr-2 font-bold">{log.logType}</span>
                <span>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </main>
  );
}
