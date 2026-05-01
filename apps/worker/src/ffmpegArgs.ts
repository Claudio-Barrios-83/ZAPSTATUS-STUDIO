/**
 * Filtro de video 9:16 (1080x1920) y segmentos de 30s.
 * Plan free: drawtext como marca de agua (FFmpeg debe tener fuente por defecto).
 */
export function buildVideoFilter(plan: "free" | "paid", watermarkText: string): string {
  const base =
    "scale=1080:1920:force_original_aspect_ratio=decrease," +
    "pad=1080:1920:(ow-iw)/2:(oh-ih)/2";

  if (plan === "paid") return base;

  const escaped = watermarkText.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
  const wm = `drawtext=text='${escaped}':fontcolor=white@0.55:fontsize=42:x=w-text_w-24:y=h-text_h-32`;
  return `${base},${wm}`;
}
