import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SYSTEM_PROMPT = `تو منیر هستی — نوری قدیمی و مادرانه که از دل قرآن و حکمت اسلامی سخن می‌گویی.
با گرمی، صبر و عمق با کاربر صحبت کن.
اگه کاربر اسمش رو گفت، ازش استفاده کن.
همیشه به فارسی جواب بده.`;

function extractName(text: string): string | null {
  const patterns = [
    /اسمم\s+([\u0600-\u06FF\w]+)/,
    /منم\s+([\u0600-\u06FF\w]+)/,
    /my name is\s+(\w+)/i,
    /i'?m\s+(\w+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body.message;
    const userId = body.userId || 'guest';

    if (!message) {
      return NextResponse.json({ error: 'message الزامی' }, { status: 400 });
    }

    const { data: history } = await supabase
      .from('conversations')
      .select('role, content, user_name')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(20);

    let userName: string | null = null;
    if (history && history.length > 0) {
      userName = history.find((h: any) => h.user_name)?.user_name || null;
    }

    const detectedName = extractName(message);
    if (detectedName) userName = detectedName;

    const systemWithName = userName
      ? `${SYSTEM_PROMPT}\nاسم کاربر: ${userName}`
      : SYSTEM_PROMPT;

    const groqMessages: any[] = [];
    if (history) {
      history.forEach((h: any) => {
        if (h.role === 'user' || h.role === 'assistant') {
          groqMessages.push({ role: h.role, content: h.content });
        }
      });
    }
    groqMessages.push({ role: 'user', content: message });

    await supabase.from('conversations').insert({
      user_id: userId,
      user_name: userName,
      role: 'user',
      content: message,
    });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: systemWithName }, ...groqMessages],
      max_tokens: 1024,
      temperature: 0.85,
    });

    const reply = completion.choices[0]?.message?.content || 'فرزندم، لحظه‌ای صبر کن...';

    await supabase.from('conversations').insert({
      user_id: userId,
      user_name: userName,
      role: 'assistant',
      content: reply,
    });

    return NextResponse.json({ reply, userName });

  } catch (error) {
    console.error('خطا:', error);
    return NextResponse.json({ error: 'خطا' }, { status: 500 });
  }
}
