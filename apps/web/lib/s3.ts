import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function s3Client() {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? "auto";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Faltan variables S3 (endpoint, access key o secret)");
  }

  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle,
  });
}

export function getBucket() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("Falta S3_BUCKET");
  return bucket;
}

export async function presignPut(key: string, contentType: string) {
  const client = s3Client();
  const bucket = getBucket();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: 3600 });
}

export async function assertBucketReachable() {
  const client = s3Client();
  const bucket = getBucket();
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
}

export { GetObjectCommand, s3Client };
