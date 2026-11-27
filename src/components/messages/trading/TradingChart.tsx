import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { X } from "lucide-react";
import {
  CandlestickSeries,
  ColorType,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { api } from "../../../../convex/_generated/api";
import { cn } from "@/lib/cn";

// Live BTC/USDT or ETH/USDT chart (public Binance market data, the same feed as
// TradingView's BINANCE:BTCUSDT) with the trading bot's practice activity drawn
// on it. BTC: open trades as entry/stop/target lines, closed ones as green/red
// marks. ETH: the ranges of the practice liquidity pools.

const SYMBOLS = { BTC: "BTCUSDT", ETH: "ETHUSDT" } as const;
type Coin = keyof typeof SYMBOLS;
const DATA_URL = "https://data-api.binance.vision/api/v3/klines";
const INTERVALS = ["1m", "5m", "1h", "4h", "1d"] as const;
type Interval = (typeof INTERVALS)[number];
const POLL_MS = 5000;
// The chart library draws times in UTC; shifting by the local offset makes the
// axis show the viewer's own clock.
const LOCAL_OFFSET_S = -new Date().getTimezoneOffset() * 60;
const toChartTime = (ms: number) => (Math.floor(ms / 1000) + LOCAL_OFFSET_S) as UTCTimestamp;

interface Candle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

async function fetchCandles(coin: Coin, interval: Interval, limit: number): Promise<Candle[]> {
  const res = await fetch(`${DATA_URL}?symbol=${SYMBOLS[coin]}&interval=${interval}&limit=${limit}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = (await res.json()) as [number, string, string, string, string][];
  return rows.map((k) => ({
    time: toChartTime(k[0]),
    open: +k[1],
    high: +k[2],
    low: +k[3],
    close: +k[4],
  }));
}

function ema(values: number[], n: number): number[] {
  const k = 2 / (n + 1);
  const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)));
  return out;
}

const fmt = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const sideLabel = (s: "long" | "short") => (s === "long" ? "Long" : "Short");

export function TradingChart({ onClose }: { onClose: () => void }) {
  const snapshot = useQuery(api.tradingBot.snapshot);
  const boxRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ema10Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema55Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const candlesRef = useRef<Candle[]>([]);
  // Stop/target of open trades, so the price scale always shows them.
  const levelsRef = useRef<number[]>([]);
  const [interval, setInterval_] = useState<Interval>("5m");
  const [coin, setCoin] = useState<Coin>("BTC");
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState(false);

  // Chart setup, once.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const chart = createChart(box, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#0b0b0d" }, textColor: "#9ca3af" },
      grid: { vertLines: { color: "#1c1c22" }, horzLines: { color: "#1c1c22" } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#2a2a33" },
      rightPriceScale: { borderColor: "#2a2a33" },
      crosshair: { mode: 0 },
    });
    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      autoscaleInfoProvider: (original: () => { priceRange: { minValue: number; maxValue: number } | null } | null) => {
        const res = original();
        const levels = levelsRef.current;
        if (!res?.priceRange || levels.length === 0) return res;
        return {
          ...res,
          priceRange: {
            minValue: Math.min(res.priceRange.minValue, ...levels),
            maxValue: Math.max(res.priceRange.maxValue, ...levels),
          },
        };
      },
    });
    ema10Ref.current = chart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    ema55Ref.current = chart.addSeries(LineSeries, { color: "#b45309", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    markersRef.current = createSeriesMarkers(candleRef.current, []);
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Candles: full load on interval change, then poll the last two.
  useEffect(() => {
    let alive = true;
    function setEmas(all: Candle[]) {
      const closes = all.map((c) => c.close);
      const e10 = ema(closes, 10);
      const e55 = ema(closes, 55);
      ema10Ref.current?.setData(all.map((c, i) => ({ time: c.time, value: e10[i] })));
      ema55Ref.current?.setData(all.map((c, i) => ({ time: c.time, value: e55[i] })));
    }
    async function load() {
      try {
        const all = await fetchCandles(coin, interval, 500);
        if (!alive) return;
        candlesRef.current = all;
        candleRef.current?.setData(all);
        setEmas(all);
        setPrice(all[all.length - 1]?.close ?? null);
        chartRef.current?.timeScale().scrollToRealTime();
        setError(false);
      } catch {
        if (alive) setError(true);
      }
    }
    async function tick() {
      try {
        const last = await fetchCandles(coin, interval, 2);
        if (!alive) return;
        const all = candlesRef.current;
        for (const c of last) {
          if (all.length && c.time === all[all.length - 1].time) all[all.length - 1] = c;
          else if (!all.length || c.time > all[all.length - 1].time) all.push(c);
          candleRef.current?.update(c);
        }
        setEmas(all);
        setPrice(last[last.length - 1]?.close ?? null);
        setError(false);
      } catch {
        if (alive) setError(true);
      }
    }
    candlesRef.current = [];
    setPrice(null);
    void load();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [interval, coin]);

  // Trades: price lines for open ones, markers for every entry/exit.
  useEffect(() => {
    const series = candleRef.current;
    if (!series) return;
    for (const l of linesRef.current) series.removePriceLine(l);
    linesRef.current = [];
    if (!snapshot) {
      levelsRef.current = [];
      markersRef.current?.setMarkers([]);
      return;
    }
    if (coin === "ETH") {
      levelsRef.current = snapshot.pools.flatMap((p) => [p.lo, p.hi]);
      for (const p of snapshot.pools) {
        const color = p.inside ? "#22c55e" : "#9ca3af";
        linesRef.current.push(
          series.createPriceLine({ price: p.hi, color, lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: `Pool #${p.n} máx` }),
          series.createPriceLine({ price: p.lo, color, lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: `Pool #${p.n} mín` })
        );
      }
      markersRef.current?.setMarkers([]);
      return;
    }
    levelsRef.current = [...snapshot.open.flatMap((t) => [t.stop, t.tp]), ...snapshot.grids.flatMap((g) => [g.lo, g.hi])];
    for (const g of snapshot.grids) {
      const color = g.inside ? "#a855f7" : "#9ca3af";
      const step = (g.hi - g.lo) / g.grids;
      for (let i = 0; i <= g.grids; i++) {
        const edge = i === 0 || i === g.grids;
        linesRef.current.push(
          series.createPriceLine({
            price: g.lo + step * i,
            color: edge ? color : `${color}55`,
            lineWidth: edge ? 2 : 1,
            lineStyle: edge ? 2 : 3,
            axisLabelVisible: edge,
            title: edge ? `Rango #${g.n} ${i === 0 ? "mín" : "máx"}` : "",
          })
        );
      }
    }
    for (const t of snapshot.open) {
      const tag = sideLabel(t.side);
      linesRef.current.push(
        series.createPriceLine({ price: t.entry, color: "#3b82f6", lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: `${tag} entrada` }),
        series.createPriceLine({ price: t.stop, color: "#ef4444", lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: "Stop" }),
        series.createPriceLine({ price: t.tp, color: "#22c55e", lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: "Objetivo" })
      );
    }
    const markers: SeriesMarker<Time>[] = [];
    for (const t of [...snapshot.closed, ...snapshot.open]) {
      markers.push({
        time: toChartTime(t.openedAt),
        position: t.side === "long" ? "belowBar" : "aboveBar",
        shape: t.side === "long" ? "arrowUp" : "arrowDown",
        color: "#3b82f6",
        text: sideLabel(t.side),
      });
      if (t.closedAt !== undefined && t.pnl !== undefined) {
        markers.push({
          time: toChartTime(t.closedAt),
          position: "inBar",
          shape: "circle",
          color: t.pnl >= 0 ? "#22c55e" : "#ef4444",
          text: `${t.pnl >= 0 ? "+" : ""}${fmt(t.pnl)}`,
        });
      }
    }
    // Markers must be sorted and snapped to the candles of the current interval.
    const step = { "1m": 60, "5m": 300, "1h": 3600, "4h": 14400, "1d": 86400 }[interval];
    markersRef.current?.setMarkers(
      markers
        // Snap to the candle the mark falls in (candles start on UTC boundaries).
        .map((m) => {
          const utc = (m.time as number) - LOCAL_OFFSET_S;
          return { ...m, time: (utc - (utc % step) + LOCAL_OFFSET_S) as UTCTimestamp };
        })
        .sort((a, b) => (a.time as number) - (b.time as number))
    );
  }, [snapshot, interval, coin]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stats = useMemo(() => {
    if (!snapshot) return null;
    const wins = snapshot.closed.filter((t) => (t.pnl ?? 0) > 0).length;
    const unrealized =
      price === null
        ? 0
        : snapshot.open.reduce((sum, t) => sum + (price - t.entry) * t.qty * (t.side === "long" ? 1 : -1), 0);
    return {
      wins,
      total: snapshot.closed.length,
      unrealized,
      change: ((snapshot.balance - snapshot.startBalance) / snapshot.startBalance) * 100,
    };
  }, [snapshot, price]);

  return (
    <div className="fixed inset-0 z-[85] bg-bg flex flex-col">
      <div className="flex items-center gap-3 px-3.5 md:px-5 py-3 border-b border-border flex-wrap">
        <div className="flex gap-1 bg-surface-alt rounded-md p-0.5">
          {(Object.keys(SYMBOLS) as Coin[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCoin(c)}
              className={cn(
                "px-2.5 py-1 rounded-sm text-sm font-extrabold cursor-pointer",
                c === coin ? "bg-accent text-accent-text" : "text-text-dim hover:text-text"
              )}
            >
              {c}/USDT
            </button>
          ))}
        </div>
        {price !== null && <div className="font-bold tabular-nums">{fmt(price, coin === "ETH" ? 2 : 1)}</div>}
        <div className="flex gap-1 bg-surface-alt rounded-md p-0.5">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => setInterval_(iv)}
              className={cn(
                "px-2.5 py-1 rounded-sm text-sm font-bold cursor-pointer",
                iv === interval ? "bg-accent text-accent-text" : "text-text-dim hover:text-text"
              )}
            >
              {iv}
            </button>
          ))}
        </div>
        <div className="text-xs text-text-dim hidden md:flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5 bg-[#3b82f6]" />EMA 10</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5 bg-[#b45309]" />EMA 55</span>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="w-9 h-9 rounded-full bg-surface-alt inline-flex items-center justify-center cursor-pointer hover:bg-surface"
        >
          <X size={18} />
        </button>
      </div>

      {coin === "ETH" && snapshot && (
        <div className="flex gap-x-5 gap-y-1 flex-wrap px-3.5 md:px-5 py-2 text-sm border-b border-border">
          {snapshot.pools.length === 0 ? (
            <span className="text-text-dim">
              No tienes pools de práctica abiertos. En el chat: «pool señal» o «pool abrir 1500 1900 100».
            </span>
          ) : (
            snapshot.pools.map((p) => {
              const res = p.value - p.capital;
              return (
                <span key={p.n}>
                  Pool #{p.n} ({fmt(p.lo, 0)}–{fmt(p.hi, 0)}) {p.inside ? "🟢" : "🔴"}{" "}
                  <b className="tabular-nums">{fmt(p.value)} USD</b>{" "}
                  <span className={res >= 0 ? "text-[#22c55e]" : "text-danger"}>
                    ({res >= 0 ? "+" : ""}
                    {fmt(res)})
                  </span>{" "}
                  · comisiones <b className="tabular-nums">{fmt(p.fees, 3)}</b>
                </span>
              );
            })
          )}
        </div>
      )}
      {coin === "BTC" && snapshot && stats && (
        <div className="flex gap-x-5 gap-y-1 flex-wrap px-3.5 md:px-5 py-2 text-sm border-b border-border">
          <span>
            Saldo de práctica: <b className="tabular-nums">{fmt(snapshot.balance)} {snapshot.currency}</b>{" "}
            <span className={stats.change >= 0 ? "text-[#22c55e]" : "text-danger"}>
              ({stats.change >= 0 ? "+" : ""}
              {fmt(stats.change)}%)
            </span>
          </span>
          <span>
            Abiertas: <b>{snapshot.open.length}</b>
            {snapshot.open.length > 0 && (
              <span className={stats.unrealized >= 0 ? "text-[#22c55e]" : "text-danger"}>
                {" "}
                ({stats.unrealized >= 0 ? "+" : ""}
                {fmt(stats.unrealized)} sin cerrar)
              </span>
            )}
          </span>
          <span>
            Cerradas: <b>{stats.total}</b> · ganadas <b>{stats.wins}</b>
          </span>
          {snapshot.grids.map((g) => {
            const res = g.value - g.capital;
            return (
              <span key={g.n}>
                Rango #{g.n} ({fmt(g.lo, 0)}–{fmt(g.hi, 0)}) {g.inside ? "🟢" : "⏸️"}{" "}
                <b className="tabular-nums">{fmt(g.value)} USD</b>{" "}
                <span className={res >= 0 ? "text-[#22c55e]" : "text-danger"}>
                  ({res >= 0 ? "+" : ""}
                  {fmt(res)})
                </span>{" "}
                · {g.sells} ventas · grid {fmt(g.profit, 3)}
              </span>
            );
          })}
        </div>
      )}
      {coin === "BTC" && snapshot === null && (
        <div className="px-3.5 md:px-5 py-2 text-sm text-text-dim border-b border-border">
          Todavía no hay operaciones de práctica.
        </div>
      )}
      {error && <div className="px-5 py-1 text-xs text-danger">Sin conexión con los precios; reintentando…</div>}

      <div ref={boxRef} className="flex-1 min-h-0" />
    </div>
  );
}
