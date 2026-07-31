import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

const LOGO_SAFE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export async function uploadLogo(file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!LOGO_SAFE_EXTS.has(ext)) {
    throw new Error('Invalid file extension');
  }
  await fs.mkdir(config.upload.logoDir, { recursive: true });
  const filename = `company_${uuidv4().replace(/-/g, '').slice(0, 8)}${ext}`;
  const dest = path.join(config.upload.logoDir, filename);
  await fs.writeFile(dest, file.buffer);
  return `/uploads/company-logos/${filename}`;
}

export async function uploadFile(file: Express.Multer.File): Promise<string> {
  await fs.mkdir(config.upload.dir, { recursive: true });
  const ext = path.extname(file.originalname).toLowerCase();
  const filename = `${uuidv4()}${ext}`;
  const dest = path.join(config.upload.dir, filename);
  await fs.writeFile(dest, file.buffer);
  return `/uploads/${filename}`;
}

export async function deleteUploadedFile(relativePath: string): Promise<void> {
  try {
    let fullPath: string;
    if (relativePath.startsWith('/uploads/company-logos/')) {
      const filename = path.basename(relativePath);
      fullPath = path.join(config.upload.logoDir, filename);
    } else if (relativePath.startsWith('/uploads/')) {
      const filename = path.basename(relativePath);
      fullPath = path.join(config.upload.dir, filename);
    } else {
      // legacy /api/v1/documents/:filename path
      const filename = relativePath.split('/').pop();
      if (!filename) return;
      fullPath = path.join(config.upload.dir, filename);
    }
    await fs.unlink(fullPath);
  } catch {
    // file already gone — not an error
  }
}
