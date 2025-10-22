import React, { useMemo, useRef, useState, useEffect } from "react";

type Day = { day: number; encrypted: number; pending: number; failed: number };
type Props = { days: Day[] };

const C_ENC = "#16c2c2";   // cyan/teal (encrypted)
const C_PEN = "#94a3b8";   // slate (pending)
const C_FAIL = "#fbbf24";  // amber (failed) – subtle security accent

export default function BitlockerPie({ days }: Props) {
  const [i, setI] = useState(0);          // current day index
  const [playing, setPlaying] = useState(false);
  const tRef = useRef<number | null>(null);

  const total = useMemo(() => {
    const d = days[i];
    return Math.max(1, d.encrypted + d.pending + d.failed);
  }, [days, i]);

  // Derived angles (as fractions of 1)
  const segs = useMemo(() => {
    const d = days[i];
    const f = (n: number) => n / total;
    return [
      { label: "Encrypted", val: d.encrypted, frac: f(d.encrypted), color: C_ENC },
      { label: "Pending",   val: d.pending,   frac: f(d.pending),   color: C_PEN },
      { label: "Failed",    val: d.failed,    frac: f(d.failed),    color: C_FAIL },
    ];
  }, [days, i, total]);

  // Animate Day 1 → Day 4 when Start is pressed
  const start = () => {
    if (playing) return;
    setPlaying(true);
    setI(0);
    // step through days every 1200ms
    let step = 0;
    const tick = () => {
      step++;
      if (step >= days.length) {
        setPlaying(false);
        tRef.current = null;
        return;
      }
      setI(step);
      tRef.current = window.setTimeout(tick, 1200) as unknown as number;
    };
    tRef.current = window.setTimeout(tick, 1200) as unknown as number;
  };

  useEffect(() => {
    return () => { if (tRef.current) window.clearTimeout(tRef.current); };
  }, []);

  // Pie sizing
  const size = 260;                 // SVG viewport
  const r = 110;                    // radius
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;

  // Build arc segments using circles with stroke-dasharray
  let acc = 0;
  const arcs = segs.map((s, idx) => {
    const len = circ * s.frac;
    const dash = `${len} ${circ - len}`;
    const rot = (acc * 360) - 90;  // start at 12 o'clock
    acc += s.frac;
    return (
      <circle
        key={idx}
        cx={cx}
        cy={cy}
        r={r}
        fill="transparent"
        stroke={s.color}
        strokeWidth={24}
        strokeDasharray={dash}
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          transform: `rotate(${rot}deg)`,
          transition: "stroke-dasharray 600ms ease, transform 600ms ease",
          filter: "drop-shadow(0 0 8px rgba(0,255,255,.25))"
        }}
      />
    );
  });

  // Legend
  const legend = (
    <div className="legend">
      {segs.map((s, idx) => (
        <div className="row" key={idx}>
          <span className="sw" style={{ background: s.color }} />
          <span className="name">{s.label}</span>
          <span className="val">{s.val.toString().padStart(2, " ")}</span>
        </div>
      ))}
      <div className="row total">
        <span className="name">Total</span>
        <span className="val">{total}</span>
      </div>
    </div>
  );

  return (
    <div className="pie-wrap">
      <div className="chart">
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="BitLocker rollout pie chart">
          {/* faint bg ring */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(120,220,240,.12)" strokeWidth={24} />
          {arcs}
          {/* center label */}
          <text x={cx} y={cy - 6} textAnchor="middle" fontFamily="JetBrains Mono, ui-monospace" fontSize="14" fill="#c8f1ff">
            Day {days[i].day}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontFamily="JetBrains Mono, ui-monospace" fontSize="11" fill="rgba(200,240,255,.75)">
            {((days[i].encrypted / total) * 100).toFixed(0)}% Encrypted
          </text>
        </svg>
      </div>
      {legend}
      <div className="controls">
        <button className="btn-terminal" onClick={start} disabled={playing}>
          {playing ? "Running…" : "Start"}
        </button>
        <span className="hint muted">Plays Day 1 → Day {days.length}.</span>
      </div>

      <style>{`
        .pie-wrap {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 18px;
          align-items: center;
          padding: 8px 4px;
        }
        @media (max-width: 720px) {
          .pie-wrap { grid-template-columns: 1fr; }
          .chart { justify-self: center; }
        }
        .legend {
          display: grid;
          gap: 6px;
          align-self: start;
        }
        .row {
          display: grid;
          grid-template-columns: 14px auto auto;
          gap: 10px;
          align-items: center;
          color: rgba(200,230,240,.85);
          font-family: JetBrains Mono, ui-monospace, monospace;
          font-size: 12px;
        }
        .row.total {
          margin-top: 4px;
          color: #9bdcff;
          font-weight: 700;
        }
        .sw {
          width: 12px; height: 12px; border-radius: 3px;
          box-shadow: 0 0 8px rgba(0,255,255,.25);
        }
        .name { opacity: .9; }
        .val { justify-self: end; opacity: .8; }
        .controls {
          grid-column: 1 / -1;
          display: flex; gap: 12px; align-items: center; margin-top: 6px;
        }
        .btn-terminal {
          padding: 8px 14px;
          border: 1px solid rgba(0,229,255,.35);
          border-radius: 10px;
          background: rgba(0,25,32,.45);
          color: #dff9ff;
          font-family: JetBrains Mono, ui-monospace, monospace;
          font-size: 13px;
          box-shadow: 0 0 18px rgba(0,255,255,.1);
          transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
        }
        .btn-terminal:hover { transform: translateY(-1px); box-shadow: 0 0 22px rgba(0,255,255,.16); }
        .btn-terminal:disabled { opacity: .7; cursor: default; }
        .hint { font-size: 12px; margin-left: 4px; }
      `}</style>
    </div>
  );
}
