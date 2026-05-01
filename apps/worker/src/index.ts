import { config as loadEnv } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
loadEnv({ path: join(root, ".env") });
loadEnv({ path: join(root, ".env.local") });
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { logger } from "./logger.js";
import { processVideoJob } from "./processor.js";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  logger.fatal("Falta REDIS_URL");
  process.exit(1);
}

const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY ?? 1));

const worker = new Worker(
  "video-process",
  async (job) => {
    const jobId = job.data?.jobId as string | undefined;
    if (!jobId) throw new Error("jobId ausente en payload");
    await processVideoJob(jobId);
  },
  { connection, concurrency },
);

worker.on("completed", (job) => {
  logger.info({ bullJobId: job.id }, "trabajo de cola completado");
});

worker.on("failed", (job, err) => {
  logger.error({ bullJobId: job?.id, err }, "trabajo de cola fallido");
});

logger.info({ concurrency }, "worker iniciado (cola video-process)");
