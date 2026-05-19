import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSupabase } from '@/lib/supabase';

const SYSTEM_PROMPT = `⚠️ قانون زبان — بدون استثنا:
تمام جواب‌هایت باید ۱۰۰٪ فارسی باشه. حتی یک حرف لاتین یا سیریلیک مجاز نیست. هر مفهوم تخصصی رو خالص فارسی توضیح بده. تنها استثنا: آیه‌های قرآن و احادیث عربی.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
تو منیر هستی — روانشناس مسلمان با سال‌ها تجربه بالینی. لحنت گرم، صادق، و بدون قضاوته. نه سرد، نه کتابی، نه موعظه‌گر.

══ فاز اول: گوش دادن فعال — هیچ‌وقت در اولین پیام راه‌حل نده ══

اگه جنسیت کاربر مشخص نیست، اول بپرس: «برادری یا خواهری؟»

بازتاب احساس (گوش دادن فعال):
احساس کاربر رو دقیق بازتاب بده تا بفهمه شنیده شده — نه تأیید سطحی، بلکه نشون دادن اینکه واقعاً فهمیدی:
• «یعنی زیر این خستگی، یه نوع تنهایی هم هست که کسی نمی‌بینتش.»
• «این که گفتی "دیگه نمی‌کشم" — یعنی مدتیه داری تنها این رو حمل می‌کنی.»
• «پس هم دردت واقعیه، هم احساس می‌کنی نباید داشته باشیش — این خودش سنگینه.»

بعد از بازتاب، یک سوال لایه‌ای بپرس:
• «این حس از کِی شروع شده — یه اتفاق خاص بود یا کم‌کم اومد؟»
• «قبل از اینکه اینطوری بشه، چی فرق داشت؟»
• «وقتی این فکر میاد، بدنت چه حسی داره؟»
• «اگه این مشکل نبود، الان کجا بودی؟»

══ فاز دوم: کشف ریشه با روش سقراطی ══

سوال بپرس تا کاربر خودش به نتیجه برسه — نه اینکه تو نتیجه بدی:
• «به نظر خودت این فکر که "ارزش ندارم" از کجا میاد؟»
• «اگه به یه دوست صمیمی همین رو می‌گفت، بهش چی می‌گفتی؟»
• «چند بار قبلاً از این بدتر بودی و رد شدی — اون موقع چی کمک کرد؟»
• «این باور از کِی توت هست؟ یادته اولین باری که اینطور فکر کردی؟»

وقتی الگو روشن شد، یه جمله بازتاب بده:
«پس اگه درست فهمیدم، ریشه اصلی اینه که... — درسته؟»

══ فاز سوم: راه‌حل اسلامی — فقط بعد از فهم کامل ══

الف) اگه مشکل از تحریف فکری باشه (افکار منفی مثل «بی‌ارزشم»، «همه از من متنفرن»، «هیچ‌وقت درست نمیشه»):
روش شناختی اسلامی — افکار منفی رو با آیات به چالش بکش:
• «این فکر که "دیگه هیچ‌کس کنارم نیست" — با «وَنَحنُ أَقرَبُ إِلَیهِ مِن حَبلِ الوَرید» چطور کنار میاد؟»
• یک تمرین عملی بده: «امشب روی کاغذ بنویس این فکر چقدر واقعیه — چه شواهدی داره، چه شواهدی علیهشه.»

ب) اگه مشکل فقدان یا داغ باشه (مرگ، جدایی، از دست دادن):
مراحل داغ رو بشناس و با آدم همراه بشو، نه اینکه عجله داشته باشی:
• «داغ یعنی عشقت هنوز زنده‌ست — این درد نشونه‌ی اینه که چقدر ارزش داشت.»
• «اسلام گریه رو نه‌تنها مجاز می‌دونه، بلکه رحمت می‌دونه — پیامبر هم برای پسرش گریست.»
• «یه راه برای نگه داشتن یادشه: براش صدقه بده، براش دعا کن — این ارتباط قطع نمیشه.»
• سوال بپرس: «آیا فرصت داشتی اون رو درست خداحافظی کنی؟»

ج) راه‌حل عملی اسلامی برای بقیه مشکلات:
• یک کار مشخص، قابل انجام، متناسب با این آدم خاص.
  مثال: «امشب ده دقیقه بنویس چی اذیتت می‌کنه — بدون سانسور.»
  مثال: «قبل از خواب سه بار استغفر بگو و تصور کن اون سنگینی از روی شونه‌هات برداشته می‌شه.»
• اگه واقعاً مناسب بود، یک آیه یا حدیث دقیقاً مرتبط بیار — نه تزئینی، نه اجباری.

══ قوانین همیشگی ══
• هر جواب حداکثر ۳ تا ۴ جمله. هرگز بیشتر.
• هیچ‌وقت موضع نمی‌گیری، سرزنش نمی‌کنی، مقایسه نمی‌کنی.
• فقط از چیزی که کاربر صریحاً گفته استفاده کن — هرگز چیزی حدس نزن.
• اگه نشانه‌ای از آسیب به خود دیدی، آروم و بدون وحشت بپرس: «می‌خوام مطمئن بشم که در امانی — الان آسیبی به خودت رسوندی؟»`;

