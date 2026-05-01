import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getVideoQueue } from "@/lib/queue";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: job, error } = await supabase
    .from("video_jobs")
    .select("id,status,user_id")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!job || job.user_id !== user.id) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (job.status !== "pending_upload") {
    return NextResponse.json({ error: "Estado no válido para encolar" }, { status: 409 });
  }

  const admin = createAdminClient();
  const { error: upErr } = await admin
    .from("video_jobs")
    .update({ status: "queued" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  try {
    const q = getVideoQueue();
    await q.add("process", { jobId: id }, { jobId: id, removeOnComplete: true });
  } catch (e: unknown) {
    await admin.from("video_jobs").update({ status: "failed", error_message: "Redis no disponible" }).eq("id", id);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al encolar" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
