/**
 * Keyword-based hadith topic tagging.
 * Matches english_text against per-topic regex patterns.
 * Uses ON CONFLICT DO NOTHING — existing groq-tagged rows are preserved.
 * tagged_by = 'keyword' so rows can be distinguished from AI-tagged rows.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const buf = readFileSync(join(process.cwd(), '.env.local'));
  const raw = buf[0]===0xff&&buf[1]===0xfe ? buf.slice(2).toString('utf16le') : buf.toString('utf-8');
  for (const line of raw.split(/\r\n|\n/)) {
    const t = line.replace(/^﻿/,'').trim();
    if (!t||t.startsWith('#')) continue;
    const eq = t.indexOf('='); if (eq===-1) continue;
    const k=t.slice(0,eq).trim(), v=t.slice(eq+1).trim().replace(/^["']|["']$/g,'');
    if (!process.env[k]) process.env[k]=v;
  }
} catch {}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth:{persistSession:false}});

// ─── keyword patterns (case-insensitive, applied to english_text) ──────────
const TOPIC_PATTERNS: Record<string, RegExp> = {
  prayer:     /\b(pray|prayer|prayers|salah|salat|wudu|ablution|prostrat|mosque|imam|adhan|iqamah|tashahud|qibla|rakah|rakʼah)\b/i,
  fasting:    /\b(fast|fasting|fasted|sawm|siyam|ramadan|iftar|suhoor|suhur)\b/i,
  charity:    /\b(zakat|zakah|sadaqah|sadaqa|alms|charity|poor|needy|destitute|orphan|give.*wealth|spend.*cause)\b/i,
  family:     /\b(family|families|children|child|son|daughter|sibling|sister|brother|relative|kinship|kin|spouse|womb)\b/i,
  patience:   /\b(patient|patience|persever|endur|bear|tribulation|hardship|afflict|trial|calamity|steadfast)\b/i,
  gratitude:  /\b(gratitud|grateful|thankful|thank.*allah|praise.*allah|alhamdulillah|shukr|bless)\b/i,
  forgiveness:/\b(forgiv|pardon|absolv|overlook.*sin|wipe.*sin|erase.*sin|mercy.*allah|maghfirah|mukhlis)\b/i,
  death:      /\b(death|die|dying|dead|grave|funeral|burial|resurrect|afterlife|akhirah|hereafter|angel.*death|shroud|barzakh)\b/i,
  jannah:     /\b(paradise|jannah|heaven|garden.*paradise|houris|hoor|rivers.*paradise|enter.*paradise|gates.*paradise)\b/i,
  business:   /\b(trade|business|merchant|market|sell|buy|purchase|transact|profit|debt|loan|interest|riba|contract|gold|silver|price)\b/i,
  knowledge:  /\b(knowledge|learn|scholar|teach|student|seek.*knowledge|wisdom|understand|ignoranc|intellect|wise|science)\b/i,
  marriage:   /\b(marr|marriage|married|spouse|husband|wife|wedding|nikah|divorce|mehr|mahr|dowry|wali|walima)\b/i,
  parents:    /\b(parent|parents|mother|father|mom|dad|womb|breastfeed|birr.*walidayn|obey.*parent|honour.*parent)\b/i,
  honesty:    /\b(honest|honesty|truth|truthful|sincere|sincerity|lie|lying|deceit|deceiv|fraud|trust|amanah|sidq)\b/i,
  kindness:   /\b(kind|kindness|mercy|merciful|gentle|gentleness|compassion|soft|tender|care.*others|rahma)\b/i,
  anger:      /\b(anger|angry|rage|temper|wrath|irate|furious|don.*angry|control.*anger|swallow.*anger)\b/i,
  dua:        /\b(supplication|dua|du'a|invocation|call.*upon.*allah|ask.*allah|dhikr|remembrance.*allah|tasbeeh|tahmid)\b/i,
  tawakkul:   /\b(trust.*allah|reliance.*allah|tawakkul|rely.*allah|depend.*allah|allah.*suffice|put.*trust|hasbunallah)\b/i,
  repentance: /\b(repent|tawbah|tawba|turn.*allah|seek.*forgiv|istighfar|atonement|atone|return.*allah|forgiv.*sin)\b/i,
  quran:      /\b(quran|qur'an|qur`an|quránic|recit|verse|surah|chapter|ayah|tilawah|memoriz.*quran|hafiz|recitation)\b/i,
};

const TOPIC_KEYS = Object.keys(TOPIC_PATTERNS);

function assignTopics(englishText: string): string[] {
  if (!englishText) return [];
  return TOPIC_KEYS.filter(k => TOPIC_PATTERNS[k].test(englishText));
}

interface Hadith {
  collection_key: string;
  hadith_number: number;
  english_text: string;
}

async function main() {
  console.log('=== TASK 3 — Keyword Topic Tagging ===\n');
  console.log(`Topics (${TOPIC_KEYS.length}): ${TOPIC_KEYS.join(', ')}`);
  console.log('Method: regex keyword matching on english_text');
  console.log('Conflict: ON CONFLICT DO NOTHING on (collection_key, hadith_number, topic_key)\n');

  // Fetch ALL hadiths in pages
  const PAGE = 1000;
  const all: Hadith[] = [];
  let offset = 0;
  process.stdout.write('Loading hadiths from DB');
  while (true) {
    const { data, error } = await sb
      .from('library_hadiths')
      .select('collection_key, hadith_number, english_text')
      .not('english_text', 'is', null)
      .neq('english_text', '')
      .range(offset, offset + PAGE - 1);
    if (error) { console.error('\nDB error:', error.message); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    offset += data.length;
    process.stdout.write('.');
    if (data.length < PAGE) break;
  }
  console.log(` ${all.length} hadiths loaded.\n`);

  // Build all topic rows in memory
  const rows: Array<{collection_key:string; hadith_number:number; topic_key:string; confidence_score:number; tagged_by:string}> = [];
  let untagged = 0;

  for (const h of all) {
    const topics = assignTopics(h.english_text);
    if (topics.length === 0) { untagged++; continue; }
    for (const t of topics) {
      rows.push({
        collection_key:   h.collection_key,
        hadith_number:    h.hadith_number,
        topic_key:        t,
        confidence_score: 1.0,
        tagged_by:        'keyword',
      });
    }
  }

  const matched = all.length - untagged;
  console.log(`Keyword matches: ${matched} hadiths matched, ${untagged} no match.`);
  console.log(`Topic rows to insert: ${rows.length}\n`);

  // Upsert in batches
  const CHUNK = 500;
  let inserted = 0, skipped = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error, count } = await sb
      .from('library_hadith_topics')
      .upsert(batch, { onConflict: 'collection_key,hadith_number,topic_key', ignoreDuplicates: true, count: 'exact' });

    if (error) { console.error(`  [error] chunk ${i}: ${error.message}`); }
    else {
      const got = count ?? 0;
      inserted += got;
      skipped  += batch.length - got;
    }

    if ((i + CHUNK) % 5000 === 0 || i + CHUNK >= rows.length) {
      console.log(`  [${Math.min(i+CHUNK, rows.length)}/${rows.length}] inserted: ${inserted}, skipped: ${skipped}`);
    }
  }

  // Final count
  const { count: total } = await sb.from('library_hadith_topics').select('*',{count:'exact',head:true});
  console.log(`\nResult: ${inserted} new topic rows inserted, ${skipped} already existed.`);
  console.log(`Total library_hadith_topics rows: ${total}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
