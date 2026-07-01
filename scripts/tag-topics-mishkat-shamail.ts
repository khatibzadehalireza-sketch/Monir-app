/**
 * Keyword topic tagging for Mishkat and Shamail collections only.
 * Uses ON CONFLICT DO NOTHING — never overwrites existing tags.
 * tagged_by = 'keyword'
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

const TOPIC_PATTERNS: Record<string, RegExp> = {
  prayer:     /\b(pray|prayer|prayers|salah|salat|wudu|ablution|prostrat|mosque|imam|adhan|iqamah|tashahud|qibla|rakah|rak[ʼ']ah)\b/i,
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
  quran:      /\b(quran|qur'an|qur`an|qur[aá]nic|recit|verse|surah|chapter|ayah|tilawah|memoriz.*quran|hafiz|recitation)\b/i,
};

const TOPIC_KEYS = Object.keys(TOPIC_PATTERNS);

function assignTopics(text: string): string[] {
  return TOPIC_KEYS.filter(k => TOPIC_PATTERNS[k].test(text));
}

async function main() {
  console.log('=== Keyword Topic Tagging — Mishkat + Shamail ===\n');

  const TARGETS = ['mishkat', 'shamail'];
  const PAGE = 1000;

  let totalInserted = 0;

  for (const col of TARGETS) {
    console.log(`\n── ${col} ──────────────────────────────`);

    const hadiths: Array<{hadith_number: number; english_text: string}> = [];
    let offset = 0;
    while (true) {
      const { data, error } = await sb
        .from('library_hadiths')
        .select('hadith_number, english_text')
        .eq('collection_key', col)
        .not('english_text', 'is', null)
        .neq('english_text', '')
        .range(offset, offset + PAGE - 1);
      if (error) { console.error('DB error:', error.message); break; }
      if (!data?.length) break;
      hadiths.push(...data);
      offset += data.length;
      if (data.length < PAGE) break;
    }
    console.log(`  Loaded ${hadiths.length} hadiths with English text`);

    const rows: Array<{collection_key:string; hadith_number:number; topic_key:string; confidence_score:number; tagged_by:string}> = [];
    let unmatched = 0;
    for (const h of hadiths) {
      const topics = assignTopics(h.english_text);
      if (!topics.length) { unmatched++; continue; }
      for (const t of topics) {
        rows.push({ collection_key: col, hadith_number: h.hadith_number, topic_key: t, confidence_score: 1.0, tagged_by: 'keyword' });
      }
    }
    console.log(`  Matched: ${hadiths.length - unmatched}, No match: ${unmatched}, Topic rows: ${rows.length}`);

    const CHUNK = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error, count } = await sb
        .from('library_hadith_topics')
        .upsert(rows.slice(i, i + CHUNK), { onConflict: 'collection_key,hadith_number,topic_key', ignoreDuplicates: true, count: 'exact' });
      if (error) console.error(`  [error] chunk ${i}: ${error.message}`);
      else inserted += count ?? 0;
    }
    console.log(`  Inserted: ${inserted} new topic rows`);
    totalInserted += inserted;
  }

  const { count: total } = await sb.from('library_hadith_topics').select('*', { count: 'exact', head: true });
  console.log(`\nDone. Total new topic rows inserted: ${totalInserted}`);
  console.log(`Total library_hadith_topics rows: ${total}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
