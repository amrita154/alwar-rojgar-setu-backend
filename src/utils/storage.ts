import { put } from '@vercel/blob';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function uploadFile(file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname);
  const filename = `${uuidv4()}${ext}`;
  const { url } = await put(filename, file.buffer, {
    access: 'public',
    contentType: file.mimetype,
  });
  return url;
}
