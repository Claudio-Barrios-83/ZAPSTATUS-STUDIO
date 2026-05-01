import { createWriteStream } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { finished } from "node:stream/promises";
import archiver from "archiver";
import { createClient } from "@supabase/supabase-js";
import { buildVideoFilter } from "./ffmpegArgs.js";
import { downloadToFile, headObject, uploadFile } from "./s3.js";
import { logger } from "./logger.js";

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function ffmpegBin() {
  return process.env.FFMPEG_PATH ?? "ffmpeg";
}

async function runFfmpeg(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpegBin(), args, { stdio: ["ignore", "pipe", "pipe"] });
    let errBuf = "";
    p.stderr?.on("data", (c: Buffer) => {
      errBuf += c.toString();
    });
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg salió ${code}: ${errBuf.slice(-2000)}`));
    });
  });
}

export async function processVideoJob(jobId: string) {
  const log = logger.child({ jobId });
  const supabase = adminSupabase();

  const { data: row, error: qErr } = await supabase
    .from("video_jobs")
    .select("id,user_id,status,plan,input_object_key,output_prefix")
    .eq("id", jobId)
    .maybeSingle();

  if (qErr) throw qErr;
  if (!row) {
    log.warn("job no encontrado");
    return;
  }
  if (row.status !== "queued") {
    log.info({ status: row.status }, "saltar job no encolado");
    return;
  }

  await supabase.from("video_jobs").update({ status: "processing" }).eq("id", jobId);

  const workDir = join(tmpdir(), `zapstatus-${jobId}`);
  const inputPath = join(workDir, "input.bin");
  const segmentsDir = join(workDir, "segments");

  try {
    await mkdir(workDir, { recursive: true });
    await mkdir(segmentsDir, { recursive: true });
    await headObject(row.input_object_key);
    log.info({ key: row.input_object_key }, "descargando entrada");
    await downloadToFile(row.input_object_key, inputPath);

    const plan = row.plan === "paid" ? "paid" : "free";
    const wm = process.env.WATERMARK_TEXT ?? "ZapStatus";
    const vf = buildVideoFilter(plan, wm);
    const pattern = join(segmentsDir, "clip_%03d.mp4");

    const args = [
      "-y",
      "-i",
      inputPath,
      "-vf",
      vf,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "-f",
      "segment",
      "-segment_time",
      "30",
      "-reset_timestamps",
      "1",
      pattern,
    ];

    log.info("ejecutando ffmpeg");
    await runFfmpeg(args);

    const files = (await readdir(segmentsDir)).filter((f) => f.endsWith(".mp4")).sort();
    if (files.length === 0) throw new Error("ffmpeg no generó segmentos");

    const clipKeys: string[] = [];
    for (const f of files) {
      const local = join(segmentsDir, f);
      const key = `${row.output_prefix}${f}`;
      await uploadFile(key, local, "video/mp4");
      clipKeys.push(key);
      log.info({ key }, "clip subido");
    }

    const zipPath = join(workDir, "clips.zip");
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("warning", (e) => log.warn({ err: e }, "archiver warning"));
    archive.pipe(output);
    for (const f of files) {
      archive.file(join(segmentsDir, f), { name: f });
    }
    await archive.finalize();
    await finished(output);

    const zipKey = `${row.output_prefix}clips.zip`;
    await uploadFile(zipKey, zipPath, "application/zip");
    log.info({ zipKey }, "zip subido");

    const manifest = { clips: clipKeys, zip: zipKey, segmentSeconds: 30, aspect: "9:16" };
    const { error: finErr } = await supabase
      .from("video_jobs")
      .update({ status: "completed", output_manifest: manifest, error_message: null })
      .eq("id", jobId);
    if (finErr) throw finErr;
    log.info("job completado");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error({ err: e }, "job fallido");
    await supabase
      .from("video_jobs")
      .update({ status: "failed", error_message: msg })
      .eq("id", jobId);
    throw e;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
