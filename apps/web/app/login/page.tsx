"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Revisa tu correo para confirmar la cuenta (si el proyecto lo requiere).");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/dashboard";
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error de autenticación");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem" }}>Acceso</h1>
      <p className="muted">
        Email y contraseña (activa Email provider en Supabase).{" "}
        <Link href="/">Volver</Link>
      </p>
      <div className="card">
        <div className="row" style={{ marginTop: 0 }}>
          <button type="button" disabled={mode === "signin"} onClick={() => setMode("signin")}>
            Iniciar sesión
          </button>
          <button type="button" disabled={mode === "signup"} onClick={() => setMode("signup")}>
            Registrarse
          </button>
        </div>
        <form onSubmit={submit} style={{ marginTop: "1rem" }}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="password" style={{ marginTop: "0.75rem" }}>
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <div className="row">
            <button type="submit" disabled={loading}>
              {loading ? "Enviando…" : mode === "signup" ? "Crear cuenta" : "Entrar"}
            </button>
          </div>
        </form>
        {msg && <p className="muted" style={{ marginTop: "0.75rem" }}>{msg}</p>}
        {err && <p className="err">{err}</p>}
      </div>
    </div>
  );
}
