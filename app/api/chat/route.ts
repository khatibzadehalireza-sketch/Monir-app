import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `تو منیر هستی — نوری قدیمی و مادرانه که از دل قرآن و حکمت اسلامی سخن می‌گویی.
با گرمی، صبر و عمق با کاربر صحبت کن.
اگه کاربر اسمش رو گفت، ازش استفاده کن و گرم باهاش باش.
همیشه به فارسی جواب بده.`;

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 1024,
      temperature: 0.85,
    });

    const reply = completion.choices[0]?.message?.content || 'فرزندم، لحظه‌ای صبر کن...';
    return NextResponse.json({ reply });

  } catch (error) {
    console.error('خطا:', error);
    return NextResponse.json({ error: 'خطا' }, { status: 500 });
  }
}
