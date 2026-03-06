"use client";

import { FormEvent, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

type LoginFormState = {
  isSubmitting: boolean;
  error: string | null;
};

function normalizeCallbackPath(input: string | null): string {
  if (!input || !input.startsWith("/")) {
    return "/dashboard";
  }

  return input;
}

function resolveRedirectPath(resultUrl: string | null, fallbackPath: string): string {
  if (!resultUrl) {
    return fallbackPath;
  }

  try {
    const parsed = new URL(resultUrl, window.location.origin);

    if (parsed.origin !== window.location.origin) {
      return fallbackPath;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallbackPath;
  }
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackPath = useMemo(
    () => normalizeCallbackPath(searchParams.get("callbackUrl")),
    [searchParams]
  );

  const [state, setState] = useState<LoginFormState>({
    isSubmitting: false,
    error: null,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!username || !password) {
      setState({
        isSubmitting: false,
        error: "Enter both username and password.",
      });
      return;
    }

    setState({
      isSubmitting: true,
      error: null,
    });

    const result = await signIn("credentials", {
      username,
      password,
      callbackUrl: callbackPath,
      redirect: false,
    });

    if (!result || result.error) {
      setState({
        isSubmitting: false,
        error: "Invalid username or password.",
      });
      return;
    }

    const destination = resolveRedirectPath(result.url, callbackPath);
    window.location.assign(destination);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="username" className="block text-sm font-medium text-slate-800">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          disabled={state.isSubmitting}
          required
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium text-slate-800">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          disabled={state.isSubmitting}
          required
        />
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <button
        type="submit"
        className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={state.isSubmitting}
      >
        {state.isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
