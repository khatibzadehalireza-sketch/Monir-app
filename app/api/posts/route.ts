import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getSupabase } from '@/lib/supabase';

/**
 * AI content moderation — returns true if content is acceptable.
 * Uses a fast Groq model with a tight system prompt.
 * Groq client is lazy-initialized to avoid build-time env var crash.
 */
async function isContentAcceptable(text: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
    const res = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      temperature: 0,
      max_tokens: 60,
      messages: [
        {
          role: 'system',
          content: `You are a content moderator for an Islamic spiritual app.
Respond with JSON only: {"ok": true} or {"ok": false, "reason": "brief English reason"}.

Reject if the text contains:
- Sexual or explicit content
- Hate speech, racism, or sectarian attacks
- Violence or threats
- Spam or advertising
- Profanity or severe insults
- Content promoting extremism

Allow:
- Personal reflections, duas, prayers, spiritual thoughts
- Questions about Islam or spirituality
- Emotional expression (grief, hope, gratitude)
- Sharing Quran verses or hadiths`,
        },
        { role: 'user', content: text },
      ],
    });

    const raw = res.choices[0]?.message?.content?.trim() ?? '{"ok":true}';
    // Strip markdown code fences if present
    const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(json) as { ok: boolean; reason?: string };
    return parsed;
  } catch {
    // If moderation fails, allow through (fail-open — better UX)
    return { ok: true };
  }
}

/**
 * POST /api/posts  { userId, content }
 * Creates a new post after AI moderation.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, content } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 401 });
    }
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content required' }, { status: 400 });
    }
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return NextResponse.json({ error: 'content is empty' }, { status: 400 });
    }
    if (trimmed.length > 500) {
      return NextResponse.json({ error: 'content too long' }, { status: 400 });
    }

    // AI moderation
    const { ok, reason } = await isContentAcceptable(trimmed);
    if (!ok) {
      return NextResponse.json(
        { error: 'rejected', reason: reason ?? 'محتوا مناسب نیست' },
        { status: 422 }
      );
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('posts')
      .insert({ user_id: userId, content: trimmed })
      .select('id, user_id, content, created_at, ameen_count')
      .single();

    if (error) throw error;

    return NextResponse.json({ post: data }, { status: 201 });
  } catch (err: unknown) {
    console.error('[posts POST]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
