import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

/**
 * GET /api/feed?cursor=<ISO>&limit=<n>&userId=<uid>
 * Returns paginated posts newest-first, each with comment_count and
 * whether the requesting user has already said آمین.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const cursor  = searchParams.get('cursor');          // ISO timestamp for keyset pagination
    const limit   = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50);
    const userId  = searchParams.get('userId') ?? '';    // optional — for ameen state

    const supabase = getSupabase();

    let query = supabase
      .from('posts')
      .select('id, user_id, content, created_at, ameen_count, image_url')
      .order('created_at', { ascending: false })
      .limit(limit + 1);   // fetch one extra to know if there is a next page

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: posts, error } = await query;
    if (error) throw error;

    if (!posts?.length) {
      return NextResponse.json({ posts: [], nextCursor: null });
    }

    const hasMore   = posts.length > limit;
    const pagePosts = hasMore ? posts.slice(0, limit) : posts;
    const postIds   = pagePosts.map(p => p.id);

    // Fetch comment counts and ameen status in parallel
    const [commentCountsRes, ameenRes, namesRes] = await Promise.all([
      supabase
        .from('comments')
        .select('post_id')
        .in('post_id', postIds),
      userId
        ? supabase
            .from('ameen_reactions')
            .select('post_id')
            .in('post_id', postIds)
            .eq('user_id', userId)
        : Promise.resolve({ data: [] }),
      // Fetch display names from user_profiles
      supabase
        .from('user_profiles')
        .select('user_id, name')
        .in('user_id', [...new Set(pagePosts.map(p => p.user_id))]),
    ]);

    // Build lookup maps
    const commentCountMap: Record<string, number> = {};
    for (const row of commentCountsRes.data ?? []) {
      commentCountMap[row.post_id] = (commentCountMap[row.post_id] ?? 0) + 1;
    }

    const ameenSet = new Set(
      (ameenRes.data ?? []).map((r: { post_id: string }) => r.post_id)
    );

    const nameMap: Record<string, string> = {};
    for (const row of namesRes.data ?? []) {
      if (row.name) nameMap[row.user_id] = row.name;
    }

    const enriched = pagePosts.map(p => ({
      id:            p.id,
      user_id:       p.user_id,
      author_name:   nameMap[p.user_id] ?? 'کاربر منیر',
      content:       p.content,
      created_at:    p.created_at,
      ameen_count:   p.ameen_count,
      comment_count: commentCountMap[p.id] ?? 0,
      i_said_ameen:  ameenSet.has(p.id),
      image_url:     p.image_url ?? null,
    }));

    const nextCursor = hasMore
      ? pagePosts[pagePosts.length - 1].created_at
      : null;

    return NextResponse.json({ posts: enriched, nextCursor });
  } catch (err: unknown) {
    console.error('[feed GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
