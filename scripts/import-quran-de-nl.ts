import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const buf = readFileSync(join(process.cwd(), '.env.local'));
  const raw =
    buf[0] === 0xff && buf[1] === 0xfe
      ? buf.slice(2).toString('utf16le')
      : buf.toString('utf-8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.replace(/^﻿/, '').trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const ALQURAN_BASE = 'https://api.alquran.cloud/v1';
const BATCH_SIZE = 500;

const EDITIONS = [
  {
    identifier: 'de.bubenheim',
    language: 'de',
    translator: 'Bubenheim and Elyas',
    // German already has rows (Abu Rida) — replace with this translation
    ignoreDuplicates: false,
  },
  {
    identifier: 'nl.siregar',
    language: 'nl',
    translator: 'Siregar',
    // Dutch has no existing rows — ON CONFLICT DO NOTHING
    ignoreDuplicates: true,
  },
] as const;

interface Ayah { numberInSurah: number; text: string; }
interface Surah { number: number; ayahs: Ayah[]; }
interface AlQuranResponse { code: number; data: { surahs: Surah[] }; }

interface TranslationRow {
  surah_number: number;
  verse_number: number;
  language: string;
  translated_text: string;
  translated_by: string;
  is_verified: boolean;
}

async function importEdition(ed: (typeof EDITIONS)[number]): Promise<void> {
  const url = `${ALQURAN_BASE}/quran/${ed.identifier}`;
  console.log(`  Fetching ${url} ...`);

  let data: AlQuranResponse;
  try {
    const res = await fetch(url);
    if (!res.ok) { console.error(`  [error] HTTP ${res.status}`); return; }
    data = await res.json() as AlQuranResponse;
  } catch (err) {
    console.error(`  [error] fetch: ${(err as Error).message}`);
    return;
  }

  if (data.code !== 200 || !data.data?.surahs?.length) {
    console.error(`  [error] unexpected response (code=${data.code})`);
    return;
  }

  const rows: TranslationRow[] = [];
  for (const surah of data.data.surahs) {
    for (const ayah of surah.ayahs) {
      const text = ayah.text?.trim();
      if (!text) continue;
      rows.push({
        surah_number: surah.number,
        verse_number: ayah.numberInSurah,
        language: ed.language,
        translated_text: text,
        translated_by: ed.translator,
        is_verified: true,
      });
    }
  }

  const action = ed.ignoreDuplicates ? 'ON CONFLICT DO NOTHING' : 'REPLACE existing rows';
  console.log(`  ${rows.length} verses — batches of ${BATCH_SIZE} (${action})...`);

  let totalDone = 0, totalErrors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error, count } = await supabase
      .from('library_quran_translations')
      .upsert(batch, {
        onConflict: 'surah_number,verse_number,language',
        ignoreDuplicates: ed.ignoreDuplicates,
        count: 'exact',
      });

    if (error) {
      console.error(`  [error] batch ${i}–${i + batch.length}: ${error.message}`);
      totalErrors += batch.length;
    } else {
      totalDone += count ?? batch.length;
      console.log(`  ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} rows done`);
    }
  }

  console.log(`  [${ed.identifier}] Complete — rows affected: ${totalDone}${totalErrors ? `, errors: ${totalErrors}` : ''}`);
}

async function main() {
  console.log('=== Quran Translations: German (de.bubenheim) + Dutch (nl.siregar) — alquran.cloud ===\n');
  for (let i = 0; i < EDITIONS.length; i++) {
    const ed = EDITIONS[i];
    console.log('='.repeat(60));
    console.log(`[${i + 1}/${EDITIONS.length}] ${ed.identifier} (${ed.language}) — ${ed.translator}`);
    await importEdition(ed);
    console.log();
  }
  console.log('All done.');
}

main().catch((err) => { console.error('Fatal:', err.message); process.exit(1); });
