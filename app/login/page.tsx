"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

// The judges' pre-seeded account — intentionally public (also in the README).
const DEMO_EMAIL = "judge@hefesto.org";
const DEMO_PASSWORD = "forge-my-network";

function KeyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="4.5" cy="4.5" r="3" stroke="#1C1611" strokeWidth="1.6" />
      <path
        d="M6.8 6.8L11.5 11.5M9.6 9.6L11.2 8M10.8 10.8L12.2 9.4"
        stroke="#1C1611"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
      <path
        d="M1.5 1.5L6.5 7L1.5 12.5"
        stroke="#F6F1E8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (authError) {
      setError(authError.message);
      setPending(false);
      return;
    }

    // Provision the user's memory (idempotent); failures retry on first capture
    await fetch("/api/provision", { method: "POST" }).catch(() => {});

    router.replace("/");
    router.refresh();
  }

  async function handleGoogle() {
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=/` },
    });
    if (authError) setError(authError.message);
  }

  async function handleDemo() {
    if (pending) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    if (authError) {
      setError(authError.message);
      setPending(false);
      return;
    }
    await fetch("/api/provision", { method: "POST" }).catch(() => {});
    router.replace("/");
    router.refresh();
  }

  const heading = mode === "login" ? "Log in" : "Sign up";
  const altLabel = mode === "login" ? "Sign up" : "Log in";

  return (
    <main className="min-h-dvh flex flex-col">
      <div className="w-full max-w-[390px] mx-auto flex flex-col flex-1 px-6">
        <h1 className="font-semibold text-[34px] text-ink pt-[96px] leading-normal">
          Hefesto
        </h1>
        <p className="text-[13px] text-muted leading-normal">Never forget anyone again.</p>

        <section className="glass rounded-[28px] mt-8 p-[22px]">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[22px] text-ink">{heading}</h2>
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
              }}
              className="h-[30px] px-[14px] rounded-full bg-white text-[12px] font-medium text-[#1C1611]"
            >
              {altLabel}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-[23px]">
            <div className="flex flex-col gap-[14px]">
              <label className="h-12 rounded-3xl bg-input border border-(--input-border) flex items-center px-2">
                <span className="size-8 rounded-full bg-white grid place-items-center text-[14px] font-medium text-[#1C1611]">
                  @
                </span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e-mail address"
                  className="flex-1 min-w-0 ml-3 bg-transparent text-[13px] text-ink placeholder:text-muted focus:outline-none"
                />
              </label>

              <label className="h-12 rounded-3xl bg-input border border-(--input-border) flex items-center px-2">
                <span className="size-8 rounded-full bg-white grid place-items-center">
                  <KeyIcon />
                </span>
                <input
                  type="password"
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  className="flex-1 min-w-0 ml-3 bg-transparent text-[13px] text-ink placeholder:text-muted focus:outline-none"
                />
                {mode === "login" && (
                  <span className="h-[30px] px-[14px] rounded-full bg-white text-[12px] font-medium text-[#1C1611] grid place-items-center">
                    forgot
                  </span>
                )}
              </label>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <button
                type="submit"
                disabled={pending}
                className="h-[54px] w-[200px] rounded-full bg-ember text-cream text-[15px] font-medium text-left pl-7 disabled:opacity-70"
              >
                {pending ? "One moment…" : heading}
              </button>
              <button
                type="submit"
                disabled={pending}
                aria-label={heading}
                className="size-[54px] rounded-full bg-ember grid place-items-center disabled:opacity-70"
              >
                <Chevron />
              </button>
            </div>

            {error && <p className="mt-3 text-[12px] text-orange">{error}</p>}
          </form>

          <p className="micro-label mt-7 text-[9px] tracking-[0.9px]">or continue with</p>

          <button
            type="button"
            onClick={handleGoogle}
            className="w-full h-12 rounded-3xl bg-white shadow-[0px_16px_38px_0px_rgba(51,31,10,0.08)] flex items-center px-2.5 mt-[10px]"
          >
            <span className="size-8 rounded-full bg-white ring-1 ring-[rgba(28,22,17,0.08)] grid place-items-center text-[14px] font-semibold text-[#1C1611]">
              G
            </span>
            <span className="ml-[18px] text-[13px] font-medium text-[#1C1611]">
              Continue with Google
            </span>
          </button>

          <button
            type="button"
            onClick={handleDemo}
            disabled={pending}
            className="w-full h-12 rounded-3xl bg-white shadow-[0px_16px_38px_0px_rgba(51,31,10,0.08)] flex items-center px-2.5 mt-[10px] disabled:opacity-70"
          >
            <span className="size-8 rounded-full bg-white ring-1 ring-[rgba(28,22,17,0.08)] grid place-items-center text-[14px]">
              🐱
            </span>
            <span className="ml-[18px] text-[13px] font-medium text-[#1C1611]">
              Try the demo — pre-loaded memory
            </span>
          </button>
        </section>

        <p className="text-center text-[11.5px] text-muted mt-8">
          New here? Create your account in seconds — no email verification.
        </p>

        <p className="mt-auto pb-12 text-center text-[8.5px] font-medium tracking-[0.85px] text-muted uppercase">
          Your memory · Private by design
        </p>
      </div>
    </main>
  );
}
