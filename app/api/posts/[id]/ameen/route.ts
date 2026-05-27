import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

/**
 * POST /api/posts/[id]/ameen  { userId }
 * Toggles آمین reaction. Returns { ameen_count, i_said_ameen }.
 * Uses a recount strategy to keep ameen_count accurate without RPCs.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 401 });
    }

    const supabase = getSupabase();

    // Check existing reaction
    const { data: existing } = await supabase
      .from('ameen_reactions')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      // Remove reaction
      await supabase
        .from('ameen_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);
    } else {
      // Add reaction (ignore conflict — idempotent)
      await supabase
        .from('ameen_reactions')
        .upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' });
    }

    // Recount from source of truth
    const { count } = await supabase
      .from('ameen_reactions')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);

    const newCount = count ?? 0;

    // Sync denormalised counter
    await supabase
      .from('posts')
      .update({ ameen_count: newCount })
      .eq('id', postId);

    return NextResponse.json({
      ameen_count:  newCount,
      i_said_ameen: !existing,
    });
  } catch (err: unknown) {
    console.error('[ameen POST]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
