import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// Fields we are allowed to surface and nullify — scores/indicators stay hidden
const IDENTITY_PUBLIC = [
  'country', 'city', 'ip_country', 'ip_city', 'origin_country',
  'age_range', 'family_status', 'education_level', 'years_in_west',
  'convert_status', 'communication_style',
] as const;

const PROFILE_PUBLIC = [
  'name', 'prayer_status', 'topic_tags', 'recurring_struggles',
  'spiritual_journey_stage', 'quran_relationship', 'mosque_attendance',
  'identity_conflict', 'coping_style', 'fiqh_school', 'emotional_state',
  'breakthrough_moments',
] as const;

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const supabase = getSupabase();

  const [identityRes, profileRes, lifeRes] = await Promise.all([
    supabase.from('user_identity').select(IDENTITY_PUBLIC.join(',')).eq('user_id', userId).maybeSingle(),
    supabase.from('user_profiles').select(PROFILE_PUBLIC.join(',')).eq('user_id', userId).maybeSingle(),
    supabase.from('life_events').select('id,event_type,event_year,description,impact_on_faith').eq('user_id', userId).order('created_at', { ascending: false }),
  ]);

  return NextResponse.json({
    identity: identityRes.data ?? {},
    profile:  profileRes.data  ?? {},
    lifeEvents: lifeRes.data   ?? [],
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { userId, table, field, lifeEventId } = body as {
    userId: string;
    table: 'user_identity' | 'user_profiles' | 'life_events';
    field?: string;
    lifeEventId?: string;
  };

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const supabase = getSupabase();

  if (table === 'life_events' && lifeEventId) {
    const { error } = await supabase.from('life_events').delete().eq('id', lifeEventId).eq('user_id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!field) return NextResponse.json({ error: 'field required' }, { status: 400 });

  // Validate field is in allowed list
  const allowed = table === 'user_identity'
    ? (IDENTITY_PUBLIC as readonly string[])
    : (PROFILE_PUBLIC as readonly string[]);
  if (!allowed.includes(field)) {
    return NextResponse.json({ error: 'field not allowed' }, { status: 403 });
  }

  const { error } = await supabase.from(table).update({ [field]: null }).eq('user_id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
