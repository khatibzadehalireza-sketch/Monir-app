/**
 * Register new collections in library_hadith_collections so the FK allows inserts.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
try {
  const buf = readFileSync(join(process.cwd(), '.env.local'));
  const raw = buf[0]===0xff&&buf[1]===0xfe ? buf.slice(2).toString('utf16le') : buf.toString('utf-8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.replace(/^﻿/,'').trim();
    if (!t||t.startsWith('#')) continue;
    const eq=t.indexOf('='); if(eq===-1) continue;
    const k=t.slice(0,eq).trim(), v=t.slice(eq+1).trim().replace(/^["']|["']$/g,'');
    if(!process.env[k]) process.env[k]=v;
  }
} catch {}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth:{persistSession:false}});

const newCollections = [
  {
    collection_key: 'mishkat',
    name_english: 'Mishkat al-Masabih',
    name_arabic: 'مشكاة المصابيح',
    author: 'Al-Khatib al-Tibrizi',
    total_hadith: 4428,
    source_url: 'https://cdn.jsdelivr.net/gh/AhmedBaset/hadith-json@v1.2.0/db/by_book/other_books/mishkat_almasabih.json',
    is_active: true,
  },
  {
    collection_key: 'shamail',
    name_english: 'Shamail al-Tirmidhi',
    name_arabic: 'الشمائل المحمدية',
    author: 'Imam al-Tirmidhi',
    total_hadith: 402,
    source_url: 'https://cdn.jsdelivr.net/gh/AhmedBaset/hadith-json@v1.2.0/db/by_book/other_books/shamail_muhammadiyah.json',
    is_active: true,
  },
];

(async () => {
  const { error } = await sb
    .from('library_hadith_collections')
    .upsert(newCollections, { onConflict: 'collection_key', ignoreDuplicates: false });
  if (error) { console.error('Error:', error.message); process.exit(1); }
  console.log('Registered: mishkat, shamail');
})();
