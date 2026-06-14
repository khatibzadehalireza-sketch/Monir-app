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

async function main() {
  // Clean up test rows inserted during schema probing
  const { error } = await sb.from('library_quran_embeddings').delete().eq('surah_number', 0);
  console.log('Cleanup surah_number=0:', error ? error.message : 'OK');
}
main().catch(e => { console.error(e.message); process.exit(1); });