// خروجی JSON با فیلدهای ساختاریافته
const PROFILE_EXTRACT_PROMPT = `از پیام کاربر اطلاعاتی که صریحاً گفته رو استخراج کن و به‌صورت JSON برگردون.
فیلدها:
- name: اسم کاربر (اگه گفته)
- gender: "برادر" یا "خواهر" (اگه گفته)
- emotional_state: وضعیت احساسی فعلی به فارسی (اگه مشخص شده)
- topic_tags: آرایه‌ای از موضوعات مرتبط به فارسی، حداکثر ۵ تا
- religiosity_level: "بالا"، "متوسط"، یا "پایین" (فقط اگه خیلی واضح مشخص شده)
- summary: خلاصه یک‌خطی پروفایل، حداکثر ۲۰۰ کاراکتر

قانون: فقط فیلدهایی که واقعاً تغییر کردن یا اضافه شدن رو برگردون.
اگه هیچ اطلاعات جدیدی نیست فقط برگردون: {"changed": false}
در غیر این صورت: {"changed": true, ...فیلدهای جدید/تغییریافته}`;

// دسته‌بندی موضوعی پیام
const TOPIC_CLASSIFY_PROMPT = `پیام کاربر رو در یکی از این دسته‌ها قرار بده و فقط همون کلمه رو بنویس:
- religious: سوال درباره اسلام، قرآن، نماز، ایمان، عبادت
- emotional: احساسات، روابط، غم، اضطراب، تنهایی، خوشحالی
- identity: هویت، هدف زندگی، خودشناسی، جایگاه
- deepthinking: فلسفه، معنای زندگی، سوالات وجودی، شک

فقط یک کلمه خروجی بده.`;

type TopicCategory = 'religious' | 'emotional' | 'identity' | 'deepthinking';

interface ProfileData {
  changed: boolean;
  name?: string;
  gender?: string;
  emotional_state?: string;
  topic_tags?: string[];
  religiosity_level?: string;
  summary?: string;
}

function detectDeviceType(ua: string): 'mobile' | 'desktop' {
  return /mobile|android|iphone|ipad|tablet/i.test(ua) ? 'mobile' : 'desktop';
}

function detectLanguage(text: string): string {
  const persianChars = (text.match(/[؀-ۿ]/g) || []).length;
  const total = text.replace(/\s/g, '').length;
  return total > 0 && persianChars / total > 0.3 ? 'fa' : 'en';
}

function buildGeminiHistory(messages: Array<{ role: string; content: string }>) {
  const result: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [];
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    if (result.length > 0 && result[result.length - 1].role === role) {
      result[result.length - 1].parts[0].text += '\n' + m.content;
    } else {
      result.push({ role, parts: [{ text: m.content }] });
    }
  }
  while (result.length > 0 && result[0].role === 'model') result.shift();
  return result;
}

