import path from 'path';
import multer from 'multer';
import { config } from '../config';

const LOGO_ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const LOGO_ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const DOC_ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const DOC_ALLOWED_EXTS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx']);

const logoFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!LOGO_ALLOWED_MIMES.has(file.mimetype) || !LOGO_ALLOWED_EXTS.has(ext)) {
    cb(new Error('Invalid file type. Logo must be JPEG, PNG, or WEBP'));
    return;
  }
  cb(null, true);
};

const docFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!DOC_ALLOWED_MIMES.has(file.mimetype) || !DOC_ALLOWED_EXTS.has(ext)) {
    cb(new Error('Invalid file type. Allowed: PDF, JPEG, PNG, WEBP, DOC, DOCX'));
    return;
  }
  cb(null, true);
};

const sizeLimit = { fileSize: config.upload.maxFileSizeMB * 1024 * 1024 };

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: docFilter,
  limits: sizeLimit,
});

export const uploadLogoMulter = multer({
  storage: multer.memoryStorage(),
  fileFilter: logoFilter,
  limits: sizeLimit,
});
