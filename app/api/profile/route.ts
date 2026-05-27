import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

/** Calculate streak: number of consecutive days (back from today) with ≥1 message */
async function calcStreak(userId: string): Promise<number> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('message_counts')
    .select('date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(365);

  if (!data?.length) return 0;

  const dateSet = new Set(data.map((r: { date: string }) => r.date));
  let streak = 0;
  const cursor = new Date();

  // Allow today or yesterday as the "start" so a session earlier today still counts
  for (let i = 0; i < 365; i++) {
    const key = cursor.toISOString().split('T')[0];
    if (dateSet.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (i === 0) {
      // Today has no messages yet — check yesterday before giving up
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const supabase = getSupabase();

  const [profileRes, identityRes, streak] = await Promise.all([
    supabase.from('user_profiles').select('name').eq('user_id', userId).maybeSingle(),
    supabase.from('user_identity').select('country').eq('user_id', userId).maybeSingle(),
    calcStreak(userId),
  ]);

  return NextResponse.json({
    name:    profileRes.data?.name    ?? null,
    country: identityRes.data?.country ?? null,
    streak,
  });
}
