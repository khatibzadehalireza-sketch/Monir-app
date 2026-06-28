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
(async()=>{
  const { data } = await sb.from('library_hadith_collections').select('collection_key,name_english,total_hadith,is_active').order('collection_key');
  console.log('All registered collection_keys:\n');
  for (const r of data ?? []) {
    console.log(`  ${r.collection_key.padEnd(20)} ${r.name_english} (${r.total_hadith}) active=${r.is_active}`);
  }
})();
