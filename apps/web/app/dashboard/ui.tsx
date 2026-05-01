"use client";

import { useCallback, useMemo, useState } from "react";

type JobRow = {
  id: string;
  status: string;
  plan: string;
  created_at: string;
  error_message: string | null;
};

export function DashboardClient({
  userId,
  initialJobs,
}: {
  userId: string;
  initialJobs: JobRow[];
}) {
  const [jobs, setJobs] = useState<JobRow[]>(initialJobs);
  const [plan, setPlan] = useState<"free" | "paid">("free");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/jobs", { cache: "no-store" });
    if (!r.ok) return;
    const j = (await r.json()) as { jobs: JobRow[] };
    setJobs(j.jobs);
  }, []);

  const onCreate = useMemo(
    () => async () => {
      setErr(null);
      setLog(null);
      if (!file) {
        setErr("Selecciona un archivo de video.");
        return;
      }
      setBusy(true);
      try {
        const create = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, filename: file.name }),
        });
        if (!create.ok) {
          const t = await create.text();
          throw new Error(t || "No se pudo crear el trabajo");
        }
        const { jobId, uploadUrl, inputObjectKey } = (await create.json()) as {
          jobId: string;
          uploadUrl: string;
          inputObjectKey: string;
        };

        const put = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "video/mp4" },
          body: file,
        });
        if (!put.ok) throw new Error("Falló la subida al almacenamiento (S3/R2).");

        const q = await fetch(`/api/jobs/${jobId}/queue`, { method: "POST" });
        if (!q.ok) {
          const t = await q.text();
          throw new Error(t || "No se pudo encolar el procesamiento");
        }

        setLog(`Trabajo ${jobId} encolado (${inputObjectKey}).`);
        setFile(null);
        await refresh();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Error");
      } finally {
        setBusy(false);
      }
    },
    [file, plan, refresh],
  );

  return (
    <>
      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Nuevo clip batch</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Usuario: <code>{userId}</code>
        </p>
        <label htmlFor="plan">Plan</label>
        <select
          id="plan"
          value={plan}
          onChange={(e) => setPlan(e.target.value as "free" | "paid")}
          style={{
            width: "100%",
            padding: "0.6rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "#0e141c",
            color: "var(--fg)",
          }}
        >
          <option value="free">Free (marca de agua)</option>
          <option value="paid">Paid (sin marca de agua)</option>
        </select>
        <label htmlFor="file" style={{ marginTop: "0.75rem" }}>
          Video
        </label>
        <input
          id="file"
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="row">
          <button type="button" onClick={() => void onCreate()} disabled={busy}>
            {busy ? "Procesando…" : "Subir y encolar"}
          </button>
          <button type="button" onClick={() => void refresh()} disabled={busy}>
            Actualizar lista
          </button>
        </div>
        {log && <p className="muted" style={{ marginTop: "0.75rem" }}>{log}</p>}
        {err && <p className="err">{err}</p>}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Trabajos recientes</h2>
        {jobs.length === 0 ? (
          <p className="muted">Aún no hay trabajos.</p>
        ) : (
          <ul style={{ paddingLeft: "1.1rem", margin: 0 }}>
            {jobs.map((j) => (
              <li key={j.id} style={{ marginBottom: "0.5rem" }}>
                <code>{j.id}</code> — {j.status} — {j.plan}
                <span className="muted" style={{ marginLeft: 8 }}>
                  {new Date(j.created_at).toLocaleString()}
                </span>
                {j.error_message && (
                  <div className="err" style={{ marginTop: 4 }}>
                    {j.error_message}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
