import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { translateTexts } from '../services/translation';

const langCode = z
  .string()
  .trim()
  .regex(/^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?$/, 'Invalid language code');

const translateSchema = z.object({
  texts: z
    .array(z.string().max(5000, 'Individual text too long'))
    .min(1, 'At least one text is required')
    .max(config.translation.maxTextsPerRequest, 'Too many texts in one request'),
  target: langCode,
  source: z.union([langCode, z.literal('auto')]).optional(),
});

export async function translate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = translateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: 'Invalid translation request',
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { texts, target, source } = parsed.data;

    const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
    if (totalChars > config.translation.maxCharsPerRequest) {
      res.status(413).json({ message: 'Translation payload too large' });
      return;
    }

    const translations = await translateTexts(texts, target, source ?? 'auto');
    res.json({ translations });
  } catch (err) {
    next(err);
  }
}
