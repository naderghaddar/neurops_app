import { headers } from "next/headers";

type WorkspaceDTO = {
  id: string;
  name: string;
  workspaceKey: string;
  webhookKey: string;
  createdAt: string;
  voiceflow?: Array<{
    id: string;
    name: string;
    projectId: string;
    channel: string;
  }>;
};

async function safeJson<T>(res: Response): Promise<T | null> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

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

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const base = `${proto}://${host}`;

  const wsRes = await fetch(
    `${base}/api/workspace/${encodeURIComponent(key)}/voiceflow/connections/by-key?workspaceKey=${encodeURIComponent(
      key
    )}`,
    {
      cache: "no-store",
    }
  );

  const wsJson = await safeJson<{ workspace?: WorkspaceDTO; error?: string }>(wsRes);
  const workspace = wsJson?.workspace;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Neurops CRM Demo</h1>

      <section style={{ marginTop: 24, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Workspace</h2>

        {!workspace ? (
          <div style={{ color: "crimson" }}>
            Failed to load workspace: {wsJson?.error ?? `HTTP ${wsRes.status}`}
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
        <h2>Transcript Connections</h2>
        {!workspace?.voiceflow || workspace.voiceflow.length === 0 ? (
          <div style={{ color: "#666" }}>No active Voiceflow connections.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {workspace.voiceflow.map((c) => (
              <li key={c.id} style={{ marginBottom: 8 }}>
                <b>{c.name}</b> ({c.channel}) - {c.projectId}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
