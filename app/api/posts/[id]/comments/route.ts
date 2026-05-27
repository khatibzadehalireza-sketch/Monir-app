import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

/**
 * GET /api/posts/[id]/comments
 * Returns all comments for a post, enriched with author names.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const supabase = getSupabase();

    const { data: comments, error } = await supabase
      .from('comments')
      .select('id, user_id, content, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!comments?.length) return NextResponse.json({ comments: [] });

    // Fetch display names
    const userIds = [...new Set(comments.map(c => c.user_id))];
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, name')
      .in('user_id', userIds);

    const nameMap: Record<string, string> = {};
    for (const p of profiles ?? []) {
      if (p.name) nameMap[p.user_id] = p.name;
    }

    const enriched = comments.map(c => ({
      id:          c.id,
      user_id:     c.user_id,
      author_name: nameMap[c.user_id] ?? 'کاربر منیر',
      content:     c.content,
      created_at:  c.created_at,
    }));

    return NextResponse.json({ comments: enriched });
  } catch (err: unknown) {
    console.error('[comments GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

/**
 * POST /api/posts/[id]/comments  { userId, content }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const { userId, content } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 401 });
    }

    const trimmed = (content ?? '').trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'content required' }, { status: 400 });
    }
    if (trimmed.length > 300) {
      return NextResponse.json({ error: 'content too long' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: userId, content: trimmed })
      .select('id, user_id, content, created_at')
      .single();

    if (error) throw error;

    // Get author name
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('name')
      .eq('user_id', userId)
      .maybeSingle();

    return NextResponse.json({
      comment: {
        ...data,
        author_name: profile?.name ?? 'کاربر منیر',
      },
    }, { status: 201 });
  } catch (err: unknown) {
    console.error('[comments POST]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
