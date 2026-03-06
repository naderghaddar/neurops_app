import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import { getUserWorkspace } from "@/lib/userWorkspace";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const workspace = await getUserWorkspace(userId);

  if (!workspace) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1>Neurops CRM</h1>
        <p style={{ color: "crimson" }}>
          Your user is authenticated but is not linked to any workspace.
        </p>
      </main>
    );
  }

  redirect(`/dashboard/workspaces/${workspace.workspaceId}`);
}
