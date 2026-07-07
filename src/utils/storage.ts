import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

async function uploadToVercel(file: Express.Multer.File): Promise<string> {
  const { put } = await import('@vercel/blob');
  const ext = path.extname(file.originalname);
  const filename = `${uuidv4()}${ext}`;
  const { url } = await put(filename, file.buffer, {
    access: 'public',
    contentType: file.mimetype,
  });
  return url;
}

async function uploadToLocal(file: Express.Multer.File): Promise<string> {
  await fs.mkdir(config.upload.dir, { recursive: true });
  const ext = path.extname(file.originalname);
  const filename = `${uuidv4()}${ext}`;
  const dest = path.join(config.upload.dir, filename);
  await fs.writeFile(dest, file.buffer);
  return `/api/v1/documents/${filename}`;
}

export async function uploadFile(file: Express.Multer.File): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return uploadToVercel(file);
  }
  return uploadToLocal(file);
}
