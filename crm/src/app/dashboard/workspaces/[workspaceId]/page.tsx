import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

type WorkspaceDashboardPageProps = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export default async function WorkspaceDashboardPage({
  params,
}: WorkspaceDashboardPageProps) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const { workspaceId } = await params;

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    select: {
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!membership) {
    redirect("/dashboard");
  }

  const primaryConnection = await prisma.voiceflowConnection.findFirst({
    where: {
      workspaceId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const leadsHref = `/dashboard/workspaces/${workspaceId}/leads`;
  const transcriptsHref = primaryConnection
    ? `/dashboard/workspaces/${workspaceId}/connections/${primaryConnection.id}/transcripts`
    : null;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <section className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">Workspace Dashboard</h1>
          <p className="text-sm text-slate-600">
            {membership.workspace.name} ({membership.workspace.id})
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href={leadsHref}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
          >
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Leads</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Go to Leads</h2>
            <p className="mt-2 text-sm text-slate-600">
              View and manage leads captured for this workspace.
            </p>
          </Link>

          {transcriptsHref ? (
            <Link
              href={transcriptsHref}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
            >
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                Transcripts
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Go to Transcripts</h2>
              <p className="mt-2 text-sm text-slate-600">
                Open transcripts for connection: {primaryConnection.name}.
              </p>
            </Link>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5">
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                Transcripts
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                No Active Connection Yet
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                The transcripts route exists, but this workspace has no active Voiceflow
                connection to build a valid transcripts URL.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
