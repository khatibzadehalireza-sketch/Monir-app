import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const buf = readFileSync(join(process.cwd(), '.env.local'));
  const raw = buf[0]===0xff&&buf[1]===0xfe ? buf.slice(2).toString('utf16le') : buf.toString('utf-8');
  for (const line of raw.split(/\r\n|\n/)) {
    const t = line.replace(/^﻿/,'').trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq===-1) continue;
    const k = t.slice(0,eq).trim();
    const v = t.slice(eq+1).trim().replace(/^["']|["']$/g,'');
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function count(table: string): Promise<number> {
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
  if (error) { process.stderr.write(`  [ERR] ${table}: ${error.message}\n`); return -1; }
  return count ?? 0;
}

function pad(s: string | number, w: number) { return String(s).padEnd(w); }
function lpad(s: string | number, w: number) { return String(s).padStart(w); }
function hr(char = '─', len = 70) { return char.repeat(len); }

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║           Monir Islamic Library — Complete Audit Report              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  // ── 1. All library_ tables — row counts ─────────────────────────────────────
  const tables = [
    'library_hadiths',
    'library_hadith_embeddings',
    'library_hadith_topics',
    'library_hadith_translations',
    'library_quran_verses',
    'library_quran_embeddings',
    'library_quran_translations',
    'library_tafsir',
    'library_riyad_salihin',
    'library_zakat_rules',
  ];

  process.stderr.write('Counting all library tables...\n');
  const results: Record<string, number> = {};
  await Promise.all(tables.map(async t => { results[t] = await count(t); }));

  console.log('┌─ All library_ tables ──────────────────────────────────────────────┐');
  console.log('│  Table                              Rows                           │');
  console.log('│  ' + hr('─', 66) + '  │');
  for (const t of tables) {
    const n = results[t];
    const rows = n < 0 ? 'ERROR' : n.toLocaleString();
    const flag = n < 0 ? '  ❌' : n === 0 ? '  ⚠ EMPTY' : '';
    console.log('│  ' + pad(t, 36) + lpad(rows, 12) + flag);
  }
  console.log('└' + hr('─', 70) + '┘\n');

  // ── 2. library_hadiths by collection ────────────────────────────────────────
  process.stderr.write('Scanning library_hadiths by collection...\n');
  const collectionCounts: Record<string,number> = {};
  let offset = 0, hadithTotal = 0;
  while (true) {
    const { data, error } = await sb.from('library_hadiths').select('collection_key').range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    for (const r of data) collectionCounts[r.collection_key] = (collectionCounts[r.collection_key]||0)+1;
    hadithTotal += data.length;
    offset += data.length;
    if (data.length < 1000) break;
  }

  const expected: Record<string,number> = {
    bukhari:7563, muslim:7477, abudawud:5274, ibnmajah:4341,
    tirmidhi:3956, nasai:5758, malik:1852, ahmad:27647, nawawi40:42,
    bulugh:1597, riyad_salihin: 1900,
  };

  console.log('┌─ library_hadiths by collection ────────────────────────────────────┐');
  console.log('│  ' + pad('Collection', 18) + pad('Present', 10) + pad('Expected', 10) + pad('Gap', 10) + 'Status');
  console.log('│  ' + hr('─', 62));
  const keys = [...new Set([...Object.keys(collectionCounts), ...Object.keys(expected)])].sort();
  for (const k of keys) {
    const p = collectionCounts[k] || 0;
    const e = expected[k] || 0;
    const gap = e > 0 ? e - p : 0;
    const gapStr = gap === 0 ? '—' : gap > 0 ? '-' + gap : '+' + Math.abs(gap);
    const status = p === 0 ? '❌ MISSING' : gap > 100 ? '⚠  INCOMPLETE' : gap < -10 ? '⚠  EXTRA' : '✓  OK';
    console.log('│  ' + pad(k, 18) + pad(p.toLocaleString(), 10) + pad(e.toLocaleString(), 10) + pad(gapStr, 10) + status);
  }
  console.log('│  ' + hr('─', 62));
  console.log('│  ' + pad('TOTAL', 18) + pad(hadithTotal.toLocaleString(), 10));
  console.log('└' + hr('─', 70) + '┘\n');

  // ── 3. library_tafsir grouped by author_name × language_code ─────────────
  process.stderr.write('Grouping library_tafsir...\n');
  const tafsirRows: { author_name: string; language_code: string }[] = [];
  let tOffset = 0;
  while (true) {
    const { data, error } = await sb
      .from('library_tafsir')
      .select('author_name, language_code')
      .range(tOffset, tOffset + 999);
    if (error || !data || data.length === 0) break;
    tafsirRows.push(...data);
    tOffset += data.length;
    if (data.length < 1000) break;
  }

  // group
  const tafsirMap: Record<string, Record<string, number>> = {};
  for (const r of tafsirRows) {
    const author = r.author_name || '(unknown)';
    const lang = r.language_code || '?';
    tafsirMap[author] = tafsirMap[author] || {};
    tafsirMap[author][lang] = (tafsirMap[author][lang] || 0) + 1;
  }

  // collect all language columns
  const langs = [...new Set(tafsirRows.map(r => r.language_code || '?'))].sort();
  const colW = 10;

  console.log('┌─ library_tafsir by author × language ──────────────────────────────┐');
  const header = '│  ' + pad('Author', 30) + langs.map(l => pad(l, colW)).join('') + pad('Total', colW);
  console.log(header);
  console.log('│  ' + hr('─', 30 + langs.length * colW + colW));

  const authors = Object.keys(tafsirMap).sort();
  const langTotals: Record<string, number> = {};
  for (const author of authors) {
    let rowTotal = 0;
    const cols = langs.map(l => {
      const n = tafsirMap[author][l] || 0;
      langTotals[l] = (langTotals[l] || 0) + n;
      rowTotal += n;
      return pad(n > 0 ? n.toLocaleString() : '—', colW);
    });
    console.log('│  ' + pad(author, 30) + cols.join('') + pad(rowTotal.toLocaleString(), colW));
  }
  console.log('│  ' + hr('─', 30 + langs.length * colW + colW));
  const grandTotal = tafsirRows.length;
  const totalCols = langs.map(l => pad((langTotals[l] || 0).toLocaleString(), colW));
  console.log('│  ' + pad('TOTAL', 30) + totalCols.join('') + pad(grandTotal.toLocaleString(), colW));
  console.log('└' + hr('─', 70) + '┘\n');

  // ── 4. Embedding coverage ────────────────────────────────────────────────────
  const hadithEmbeddings = results['library_hadith_embeddings'];
  const quranVerses = results['library_quran_verses'];
  const quranEmbeddings = results['library_quran_embeddings'];
  const hadithCount = results['library_hadiths'];

  console.log('┌─ Embedding coverage ────────────────────────────────────────────────┐');
  console.log('│  ' + pad('Domain', 28) + pad('Total', 10) + pad('Embedded', 10) + 'Coverage');
  console.log('│  ' + hr('─', 60));

  const hadithCov = hadithCount > 0 ? ((hadithEmbeddings / hadithCount) * 100).toFixed(1) + '%' : '?';
  const quranCov  = quranVerses > 0 ? ((quranEmbeddings  / quranVerses)  * 100).toFixed(1) + '%' : '?';

  console.log('│  ' + pad('Hadiths', 28) + pad(hadithCount.toLocaleString(), 10) + pad(hadithEmbeddings.toLocaleString(), 10) + hadithCov);
  console.log('│  ' + pad('Quran verses', 28) + pad(quranVerses.toLocaleString(), 10) + pad(quranEmbeddings.toLocaleString(), 10) + quranCov);
  console.log('└' + hr('─', 70) + '┘\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
