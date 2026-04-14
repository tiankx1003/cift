import * as Minio from 'minio';
import { config } from '../config.js';

const [host, portStr] = config.minioEndpoint.split(':');
const port = parseInt(portStr || '9000', 10);

const client = new Minio.Client({
  endPoint: host,
  port,
  accessKey: config.minioAccessKey,
  secretKey: config.minioSecretKey,
  useSSL: config.minioSecure,
});

export async function ensureBucket() {
  const exists = await client.bucketExists(config.minioBucket);
  if (!exists) {
    await client.makeBucket(config.minioBucket);
  }
}

export async function uploadFile(storageKey: string, data: Buffer, contentType: string): Promise<void> {
  await client.putObject(config.minioBucket, storageKey, data, data.length, {
    'Content-Type': contentType,
  });
}
