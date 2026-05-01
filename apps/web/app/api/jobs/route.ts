import { createClient } from "@/lib/supabase/server";
import { presignPut } from "@/lib/s3";
import { NextResponse } from "next/server";
import { extname } from "path";

function safeExt(filename: string) {
  const e = extname(filename).toLowerCase();
  if (!e || e.length > 10) return ".mp4";
  return e;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: jobs, error } = await supabase
    .from("video_jobs")
    .select("id,status,plan,created_at,error_message")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: jobs ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: { plan?: string; filename?: string };
  try {
    body = (await req.json()) as { plan?: string; filename?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const plan = body.plan === "paid" ? "paid" : "free";
  const filename = typeof body.filename === "string" ? body.filename : "video.mp4";
  const ext = safeExt(filename);

  const jobId = crypto.randomUUID();
  const inputObjectKey = `raw/${user.id}/${jobId}/source${ext}`;
  const outputPrefix = `out/${user.id}/${jobId}/`;

  const { error } = await supabase.from("video_jobs").insert({
    id: jobId,
    user_id: user.id,
    status: "pending_upload",
    plan,
    input_object_key: inputObjectKey,
    output_prefix: outputPrefix,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const contentType =
    ext === ".mov"
      ? "video/quicktime"
      : ext === ".webm"
        ? "video/webm"
        : "video/mp4";

  let uploadUrl: string;
  try {
    uploadUrl = await presignPut(inputObjectKey, contentType);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al firmar subida" },
      { status: 500 },
    );
  }

  return NextResponse.json({ jobId, uploadUrl, inputObjectKey, outputPrefix });
}
