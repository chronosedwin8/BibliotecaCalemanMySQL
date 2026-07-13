import { S3Client, PutObjectCommand, HeadBucketCommand, GetBucketLocationCommand } from '@aws-sdk/client-s3';
import 'dotenv/config';

const region = process.env.AWS_REGION || 'us-east-1';
const bucket = process.env.S3_BUCKET || 'bibliotecaaleman';

console.log('Bucket:', bucket, '| Region configurada:', region);

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// 1. Verificar región real del bucket
try {
  const loc = await s3.send(new GetBucketLocationCommand({ Bucket: bucket }));
  const realRegion = loc.LocationConstraint || 'us-east-1';
  console.log('✅ Bucket encontrado. Región real:', realRegion);
  if (realRegion !== region) {
    console.log('⚠️  REGIÓN INCORRECTA — cambia AWS_REGION a:', realRegion);
  }
} catch (e: any) {
  console.error('✗ Error verificando bucket:', e.message);
}

// 2. Intentar subir un archivo de prueba (sin ACL)
try {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: 'test/ping.txt',
    Body: Buffer.from('test'),
    ContentType: 'text/plain',
  }));
  console.log('✅ Upload sin ACL: OK');
} catch (e: any) {
  console.error('✗ Upload sin ACL falló:', e.message);
}

// 3. Intentar subir con ACL public-read
try {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: 'test/ping-public.txt',
    Body: Buffer.from('test'),
    ContentType: 'text/plain',
    ACL: 'public-read',
  }));
  console.log('✅ Upload con ACL public-read: OK');
} catch (e: any) {
  console.error('✗ Upload con ACL public-read falló:', e.message);
}

process.exit(0);
