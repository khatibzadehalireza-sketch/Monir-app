import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const supabase = getSupabase();

  const [profileRes, identityRes] = await Promise.all([
    supabase.from('user_profiles').select('name').eq('user_id', userId).maybeSingle(),
    supabase
      .from('user_identity')
      .select('country, streak_count, longest_streak')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    name:          profileRes.data?.name             ?? null,
    country:       identityRes.data?.country          ?? null,
    streak:        identityRes.data?.streak_count     ?? 0,
    longestStreak: identityRes.data?.longest_streak   ?? 0,
  });
}
