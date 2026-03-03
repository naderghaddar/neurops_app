type WorkspaceDTO = {
  id: string;
  name: string;
  workspaceKey: string;
  webhookKey: string;
  createdAt: string;
};

type EventRow = {
  id: string;
  type: string;
  source: string | null;
  receivedAt: string;
};

export default async function DashboardPage() {
  const key = process.env.DEMO_WORKSPACE_KEY;
  if (!key) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1>Neurops CRM Demo</h1>
        <p style={{ color: "crimson" }}>
          Missing DEMO_WORKSPACE_KEY in your .env
        </p>
      </main>
    );
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://192.168.2.18:3000";

  const [wsRes, evRes] = await Promise.all([
    fetch(`${base}/api/workspace/by-key`, {
      headers: { "x-workspace-key": key },
      cache: "no-store",
    }),
    fetch(`${base}/api/events/recent`, {
      headers: { "x-workspace-key": key },
      cache: "no-store",
    }),
  ]);

  const wsJson: { workspace?: WorkspaceDTO; error?: string } = await wsRes.json();
  const evJson: { events?: EventRow[]; error?: string } = await evRes.json();

  const workspace = wsJson.workspace;
  const events: EventRow[] = evJson.events ?? [];

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Neurops CRM Demo</h1>

      <section style={{ marginTop: 24, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Workspace</h2>

        {!workspace ? (
          <div style={{ color: "crimson" }}>
            Failed to load workspace: {wsJson.error ?? `HTTP ${wsRes.status}`}
          </div>
        ) : (
          <>
            <div><b>Name:</b> {workspace.name}</div>
            <div><b>Workspace Key:</b> <code>{workspace.workspaceKey}</code></div>
            <div><b>Webhook Key:</b> <code>{workspace.webhookKey}</code></div>
          </>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Recent Events</h2>

        {evRes.ok ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Type</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Source</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Received</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{e.type}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{e.source ?? "-"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    {new Date(e.receivedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ color: "crimson" }}>
            Failed to load events: {evJson.error ?? `HTTP ${evRes.status}`}
          </div>
        )}
      </section>
    </main>
  );
}