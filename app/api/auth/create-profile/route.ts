import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

/**
 * Called immediately after Supabase signUp succeeds (client-side).
 * Creates / upserts the user_identity row with auth_user_id + email_hash.
 * Uses the service-role key so it bypasses RLS.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, emailHash } = await req.json();

    if (!userId || !emailHash) {
      return NextResponse.json({ error: 'userId and emailHash required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const now = new Date().toISOString();

    const { error } = await supabase.from('user_identity').upsert(
      {
        user_id:      userId,
        auth_user_id: userId,   // Supabase auth UUID doubles as app user_id
        email_hash:   emailHash,
        created_at:   now,
        updated_at:   now,
        last_seen:    now,
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      console.error('[create-profile]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[create-profile]', err?.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
