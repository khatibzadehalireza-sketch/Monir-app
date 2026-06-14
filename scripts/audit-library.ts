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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  // ── 1. library_hadiths by collection ────────────────────────────────────
  const counts: Record<string,number> = {};
  let offset = 0, total = 0;
  process.stderr.write('Scanning library_hadiths');
  while (true) {
    const { data, error } = await supabase
      .from('library_hadiths')
      .select('collection_key')
      .range(offset, offset + 999);
    if (error) { console.error('\nDB error:', error.message); break; }
    if (!data || data.length === 0) break;
    for (const r of data) counts[r.collection_key] = (counts[r.collection_key]||0)+1;
    total += data.length;
    offset += data.length;
    process.stderr.write('.');
    if (data.length < 1000) break;
  }
  process.stderr.write(' '+total+' rows\n');

  // ── 2. Other table totals ────────────────────────────────────────────────
  const otherTables = ['library_hadith_embeddings','library_quran_embeddings','library_hadith_topics'];
  const tableCounts: Record<string,number> = {};
  for (const tbl of otherTables) {
    const { count, error } = await supabase.from(tbl).select('*',{count:'exact',head:true});
    tableCounts[tbl] = error ? -1 : (count??0);
  }

  // ── 3. Print gap analysis ────────────────────────────────────────────────
  const expected: Record<string,number> = {
    bukhari:7563, muslim:7477, abudawud:5274, ibnmajah:4341,
    tirmidhi:3956, nasai:5758, malik:1852, ahmad:27647, nawawi40:42, bulugh:1597,
  };
  const expTotal = Object.values(expected).reduce((a,b)=>a+b,0);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║             Monir Library — Audit Report                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log('── library_hadiths (by collection) ──────────────────────────────\n');
  console.log('  Collection        Present   Expected  Gap       Status');
  console.log('  '+'─'.repeat(58));

  const keys = [...new Set([...Object.keys(counts),...Object.keys(expected)])].sort();
  for (const k of keys) {
    const p = counts[k]||0;
    const e = expected[k]||0;
    const gap = e - p;
    const gapStr = gap===0 ? '0' : gap>0 ? '-'+gap : '+'+Math.abs(gap);
    const status = p===0 ? '❌ MISSING' : gap>0 ? '⚠  INCOMPLETE' : gap<0 ? '⚠  EXTRA' : '✓  OK';
    console.log('  '+k.padEnd(18)+String(p).padEnd(10)+String(e).padEnd(10)+gapStr.padEnd(10)+status);
  }
  console.log('  '+'─'.repeat(58));
  const totalGap = expTotal - total;
  const totalGapStr = totalGap===0 ? '0' : totalGap>0 ? '-'+totalGap : '+'+Math.abs(totalGap);
  console.log('  TOTAL             '+String(total).padEnd(10)+String(expTotal).padEnd(10)+totalGapStr);

  console.log('\n── Other library tables ─────────────────────────────────────────\n');
  const otherExpected: Record<string,[number,string]> = {
    library_hadith_embeddings: [total, 'should match library_hadiths total'],
    library_quran_embeddings:  [6236,  'should cover all Quran verses'],
    library_hadith_topics:     [total, 'should cover all hadiths'],
  };
  console.log('  Table                          Present   Expected  Status');
  console.log('  '+'─'.repeat(62));
  for (const tbl of otherTables) {
    const p = tableCounts[tbl];
    const [e, note] = otherExpected[tbl];
    const status = p<0 ? '❌ ERROR' : p===0 ? '❌ EMPTY' : p<e ? '⚠  INCOMPLETE ('+note+')' : '✓  OK';
    console.log('  '+tbl.padEnd(32)+String(p<0?'ERR':p).padEnd(10)+String(e).padEnd(10)+status);
  }
  console.log('');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
