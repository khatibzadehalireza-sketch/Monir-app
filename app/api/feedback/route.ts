import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { session_id, user_id, helpfulness_score } = await request.json();

    if (!session_id || !user_id || !helpfulness_score) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 });
    }

    const score = Math.max(1, Math.min(5, Math.round(Number(helpfulness_score))));
    if (Number.isNaN(score)) {
      return NextResponse.json({ error: 'invalid score' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from('user_feedback_validation')
      .insert({ session_id, user_id, helpfulness_score: score });

    if (error) {
      console.error('[feedback insert]', error.message);
      return NextResponse.json({ error: 'db error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
