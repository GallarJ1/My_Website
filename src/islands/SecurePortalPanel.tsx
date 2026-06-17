import { useEffect, useState } from "react";

/* ================= API Configuration ================= */
const API = "https://api.jeremygallardo.com";

/* ================= Live AWS Demo Panel ================= */
export default function SecurePortalPanel() {
  const [health, setHealth] = useState<any>(null);
  const [db, setDb] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [h, d, a, t] = await Promise.all([
        fetch(`${API}/api/health`).then((r) => r.json()),
        fetch(`${API}/api/dbcheck`).then((r) => r.json()),
        fetch(`${API}/api/assets`).then((r) => r.json()),
        fetch(`${API}/api/tickets`).then((r) => r.json()),
      ]);

      setHealth(h);
      setDb(d);
      setAssets(a);
      setTickets(t);
    } catch (err) {
      console.error("AWS portal fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const openTickets = tickets.filter((t) => t.status?.toLowerCase() === "open");

  return (
    <div className="secure-portal-panel">
      {/* Header and refresh action */}
      <div className="secure-portal-header">
        <div>
          <p className="secure-eyebrow">AWS LIVE DEMO</p>
          <h3>AWS Secure Enterprise Portal</h3>
          <p>
            Live EC2-hosted API connected to private PostgreSQL RDS through AWS
            security groups.
          </p>
        </div>

        <button onClick={loadData} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Live Data"}
        </button>
      </div>

      {/* High-level request/data path */}
      <div className="secure-portal-flow">
        <span>User</span>
        <b>→</b>
        <span>EC2 API</span>
        <b>→</b>
        <span>Private RDS</span>
      </div>

      {/* Live summary metrics */}
      <div className="secure-portal-grid">
        <div className="secure-card">
          <small>API Status</small>
          <strong>{health?.status ? "ONLINE" : "CHECKING"}</strong>
        </div>

        <div className="secure-card">
          <small>Database</small>
          <strong>{db?.database === "connected" ? "CONNECTED" : "CHECKING"}</strong>
        </div>

        <div className="secure-card">
          <small>Assets</small>
          <strong>{assets.length}</strong>
        </div>

        <div className="secure-card">
          <small>Open Tickets</small>
          <strong>{openTickets.length}</strong>
        </div>
      </div>

      {/* Live database rows */}
      <div className="secure-data-columns">
        <div>
          <h4>Managed Assets</h4>
          {assets.map((asset) => (
            <div className="secure-row" key={asset.id}>
              <span>{asset.name}</span>
              <em>{asset.status}</em>
            </div>
          ))}
        </div>

        <div>
          <h4>Service Tickets</h4>
          {tickets.map((ticket) => (
            <div className="secure-row" key={ticket.id}>
              <span>{ticket.title}</span>
              <em>{ticket.priority}</em>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
