import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import 'dotenv/config';

function getS3Client(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION || 'us-east-2',
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID     || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });
}

function getBucket(): string {
  return process.env.S3_BUCKET || 'bibliotecaaleman';
}

function getRegion(): string {
  return process.env.AWS_REGION || 'us-east-2';
}

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const bucket = getBucket();
  const region = getRegion();

  await getS3Client().send(new PutObjectCommand({
    Bucket:      bucket,
    Key:         key,
    Body:        body,
    ContentType: contentType,
  }));

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export async function deleteObject(key: string): Promise<void> {
  await getS3Client().send(new DeleteObjectCommand({
    Bucket: getBucket(),
    Key:    key,
  }));
}
