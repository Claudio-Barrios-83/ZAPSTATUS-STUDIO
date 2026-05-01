import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>ZapStatus Studio</h1>
      <p className="muted">
        Sube un video y obtén clips verticales 9:16 de 30 segundos, comprimidos y listos para
        WhatsApp. Plan free incluye marca de agua.
      </p>
      <div className="card">
        {user ? (
          <>
            <p>
              Sesión: <strong>{user.email ?? user.id}</strong>
            </p>
            <div className="row">
              <Link href="/dashboard">
                <button type="button">Ir al panel</button>
              </Link>
              <form
                action="/auth/signout"
                method="post"
                style={{ display: "inline" }}
              >
                <button type="submit">Cerrar sesión</button>
              </form>
            </div>
          </>
        ) : (
          <>
            <p>Inicia sesión para crear trabajos y subir videos a almacenamiento privado.</p>
            <div className="row">
              <Link href="/login">
                <button type="button">Entrar</button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
