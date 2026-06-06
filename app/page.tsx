"use client";

import React, { useState, useEffect } from "react";

interface Position {
  shares: number;
  avgPrice: number;
}

interface LogEntry {
  timestamp: string;
  type: "BUY" | "SELL" | "HOLD" | "SYSTEM";
  message: string;
}

export default function Home() {
  const [botRunning, setBotRunning] = useState<boolean>(true);
  const [availableCash, setAvailableCash] = useState<number>(10000000);
  const [portfolioValue, setPortfolioValue] = useState<number>(10000000);
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      timestamp: "--:--:--",
      type: "SYSTEM",
      message: "System initialized. Ready for paper trading."
    }
  ]);

  // Hydrate the initial log timestamp on the client after mount
  useEffect(() => {
    setLogs((prev) =>
      prev.map((log, i) =>
        i === prev.length - 1 && log.timestamp === "--:--:--"
          ? { ...log, timestamp: new Date().toLocaleTimeString() }
          : log
      )
    );
  }, []);

  // Sync portfolio value with cash and active positions (using mock prices)
  useEffect(() => {
    const mockPrices: Record<string, number> = {
      FPT: 135000,
      VNM: 68000,
      HPG: 29000,
      VIC: 42000
    };

    const holdingsValue = Object.entries(positions).reduce((acc, [ticker, pos]) => {
      const currentPrice = mockPrices[ticker] || pos.avgPrice;
      return acc + pos.shares * currentPrice;
    }, 0);

    setPortfolioValue(availableCash + holdingsValue);
  }, [availableCash, positions]);

  const addLog = (type: LogEntry["type"], message: string) => {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message
    };
    setLogs((prev) => [newLog, ...prev].slice(0, 100));
  };

  const handleToggle = () => {
    const nextState = !botRunning;
    setBotRunning(nextState);
    addLog("SYSTEM", `Bot status toggled to ${nextState ? "ACTIVE" : "PAUSED"}.`);
  };

  const handleScan = () => {
    if (!botRunning) {
      addLog("SYSTEM", "Scan request ignored. Bot is currently paused.");
      return;
    }

    const mockTickers = ["FPT", "VNM", "HPG", "VIC"];
    const ticker = mockTickers[Math.floor(Math.random() * mockTickers.length)];
    const mockPrices: Record<string, number> = { FPT: 135000, VNM: 68000, HPG: 29000, VIC: 42000 };
    const currentPrice = mockPrices[ticker];

    const decision = Math.random() > 0.5 ? "BUY" : Math.random() > 0.5 ? "SELL" : "HOLD";

    if (decision === "BUY") {
      const budget = availableCash * 0.25;
      if (budget >= currentPrice) {
        const sharesToBuy = Math.floor(budget / currentPrice);
        const cost = sharesToBuy * currentPrice;
        setAvailableCash((prev) => prev - cost);
        setPositions((prev) => {
          const current = prev[ticker] || { shares: 0, avgPrice: 0 };
          const totalShares = current.shares + sharesToBuy;
          const avgPrice = ((current.shares * current.avgPrice) + cost) / totalShares;
          return {
            ...prev,
            [ticker]: { shares: totalShares, avgPrice }
          };
        });
        addLog("BUY", `BUY ${sharesToBuy} shares of ${ticker} @ ${currentPrice.toLocaleString()} VND.`);
      } else {
        addLog("HOLD", `HOLD decision for ${ticker}. Insufficient funds.`);
      }
    } else if (decision === "SELL") {
      const pos = positions[ticker];
      if (pos && pos.shares > 0) {
        const sharesToSell = Math.random() > 0.5 ? Math.floor(pos.shares / 2) || pos.shares : pos.shares;
        const revenue = sharesToSell * currentPrice;
        setAvailableCash((prev) => prev + revenue);
        setPositions((prev) => {
          const current = { ...prev };
          const remaining = current[ticker].shares - sharesToSell;
          if (remaining <= 0) {
            delete current[ticker];
          } else {
            current[ticker] = { shares: remaining, avgPrice: current[ticker].avgPrice };
          }
          return current;
        });
        addLog("SELL", `SELL ${sharesToSell} shares of ${ticker} @ ${currentPrice.toLocaleString()} VND.`);
      } else {
        addLog("HOLD", `HOLD decision for ${ticker}. Evaluated indicators: neutral.`);
      }
    } else {
      addLog("HOLD", `HOLD decision for ${ticker}. No clear action signals.`);
    }
  };

  const handleReset = () => {
    if (confirm("Reset wallet to default values?")) {
      setAvailableCash(10000000);
      setPositions({});
      setLogs([
        {
          timestamp: new Date().toLocaleTimeString(),
          type: "SYSTEM",
          message: "Wallet state reset. Initialized cash to 10,000,000 VND."
        }
      ]);
    }
  };

  const positionsList = Object.entries(positions);

  return (
    <main className="max-w-6xl mx-auto px-6 py-12 flex flex-col min-h-screen justify-between">
      {/* Top Header & Status */}
      <div>
        <header className="flex items-baseline gap-4 mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight text-white font-sans">
            SentinelTrader
          </h1>
          <span
            className={`text-xs font-bold tracking-widest font-mono uppercase transition-colors duration-300 ${
              botRunning ? "text-accent" : "text-paused"
            }`}
          >
            {botRunning ? "● AI ACTIVE" : "○ PAUSED"}
          </span>
        </header>

        {/* Portfolio Metrics Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="border-l border-border pl-6 py-1">
            <div className="text-[10px] font-bold text-foreground/50 tracking-widest uppercase mb-1">
              PORTFOLIO VALUE
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              <span className="text-sm font-normal text-foreground/50 ml-1">VND</span>
            </div>
          </div>

          <div className="border-l border-border pl-6 py-1">
            <div className="text-[10px] font-bold text-foreground/50 tracking-widest uppercase mb-1">
              AVAILABLE CASH
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {availableCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              <span className="text-sm font-normal text-foreground/50 ml-1">VND</span>
            </div>
          </div>

          <div className="border-l border-border pl-6 py-1">
            <div className="text-[10px] font-bold text-foreground/50 tracking-widest uppercase mb-1">
              ACTIVE POSITIONS
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {positionsList.length}
            </div>
          </div>
        </section>

        <hr className="border-border my-8" />

        {/* Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Column: Live Holdings */}
          <div className="lg:col-span-2">
            <h2 className="text-[10px] font-bold tracking-widest text-foreground/50 uppercase mb-4">
              LIVE PORTFOLIO HOLDINGS
            </h2>
            {positionsList.length === 0 ? (
              <div className="border border-dashed border-border rounded p-16 text-center text-sm text-foreground/40 font-sans">
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
                    {positionsList.map(([ticker, pos]) => {
                      const mockPrices: Record<string, number> = { FPT: 135000, VNM: 68000, HPG: 29000, VIC: 42000 };
                      const currentPrice = mockPrices[ticker] || pos.avgPrice;
                      const currentValue = pos.shares * currentPrice;
                      return (
                        <tr key={ticker} className="border-b border-border last:border-0 hover:bg-[#12161f]/10">
                          <td className="py-4 px-4 text-sm font-semibold text-white">{ticker}</td>
                          <td className="py-4 px-4 text-sm text-right text-white">{pos.shares.toLocaleString()}</td>
                          <td className="py-4 px-4 text-sm text-right text-foreground/75">{pos.avgPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} VND</td>
                          <td className="py-4 px-4 text-sm text-right text-white">{currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} VND</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Column: Controls */}
          <div>
            <h2 className="text-[10px] font-bold tracking-widest text-foreground/50 uppercase mb-4">
              CONTROLS
            </h2>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleToggle}
                className="w-full bg-[#12161f] text-white border border-border rounded py-3 text-xs font-semibold hover:border-foreground/40 hover:bg-[#161b24] transition-all"
              >
                {botRunning ? "Pause AI Session" : "Resume AI Session"}
              </button>
              <button
                onClick={handleScan}
                className="w-full bg-[#12161f] text-white border border-border rounded py-3 text-xs font-semibold hover:border-foreground/40 hover:bg-[#161b24] transition-all"
              >
                Force Gemini Scan
              </button>
              <button
                onClick={handleReset}
                className="w-full bg-transparent text-paused border border-paused/25 rounded py-3 text-xs font-semibold hover:border-paused/50 hover:bg-paused/5 transition-all"
              >
                Reset Account Balance
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Console Feed */}
      <div className="mt-12">
        <h2 className="text-[10px] font-bold tracking-widest text-foreground/50 uppercase mb-4">
          GEMINI DECISION LOG
        </h2>
        <div className="bg-terminalBg border border-border rounded p-5 h-48 overflow-y-auto font-mono custom-scrollbar">
          {logs.map((log, index) => {
            let color = "text-[#adbac7]";
            if (log.type === "BUY") color = "text-accent";
            else if (log.type === "SELL") color = "text-paused";
            else if (log.type === "HOLD") color = "text-foreground/40";

            return (
              <div key={index} className={`text-xs leading-6 ${color}`}>
                <span className="text-foreground/30 mr-3" suppressHydrationWarning>[{log.timestamp}]</span>
                <span>{log.message}</span>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
