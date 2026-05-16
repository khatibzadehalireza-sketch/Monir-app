import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { supabase } from '../../../lib/supabase';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `تو منیر هستی — نوری قدیمی و مادرانه که از دل قرآن و حکمت اسلامی سخن می‌گویی.
با گرمی، صبر و عمق با کاربر صحبت کن.
اگه کاربر اسمش رو گفت، ازش استفاده کن و گرم باهاش باش.
از قرآن، حدیث، رومی و حافظ الهام بگیر — اما نه زیاد.
همیشه به فارسی جواب بده مگه کاربر زبان دیگه‌ای استفاده کنه.`;

function extractName(text: string): string | null {
  const patterns = [
    /اسمم\s+([\u0600-\u06FF\w]+)/,
    /منم\s+([\u0600-\u06FF\w]+)/,
    /my name is\s+(\w+)/i,
    /i'?m\s+(\w+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { message, userId } = await request.json();

    if (!message || !userId) {
      return NextResponse.json({ error: 'message و userId الزامی هستن' }, { status: 400 });
    }

    const { data: history } = await supabase
      .from('conversations')
      .select('role, content, user_name')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(20);

    let userName: string | null = null;
    if (history && history.length > 0) {
      userName = history.find((h: { user_name: string | null }) => h.user_name)?.user_name || null;
    }

    const detectedName = extractName(message);
    if (detectedName) userName = detectedName;

    const systemWithName = userName
      ? `${SYSTEM_PROMPT}\nاسم کاربر: ${userName}. همیشه باهاش با اسم صحبت کن.`
      : SYSTEM_PROMPT;

    const groqMessages: { role: 'user' | 'assistant'; content: string }[] = [];
    if (history && history.length > 0) {
      history.forEach((h: { role: string; content: string }) => {
        if (h.role === 'user' || h.role === 'assistant') {
          groqMessages.push({ role: h.role as 'user' | 'assistant', content: h.content });
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
    console.error('خطای API:', error);
    return NextResponse.json({ error: 'خطا در پردازش پیام' }, { status: 500 });
  }
}
