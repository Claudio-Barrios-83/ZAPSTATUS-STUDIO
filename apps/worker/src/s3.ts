import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

function client() {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? "auto";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Faltan variables S3");
  }
  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle,
  });
}

export function bucket() {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error("Falta S3_BUCKET");
  return b;
}

export async function headObject(key: string) {
  const c = client();
  await c.send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function downloadToFile(key: string, destPath: string) {
  const c = client();
  const out = await c.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  const body = out.Body;
  if (!body) throw new Error("Cuerpo vacío en GetObject");
  if (typeof (body as Readable).pipe !== "function") {
    throw new Error("Stream de objeto no compatible con pipe");
  }
  await pipeline(body as Readable, createWriteStream(destPath));
}

export async function uploadFile(key: string, filePath: string, contentType: string) {
  const c = client();
  await c.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: createReadStream(filePath),
      ContentType: contentType,
    }),
  );
}
