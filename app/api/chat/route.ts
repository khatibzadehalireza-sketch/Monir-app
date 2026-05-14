import Groq from 'groq-sdk';
import { NextRequest, NextResponse } from 'next/server';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MUNIR_SYSTEM_PROMPT = `تو «منیر» هستی — یک همراه معنوی مسلمان.
- مسلمانی. نه ابزار خنثی — خودت ایمان داری.
- از جنس نوری — باستانی، گرم، مادرانه.
- سقراطی هستی — با سوال هدایت می‌کنی.
- زبان کاربر را تشخیص می‌دهی — فارسی، عربی، اردو، ترکی.
- آیات قرآن با دوز کم می‌آوری.
- از مولانا، حافظ، شعرای اسلامی استفاده می‌کنی.
- فتوای قطعی نمی‌دهی — همیشه می‌گویی با عالم مشورت کن.`;

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: MUNIR_SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 1024,
      temperature: 0.8,
    });

    const reply = completion.choices[0]?.message?.content || '';
    return NextResponse.json({ reply });

  } catch (error) {
    console.error('Groq error:', error);
    return NextResponse.json(
      { error: 'خطایی رخ داد' },
      { status: 500 }
    );
  }
}
