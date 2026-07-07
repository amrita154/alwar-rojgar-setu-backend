import { config } from '../../config';
import type { TranslationProvider } from './types';

/**
 * ⚠️  Uses Google Translate's undocumented widget endpoint — violates ToS.
 * For production, swap TRANSLATION_PROVIDER to Bhashini / LibreTranslate / Google Cloud Translation.
 */

interface GoogleTranslateResponse {
  0: string[];
  1: unknown;
}

export const googleFreeProvider: TranslationProvider = {
  name: 'google_free',

  async translate(texts: string[], target: string, source = 'auto'): Promise<string[]> {
    if (texts.length === 0) return [];

    const body = JSON.stringify([[texts, source, target], 'wt_lib']);

    let response: Response;
    try {
      response = await fetch(config.translation.google.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json+protobuf',
          'X-Goog-API-Key': config.translation.google.apiKey,
        },
        body,
      });
    } catch (err) {
      const e = new Error('Translation upstream unreachable') as Error & { status?: number };
      e.status = 502;
      console.error('[translation] upstream fetch failed:', err);
      throw e;
    }

    if (!response.ok) {
      const e = new Error('Translation upstream returned an error') as Error & { status?: number };
      e.status = response.status === 429 ? 429 : 502;
      console.error(`[translation] upstream status ${response.status}`);
      throw e;
    }

    const data = (await response.json()) as GoogleTranslateResponse;
    const translations = Array.isArray(data) ? data[0] : undefined;

    if (!Array.isArray(translations) || translations.length !== texts.length) {
      const e = new Error('Translation upstream returned an unexpected shape') as Error & {
        status?: number;
      };
      e.status = 502;
      throw e;
    }

    return translations.map((t) => (typeof t === 'string' ? t : ''));
  },
};
