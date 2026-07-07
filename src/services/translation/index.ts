import { config } from '../../config';
import { googleFreeProvider } from './googleFree';
import { getCached, setCached } from './cache';
import type { TranslationProvider } from './types';

function resolveProvider(): TranslationProvider {
  switch (config.translation.provider) {
    case 'google_free':
      return googleFreeProvider;
    default:
      throw new Error(`Unknown TRANSLATION_PROVIDER: ${config.translation.provider}`);
  }
}

const provider = resolveProvider();

export async function translateTexts(
  texts: string[],
  target: string,
  source = 'auto',
): Promise<string[]> {
  if (texts.length === 0) return [];

  const cached = await getCached(texts, target);

  const missing: string[] = [];
  const seen = new Set<string>();
  for (const text of texts) {
    const trimmed = text.trim();
    if (trimmed === '' || cached.has(text) || seen.has(text)) continue;
    seen.add(text);
    missing.push(text);
  }

  if (missing.length > 0) {
    const translated = await provider.translate(missing, target, source);
    const toStore: { source: string; translated: string }[] = [];
    missing.forEach((src, i) => {
      const out = translated[i] ?? src;
      cached.set(src, out);
      toStore.push({ source: src, translated: out });
    });
    try {
      await setCached(toStore, target);
    } catch (err) {
      console.error('[translation] cache write failed:', err);
    }
  }

  return texts.map((text) => cached.get(text) ?? text);
}
