import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import { LoginForm } from "@/app/login/LoginForm";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">CRM Login</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in with your username and password.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
