import React, { useEffect, useMemo, useRef, useState } from "react";

/* ================= Error Boundary ================= */
class PanelErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: any) { return { err: e?.message ?? "Unknown error" }; }
  componentDidCatch(e: any) { console.error("[CloudLabPanel] crashed:", e); }
  render() {
    if (this.state.err) {
      return (
        <div className="terminal-box" style={{ padding: 16, minHeight: 180 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>CloudLab Terminal</div>
          <div className="err">The panel hit an error: {this.state.err}</div>
          <div className="muted" style={{ marginTop: 8 }}>Open DevTools → Console for details.</div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ================= Typewriter Hooks (slower) ================= */
function useTypewriter(text: string, msPerChar = 80) {
  const [out, setOut] = useState("");
  useEffect(() => {
    let alive = true, i = 0;
    const tick = () => {
      if (!alive) return;
      i = Math.min(text.length, i + 1);
      setOut(text.slice(0, i));
      if (i < text.length) setTimeout(() => requestAnimationFrame(tick), msPerChar);
    };
    tick();
    return () => { alive = false; };
  }, [text, msPerChar]);
  return out;
}

function useCascade(lines: string[], msPerChar = 70, linePause = 300) {
  const [outs, setOuts] = useState<string[]>(Array(lines.length).fill(""));
  const [li, setLi] = useState(0);
  const [ci, setCi] = useState(0);

  useEffect(() => {
    let alive = true;
    const step = () => {
      if (!alive) return;
      if (li >= lines.length) return;

      const next = Math.min(lines[li].length, ci + 1);
      setOuts(prev => {
        const copy = [...prev];
        copy[li] = lines[li].slice(0, next);
        return copy;
      });
      setCi(next);

      if (next >= lines[li].length) {
        setTimeout(() => {
          setLi(li + 1);
          setCi(0);
          setTimeout(() => requestAnimationFrame(step), msPerChar);
        }, linePause);
      } else {
        setTimeout(() => requestAnimationFrame(step), msPerChar);
      }
    };
    step();
    return () => { alive = false; };
  }, [li, ci, lines, msPerChar, linePause]);

  return outs;
}

/* ================= Types ================= */
type CloudLabPanelProps = {
  apiUrl: string;      // full /api/health URL
  baseUrl?: string;    // optional override for base
};
type CallResult = {
  url: string; ok: boolean; status: number; statusText: string;
  bodyPreview: string; fullJson?: unknown; timeMs: number; at: string;
};

/* ================= Main ================= */
export default function CloudLabPanel(props: CloudLabPanelProps) {
  return (
    <PanelErrorBoundary>
      <CloudLabPanelInner {...props} />
    </PanelErrorBoundary>
  );
}

function CloudLabPanelInner({ apiUrl, baseUrl }: CloudLabPanelProps) {
  const derivedBase = useMemo(() => {
    try { return new URL(apiUrl).origin; }
    catch { return apiUrl.replace(/\/api\/health\/?$/i, ""); }
  }, [apiUrl]);
  const root = (baseUrl ?? derivedBase).replace(/\/+$/, "");

  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<CallResult[]>([]);
  const termRef = useRef<HTMLDivElement | null>(null);

  // Slow typewriter content
  const heading = "Use the commands below to query the CloudLab API:";
  const typedHeading = useTypewriter(heading, 80);
  useCascade(
    [
      "Health: checks service health.",
      "Ping: quick reachability test.",
      "DB Check: verifies database connectivity.",
    ],
    70,
    350
  );

  // Autoscroll terminal
  useEffect(() => {
    termRef.current?.scrollTo({ top: termRef.current.scrollHeight, behavior: "smooth" });
  }, [history]);

  // Fetch helper
  const requestInit: globalThis.RequestInit = useMemo(
    () => ({ method: "GET", headers: { Accept: "application/json" } }),
    []
  );
  const call = async (fullUrl: string): Promise<CallResult> => {
    const t0 = performance.now();
    let status = 0, statusText = "", ok = false, bodyPreview = "", fullJson: unknown;
    try {
      const r = await fetch(fullUrl, requestInit);
      status = r.status; statusText = r.statusText || ""; ok = r.ok;
      const raw = await r.text();
      try { fullJson = raw ? JSON.parse(raw) : undefined; bodyPreview = previewJson(fullJson); }
      catch { bodyPreview = trimPreview(raw); }
    } catch (e: any) {
      status = 0; statusText = e?.message ?? "Network error"; ok = false; bodyPreview = "(request failed)";
    }
    const t1 = performance.now();
    return { url: fullUrl, ok, status, statusText, bodyPreview, fullJson, timeMs: Math.round(t1 - t0), at: new Date().toLocaleString() };
  };

  /* ======== Network Viz Animation (packet along path) ======== */
  const pathRef = useRef<SVGPathElement | null>(null);
  const packetRef = useRef<SVGCircleElement | null>(null);
  const animRAF = useRef<number | null>(null);

  function placePacket(t: number) {
    const path = pathRef.current, dot = packetRef.current;
    if (!path || !dot) return;
    const L = path.getTotalLength();
    const p = path.getPointAtLength(Math.max(0, Math.min(L, t * L)));
    dot.setAttribute("cx", String(p.x));
    dot.setAttribute("cy", String(p.y));
  }
  function animateT(start: number, end: number, durMs: number) {
    return new Promise<void>((resolve) => {
      const t0 = performance.now();
      const step = (now: number) => {
        const prog = Math.min(1, (now - t0) / durMs);
        const t = start + (end - start) * prog;
        placePacket(t);
        if (prog < 1) {
          animRAF.current = requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      placePacket(start);
      animRAF.current = requestAnimationFrame(step);
    });
  }
  useEffect(() => () => { if (animRAF.current) cancelAnimationFrame(animRAF.current); }, []);

  async function animateReqResp(ok: boolean) {
    pathRef.current?.classList.add("paused");
    if (packetRef.current) {
      packetRef.current.style.fill = ok ? "#22c55e" : "#ef4444";
      packetRef.current.style.display = "block";
    }
    await animateT(0, 1, 420);
    await delay(150);
    await animateT(1, 0, 420);
    if (packetRef.current) packetRef.current.style.display = "none";
    pathRef.current?.classList.remove("paused");
  }

  // Button click only (no auto-call)
  const run = async (path: string) => {
    setError(null);

    // animate forward while in-flight
    placePacket(0);
    if (packetRef.current) { packetRef.current.style.fill = "#22c55e"; packetRef.current.style.display = "block"; }
    pathRef.current?.classList.add("paused");
    await animateT(0, 1, 420);

    const res = await call(`${root}${path}`);
    setHistory((h) => [...h, res]);

    // animate back with result color
    if (packetRef.current) packetRef.current.style.fill = res.ok ? "#22c55e" : "#ef4444";
    await delay(150);
    await animateT(1, 0, 420);

    if (packetRef.current) packetRef.current.style.display = "none";
    pathRef.current?.classList.remove("paused");

    if (!res.ok) setError(`Request failed (${res.status} ${res.statusText || ""})`);
  };

  return (
    <div className="terminal-box" style={{ minHeight: 280 }}>
      {/* Header */}
      <div className="terminal-bar">
        <span className="terminal-dot red" />
        <span className="terminal-dot yellow" />
        <span className="terminal-dot green" />
        <div style={{ marginLeft: 12, fontWeight: 700 }}>CloudLab Terminal</div>
        <div className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>{new Date().toLocaleTimeString()}</div>
      </div>

      {/* Viz + Instructions */}
      <div style={{ padding: "0 16px 6px" }}>
        <div className="net-viz">
          <svg viewBox="0 0 600 60" preserveAspectRatio="xMidYMid meet">
            {/* client node */}
            <rect className="net-node" x="30" y="16" rx="8" ry="8" width="110" height="28" />
            <text className="net-label" x="85" y="35" textAnchor="middle">Client</text>
            {/* API node */}
            <rect className="net-node" x="460" y="16" rx="8" ry="8" width="110" height="28" />
            <text className="net-label" x="515" y="35" textAnchor="middle">CloudLab API</text>
            {/* dashed path + packet */}
            <path ref={pathRef} className="net-path" d="M 140 30 C 220 30 380 30 460 30" fill="none" />
            <circle ref={packetRef} className="net-packet" cx="140" cy="30" style={{ display: "none" }} />
          </svg>
        </div>

        <div className="typewriter" style={{ marginTop: 2 }}>{typedHeading}</div>
        <ul className="muted" style={{ marginTop: 8, marginLeft: 18 }}>
          <li><kbd className="kbd">Health</kbd> : checks service health.</li>
          <li><kbd className="kbd">Ping</kbd>   : quick reachability test.</li>
          <li><kbd className="kbd">DB Check</kbd> : verifies database connectivity.</li>
        </ul>
      </div>

      {/* Buttons */}
      <div className="cmdbar btn-row" style={{ alignItems: "center" }}>
        <button className="btn-terminal" title="Returns service health" onClick={() => run("/api/health")}>Check Health</button>
        <button className="btn-terminal" title="Simple reachability test" onClick={() => run("/api/ping")}>Ping</button>
        <button className="btn-terminal" title="Checks DB connectivity" onClick={() => run("/api/dbcheck")}>DB Check</button>
        <span className="muted" style={{ gridColumn: "1 / -1", textAlign: "right", fontSize: 12, marginTop: 4 }}>Ready.</span>
      </div>

      {/* Terminal output */}
      <div ref={termRef} className="terminal-screen" style={{ minHeight: 120 }}>
        <Line>$ connect {root}</Line>
        {history.map((h, i) => <Block key={i} res={h} />)}
        {error && (
          <div className="err" style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
            <span>! {error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================ Tiny UI atoms + helpers ================ */
function Line({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className || ""}>{children}</div>;
}
function Block({ res }: { res: CallResult }) {
  const color = res.ok ? "ok" : "warn";
  return (
    <div style={{ marginBottom: 8 }}>
      <Line>$ GET <span className="muted">{res.url}</span></Line>
      <Line>↳ <span className={color}>{res.ok ? "OK" : "ERR"}</span> [{res.status} {res.statusText || ""}] in {res.timeMs}ms @ {res.at}</Line>
      <pre style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{res.bodyPreview}</pre>
    </div>
  );
}
function delay(ms: number) { return new Promise((s) => setTimeout(s, ms)); }
function trimPreview(s: string, max = 260) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max) + " …" : t || "(empty)";
}
function previewJson(v: unknown, max = 260) {
  const s = JSON.stringify(v, null, 2);
  return trimPreview(s, max);
}
