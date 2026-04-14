import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://cift:cift_dev_123@localhost:5432/cift',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  pythonServiceUrl: (process.env.PYTHON_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, ''),
  minioEndpoint: process.env.MINIO_ENDPOINT || 'localhost:9000',
  minioAccessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  minioSecretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  minioBucket: process.env.MINIO_BUCKET || 'cift-files',
  minioSecure: process.env.MINIO_SECURE === 'true',
};
