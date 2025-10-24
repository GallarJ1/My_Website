import React, { useEffect, useMemo, useRef, useState } from "react";

type Msg = { role: "user" | "assistant" | "system"; content: string };
type Props = { apiUrl: string };

export default function AutoForgeTerminal({ apiUrl }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const termRef = useRef<HTMLDivElement | null>(null);

  const origin = useMemo(() => {
    try { return new URL(apiUrl).origin; } catch { return apiUrl; }
  }, [apiUrl]);

  useEffect(() => {
    termRef.current?.scrollTo({ top: termRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setErr(null);
    setBusy(true);

    // append user message
    setMessages(m => [...m, { role: "user", content: text }]);
    setInput("");

    const body = JSON.stringify({
      messages: [
        ...messages.map(({ role, content }) => ({ role, content })),
        { role: "user", content: text }
      ]
    });

    const t0 = performance.now();
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      });

      const raw = await res.text();
      let reply = "";

      // Try common response shapes
      try {
        const json = raw ? JSON.parse(raw) : {};
        reply =
          json.reply ??
          json.content ??
          json.message ??
          json.choices?.[0]?.message?.content ??
          raw;
      } catch {
        reply = raw || "(empty response)";
      }

      const ms = Math.max(0, Math.round(performance.now() - t0));
      setMessages(m => [...m, { role: "assistant", content: reply || "(no content)" }]);

      // Optional: show a subtle status line
      setMessages(m => [...m, { role: "system", content: `✓ responded in ${ms}ms from ${origin}` }]);
    } catch (e: any) {
      setErr(e?.message || "Network error");
      setMessages(m => [...m, { role: "system", content: "× request failed" }]);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="terminal-box" style={{ padding: 0 }}>
      <div className="terminal-bar">
        <span className="terminal-dot red" />
        <span className="terminal-dot yellow" />
        <span className="terminal-dot green" />
        <div style={{ marginLeft: 12, fontWeight: 700 }}>AutoForge Terminal</div>
        <div className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>{new Date().toLocaleTimeString()}</div>
      </div>

      <div ref={termRef} className="terminal-screen" style={{ minHeight: 180, maxHeight: 320 }}>
        <Line>$ connect {origin}</Line>
        {messages.map((m, i) => (
          <Block key={i} role={m.role} text={m.content} />
        ))}
        {busy && <Line className="muted">… contacting API …</Line>}
        {err && <Line className="err">! {err}</Line>}
      </div>

      <div className="cmdbar" style={{ padding: "8px 10px", display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
        <textarea
          className="cmdinput"
          placeholder="Ask anything… (Shift+Enter for newline, Enter to send)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          spellCheck={false}
        />
        <button className="btn-terminal" onClick={send} disabled={busy || !input.trim()}>
          {busy ? "Sending…" : "Send"}
        </button>
      </div>

      <style>{`
        .cmdinput {
          resize: vertical;
          min-height: 38px;
          max-height: 160px;
          background: rgba(0,25,32,.45);
          border: 1px solid rgba(0,229,255,.25);
          border-radius: 10px;
          color: #dff9ff;
          font-family: JetBrains Mono, ui-monospace, monospace;
          font-size: 13px;
          padding: 8px 10px;
          outline: none;
          box-shadow: inset 0 0 12px rgba(0,255,255,.06);
        }
        .cmdinput:focus {
          border-color: rgba(0,229,255,.45);
          box-shadow: 0 0 16px rgba(0,255,255,.12), inset 0 0 12px rgba(0,255,255,.08);
        }
      `}</style>
    </div>
  );
}

function Line({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

function Block({ role, text }: { role: Msg["role"]; text: string }) {
  const color =
    role === "assistant" ? "ok" :
    role === "system" ? "muted" :
    "";
  const prefix =
    role === "assistant" ? "assistant>" :
    role === "system" ? "--" :
    "user>";

  return (
    <div style={{ marginBottom: 8 }}>
      <Line className={color}>
        {prefix} <span className="muted">{sanitize(text)}</span>
      </Line>
    </div>
  );
}

// very light sanitization for display
function sanitize(s: string) {
  return s.replace(/\s+/g, " ").trim();
}
