import { describe, expect, it } from "vitest";
import { buildVideoFilter } from "./ffmpegArgs.js";

describe("buildVideoFilter", () => {
  it("no añade drawtext en paid", () => {
    const f = buildVideoFilter("paid", "X");
    expect(f).not.toContain("drawtext");
    expect(f).toContain("1080:1920");
  });

  it("añade drawtext en free", () => {
    const f = buildVideoFilter("free", "Zap");
    expect(f).toContain("drawtext");
    expect(f).toContain("Zap");
  });

  it("escapa comillas simples en texto", () => {
    const f = buildVideoFilter("free", "a'b");
    expect(f).toContain("\\'");
  });
});
