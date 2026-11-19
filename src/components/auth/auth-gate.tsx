"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";

type MeResponse = {
  authenticated: boolean;
  user?: { id: string; email: string; displayName: string };
  workspace?: { id: string; name: string; slug: string };
};

type Mode = "login" | "register";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20";

const buttonClass =
  "w-full rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50";

export function AuthGate({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (response.ok) {
        setMe((await response.json()) as MeResponse);
      } else {
        setMe({ authenticated: false });
      }
    } catch {
      setMe({ authenticated: false });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data: MeResponse = response.ok
          ? ((await response.json()) as MeResponse)
          : { authenticated: false };
        if (!cancelled) setMe(data);
      } catch {
        if (!cancelled) setMe({ authenticated: false });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register"
            ? { email, password, displayName: displayName || undefined }
            : { email, password },
        ),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Permintaan gagal");
        return;
      }
      await refresh();
    } catch {
      setError("Tidak dapat menghubungi server");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe({ authenticated: false });
  };

  if (me === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
        <div className="w-full max-w-sm animate-pulse space-y-4">
          <div className="h-8 w-2/3 rounded bg-white/10" />
          <div className="h-11 rounded bg-white/5" />
          <div className="h-11 rounded bg-white/5" />
          <div className="h-11 rounded bg-white/5" />
        </div>
      </main>
    );
  }

  if (!me.authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-400">
              Remotion AI Video Studio
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-zinc-100">
              {mode === "login" ? "Masuk ke studio" : "Buat akun studio"}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Project, aset, dan hasil render tersimpan di akun Anda.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "register" ? (
              <label className="block">
                <span className="mb-1.5 block text-xs text-zinc-400">Nama tampilan</span>
                <input
                  className={inputClass}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Nama Anda"
                  autoComplete="name"
                />
              </label>
            ) : null}
            <label className="block">
              <span className="mb-1.5 block text-xs text-zinc-400">Email</span>
              <input
                className={inputClass}
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@contoh.com"
                autoComplete="email"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-zinc-400">Kata sandi</span>
              <input
                className={inputClass}
                type="password"
                required
                minLength={mode === "register" ? 8 : 1}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </label>

            {error ? (
              <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            ) : null}

            <button className={buttonClass} type="submit" disabled={busy}>
              {busy ? "Memproses..." : mode === "login" ? "Masuk" : "Buat akun"}
            </button>
          </form>

          <button
            type="button"
            className="mt-5 w-full text-center text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
          >
            {mode === "login" ? "Belum punya akun? Buat akun" : "Sudah punya akun? Masuk"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="relative">
      <div className="absolute right-4 top-3 z-20 flex items-center gap-3 text-xs text-zinc-400">
        <span className="hidden sm:inline">{me.user?.displayName}</span>
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-md border border-white/10 px-2 py-1 text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
        >
          Keluar
        </button>
      </div>
      {children}
    </div>
  );
}
