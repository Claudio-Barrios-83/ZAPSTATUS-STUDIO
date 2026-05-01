import { Queue } from "bullmq";
import { Redis } from "ioredis";

const QUEUE_NAME = "video-process";

let connection: Redis | null = null;
let queue: Queue | null = null;

function getRedis() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("Falta REDIS_URL");
  if (!connection) {
    connection = new Redis(url, { maxRetriesPerRequest: null });
  }
  return connection;
}

export function getVideoQueue() {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: getRedis() });
  }
  return queue;
}

export { QUEUE_NAME };
