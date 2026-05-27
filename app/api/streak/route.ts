import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

/**
 * POST /api/streak  { userId }
 * Increments streak_count in user_identity when the user visits on a new day.
 * Safe to call multiple times per day — only the first call per UTC date counts.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const supabase  = getSupabase();
    const today     = new Date().toISOString().split('T')[0];            // "2026-05-27"
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];

    const { data: row } = await supabase
      .from('user_identity')
      .select('streak_count, last_visit_date, longest_streak')
      .eq('user_id', userId)
      .maybeSingle();

    // Row doesn't exist yet — will be created on first chat message; skip silently
    if (!row) return NextResponse.json({ streak: 0, longest: 0 });

    // Already counted today
    if (row.last_visit_date === today) {
      return NextResponse.json({
        streak:  row.streak_count  ?? 0,
        longest: row.longest_streak ?? 0,
        alreadyUpdated: true,
      });
    }

    const prev    = row.streak_count   ?? 0;
    const prevMax = row.longest_streak ?? 0;

    // Continue streak (yesterday) or reset
    const newStreak  = row.last_visit_date === yesterday ? prev + 1 : 1;
    const newLongest = Math.max(newStreak, prevMax);

    await supabase
      .from('user_identity')
      .update({
        streak_count:    newStreak,
        last_visit_date: today,
        longest_streak:  newLongest,
        updated_at:      new Date().toISOString(),
      })
      .eq('user_id', userId);

    return NextResponse.json({ streak: newStreak, longest: newLongest, alreadyUpdated: false });
  } catch (err: any) {
    console.error('[streak]', err?.message);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
