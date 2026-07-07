import { createHash } from 'crypto';
import { pool } from '../../config/database';

function hashText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export async function getCached(texts: string[], target: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (texts.length === 0) return result;

  const hashes = texts.map(hashText);
  const { rows } = await pool.query<{ source_hash: string; translated_text: string }>(
    `SELECT source_hash, translated_text
       FROM translation_cache
      WHERE target_lang = $1 AND source_hash = ANY($2::text[])`,
    [target, hashes],
  );

  const byHash = new Map(rows.map((r) => [r.source_hash, r.translated_text]));
  texts.forEach((text, i) => {
    const hit = byHash.get(hashes[i]);
    if (hit !== undefined) result.set(text, hit);
  });
  return result;
}

export async function setCached(
  entries: { source: string; translated: string }[],
  target: string,
): Promise<void> {
  if (entries.length === 0) return;

  const values: string[] = [];
  const params: unknown[] = [];
  entries.forEach(({ source, translated }, i) => {
    const base = i * 3;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
    params.push(hashText(source), target, translated);
  });

  await pool.query(
    `INSERT INTO translation_cache (source_hash, target_lang, translated_text)
     VALUES ${values.join(', ')}
     ON CONFLICT (source_hash, target_lang) DO NOTHING`,
    params,
  );
}