function buildProfileContext(profile: Record<string, any>): string {
  const lines: string[] = [];
  if (profile.name)              lines.push(`• اسم: ${profile.name}`);
  if (profile.gender)            lines.push(`• جنسیت: ${profile.gender}`);
  if (profile.emotional_state)   lines.push(`• وضعیت احساسی اخیر: ${profile.emotional_state}`);
  if (profile.religiosity_level) lines.push(`• سطح دینداری: ${profile.religiosity_level}`);
  if (profile.topic_tags?.length) lines.push(`• موضوعاتی که قبلاً مطرح کرده: ${profile.topic_tags.join('، ')}`);
  if (!lines.length) return '';
  return [
    '【اطلاعات ذخیره‌شده از مکالمات قبلی این کاربر】',
    ...lines,
    'از این اطلاعات برای شخصی‌سازی لحن و پاسخ‌هایت استفاده کن — نیازی نیست دوباره بپرسی.',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
  ].join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body.message;
    const userId = body.userId || 'guest';
    const sessionStartTime: string = body.sessionStartTime || new Date().toISOString();
    const sessionMessageCount: number = body.sessionMessageCount || 1;
    const deviceType = detectDeviceType(request.headers.get('user-agent') || '');
    const languageDetected = detectLanguage(message);

    if (!message) {
      return NextResponse.json({ error: 'message الزامی' }, { status: 400 });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const supabase = getSupabase();

    const today = new Date().toISOString().split('T')[0];

    // --- لیمیت + پروفایل + تاریخچه در parallel ---
    const [countResult, profileResult, historyResult] = await Promise.all([
      supabase.from('message_counts').select('count').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('conversations').select('role, content').eq('user_id', userId)
        .in('role', ['user', 'assistant']).order('created_at', { ascending: false }).limit(10),
    ]);

    if (countResult.error)   console.error('[supabase] message_counts:', countResult.error.message);
    if (profileResult.error) console.error('[supabase] user_profiles:', profileResult.error.message);
    if (historyResult.error) console.error('[supabase] conversations:', historyResult.error.message);

    const countRow   = countResult.data;
    const profileRow = profileResult.data;
    const rawHistory = historyResult.data;

    const todayCount = countRow?.count ?? 0;

    if (todayCount >= 70) {
      return NextResponse.json({
        reply: 'امروز به اندازه‌ای که سهم ما بود با هم بودیم. برای ادامه چت میتونی pro را فعال کنی',
        limitReached: true,
      });
    }

    const currentProfile: Record<string, any> = profileRow ?? {};
    const history = rawHistory ? [...rawHistory].reverse() : [];

    const systemFinal = buildProfileContext(currentProfile) + SYSTEM_PROMPT;

    const groqMessages = [
      ...history.map((h: any) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: message },
    ];

    // ۱. جواب اصلی (Groq → Gemini fallback)
    let reply: string;
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemFinal }, ...groqMessages],
        max_tokens: 1024,
        temperature: 0.85,
      });
      reply = completion.choices[0]?.message?.content || 'فرزندم، لحظه‌ای صبر کن...';
    } catch (err: any) {
      if (err?.status !== 429 && err?.status !== 503 && err?.status !== 529) throw err;
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const gemini = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', systemInstruction: systemFinal });
      const chat = gemini.startChat({ history: buildGeminiHistory(groqMessages.slice(0, -1)) });
      const result = await chat.sendMessage(message);
      reply = result.response.text() || 'فرزندم، لحظه‌ای صبر کن...';
    }

    // ۲. پروفایل + topic در parallel با مدل سبک‌تر (بعد از reply تا rate-limit نخوریم)
    const [profileSettled, topicSettled] = await Promise.allSettled([

      (async (): Promise<ProfileData | null> => {
        const currentSummary = currentProfile.summary
          ? `\n\nپروفایل فعلی: ${JSON.stringify({ name: currentProfile.name, gender: currentProfile.gender, emotional_state: currentProfile.emotional_state, religiosity_level: currentProfile.religiosity_level, topic_tags: currentProfile.topic_tags })}`
          : '';
        const res = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: PROFILE_EXTRACT_PROMPT + currentSummary },
            { role: 'user', content: message },
          ],
          max_tokens: 200,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });
        const raw = res.choices[0]?.message?.content || '{"changed":false}';
        const parsed: ProfileData = JSON.parse(raw);
        return parsed.changed ? parsed : null;
      })(),

      (async (): Promise<TopicCategory | null> => {
        const res = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: TOPIC_CLASSIFY_PROMPT },
            { role: 'user', content: message },
          ],
          max_tokens: 10,
          temperature: 0.1,
        });
        const raw = res.choices[0]?.message?.content?.trim().toLowerCase();
        const valid: TopicCategory[] = ['religious', 'emotional', 'identity', 'deepthinking'];
        return valid.find(v => raw?.includes(v)) ?? null;
      })(),
    ]);

    const newProfileData = profileSettled.status === 'fulfilled' ? profileSettled.value : null;
    const topicCategory = topicSettled.status === 'fulfilled' ? topicSettled.value : null;

    if (profileSettled.status === 'rejected')
      console.error('[profile] extraction failed:', (profileSettled as any).reason?.message);
    else
      console.log('[profile] extracted:', JSON.stringify(newProfileData));

    // --- ذخیره در Supabase (هر save مستقل، خطاها log می‌شن) ---
    const saveResults = await Promise.all([
      supabase.from('conversations').insert({ user_id: userId, role: 'user', content: message }),
      supabase.from('conversations').insert({ user_id: userId, role: 'assistant', content: reply }),
      supabase.from('message_counts').upsert(
        { user_id: userId, date: today, count: todayCount + 1 },
        { onConflict: 'user_id,date' }
      ),
    ]);
    saveResults.forEach(({ error }, i) => {
      if (error) console.error(`[supabase] save[${i}]:`, error.message);
    });

    if (newProfileData) {
      const { changed: _, ...fields } = newProfileData;
      const merged = { ...currentProfile, ...fields, user_id: userId, updated_at: new Date().toISOString() };
      if (!merged.summary) {
        const parts: string[] = [];
        if (merged.name)              parts.push(`اسم: ${merged.name}`);
        if (merged.gender)            parts.push(`جنسیت: ${merged.gender}`);
        if (merged.emotional_state)   parts.push(`احساس: ${merged.emotional_state}`);
        if (merged.religiosity_level) parts.push(`دینداری: ${merged.religiosity_level}`);
        merged.summary = parts.join(' | ').slice(0, 200);
      }
      const { error: profileSaveErr } = await supabase
        .from('user_profiles')
        .upsert(merged, { onConflict: 'user_id' });
      if (profileSaveErr) console.error('[supabase] profile upsert:', profileSaveErr.message);
    }

    return NextResponse.json({ reply });

  } catch (error) {
    console.error('خطا:', error);
    return NextResponse.json({ error: 'خطا' }, { status: 500 });
  }
}
