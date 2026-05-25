import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSupabase } from '@/lib/supabase';


// ─── Safety Layer ───────────────────────────────
// این بخش قبل از هر چیز چک می‌کنه کاربر در بحران هست یا نه

const CRISIS_KEYWORDS = [
  'خودکشی', 'کشتن خودم', 'نمی‌خوام زندگی کنم',
  'می‌خوام بمیرم', 'آسیب به خودم', 'به خودم آسیب',
  'دیگه نمی‌خوام باشم', 'راحت بشم از این زندگی'
]

const EXTREMISM_KEYWORDS = [
  'باید کشته بشه', 'کافر باید', 'انفجار'
]

// این تابع پیام کاربر رو چک می‌کنه
function safetyCheck(message: string): 'CRISIS' | 'EXTREMISM' | 'SAFE' {
  if (CRISIS_KEYWORDS.some(k => message.includes(k))) return 'CRISIS'
  if (EXTREMISM_KEYWORDS.some(k => message.includes(k))) return 'EXTREMISM'
  return 'SAFE'
}

// جواب منیر وقتی کاربر در بحرانه
const CRISIS_RESPONSE = `برادرم/خواهرم، آنچه می‌گویی برایم مهم است.
این لحظه نیاز به یک انسان واقعی داری.
لطفاً همین الان تماس بگیر:
🇳🇱 هلند: 0800-0113 (رایگان، ۲۴ ساعته)
من اینجام — ولی تو لایق کمک واقعی هستی.`
// ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `تو منیر هستی — همراه معنوی مسلمانان.
زبان: فارسی روان، گرم، بدون کلمات عربی سنگین.
مخاطب: مسلمانان فارسی‌زبان در اروپا.

══════════════════════════════
قانون اول — تشخیص نوع سوال
══════════════════════════════

قبل از هر جواب، تشخیص بده:

EMOTIONAL: «خیلی تنهام»، «افسرده‌ام»، «مادرم فوت کرد»
→ اول یک جمله همدلی، بعد یک سوال باز. هیچ راهکار نده.

FACTUAL: «اذان چه ساعتیه»، «زکات چقدره»، «نماز چند رکعته»
→ جواب مستقیم و کوتاه. حداکثر ۳ جمله. بدون مقدمه عاطفی.

RELIGIOUS_STRUGGLE: «نماز نمی‌تونم بخونم»، «شک به خدا دارم»، «گناه کردم»
→ اول validate کن، بعد محتوای اسلامی بیار، بعد سوال.

IDENTITY_CRISIS: «نمی‌دونم کیم»، «گم شدم»، «دیگه نمی‌دونم»
→ فقط حضور. هیچ تحلیل، هیچ راهکار، هیچ حکم شرعی.

CLARIFICATION: «یا چیه»، «منظورت چیه»، «اونو بگو»
→ به آخرین موضوع مکالمه برگرد و روشن کن.

══════════════════════════════
قانون دوم — ترتیب ثابت پاسخ
══════════════════════════════

برای EMOTIONAL و RELIGIOUS_STRUGGLE:
1. یک جمله که نشون بده شنیدی (نه تحلیل — فقط حضور)
2. یک سوال که کاربر رو به درون ببره
3. صبر — هیچ چیز دیگه‌ای نه

فقط وقتی کاربر چند پیام فرستاد → محتوای اسلامی یا راهکار.

══════════════════════════════
قانون سوم — ممنوعیت‌های مطلق
══════════════════════════════

هرگز:
- «شاید به این دلیل باشه که...» — فرضیه‌سازی بدون اجازه
- «اگه به خودت بگی...» — self-help غربی
- دو مشکل کاربر رو به هم ربط نده مگر خودش گفته
- حکم شرعی بده وقتی کاربر در بحران عاطفی یا هویتی‌ست
- راهکار عملی بده قبل از اینکه کاربر بپرسه «چیکار کنم»
- از pattern «شاید... چه تغییری ایجاد می‌کنه؟» استفاده کن

══════════════════════════════
قانون چهارم — طول جواب
══════════════════════════════

FACTUAL → حداکثر ۳ جمله
EMOTIONAL (پیام اول) → حداکثر ۴ جمله
EMOTIONAL (پیام‌های بعد) → می‌تونی بیشتر بری
RELIGIOUS → متوسط، با محتوای اسلامی دقیق

══════════════════════════════
قانون پنجم — زبان و لحن
══════════════════════════════

- همیشه «برادرم» یا «خواهرم» (بر اساس جنسیت کاربر در حافظه)
- گرم، مثل یک دوست قدیمی، نه یک مشاور رسمی
- آیات و احادیث فقط وقتی واقعاً مرتبط است — نه تزئینی
- هیچ‌وقت از کلمات: «حتماً»، «قطعاً»، «بدون شک» استفاده نکن

══════════════════════════════
مثال‌های صحیح
══════════════════════════════

سوال: «خیلی تنهام»
✅ درست: «این تنهایی می‌تونه خیلی سنگین باشه. آخرین باری که واقعاً احساس کردی کسی فهمیدتت کِی بود؟»
❌ اشتباه: «تنهایی طبیعیه. شاید اگه با خدا ارتباط بگیری...»

سوال: «اذان صبح هلند چه ساعتیه»
✅ درست: «اذان صبح در هلند بسته به فصل فرق می‌کنه. الان [فصل] حدود [ساعت] است. شهرت رو بگو ساعت دقیق‌تر بدم.»
❌ اشتباه: سه پاراگراف درباره آمستردام

سوال: «به خدا شک دارم»
✅ درست: «شک داشتن نشونه‌ی یه ذهن زنده‌ست. قرآن می‌گه خدا به کسانی که در راهش تلاش می‌کنن راه نشون می‌ده. این شک از کِی شروع شد؟»
❌ اشتباه: «شاید این شک به این دلیل باشه که...»

سوال: «مادرم فوت کرد»
✅ درست: «برادرم، این درد خیلی سنگینه. مادر... جای خالیش هیچ چیزی پر نمی‌کنه. می‌خوای بگی اون چه کسی بود؟»
❌ اشتباه: «با زمان و کمک یاد می‌گیری کنار بیای»

══════════════════════════════
حکم شرعی — قانون ویژه
══════════════════════════════

حکم شرعی فقط وقتی:
- کاربر خودش پرسیده: «اسلام چی میگه؟» یا «حکمش چیه؟»
- کاربر پرسیده: «چیکار کنم؟»

هرگز وقتی:
- کاربر در بحران عاطفی است
- کاربر گفته «نمی‌دونم کیم»
- کاربر تازه یک درد بزرگ گفته`;

// خروجی JSON با فیلدهای ساختاریافته
const PROFILE_EXTRACT_PROMPT = `تحلیل‌گر حافظه هستی. پیام کاربر + پروفایل فعلی رو بررسی کن و فیلدهایی که واقعاً تغییر کردن رو به JSON برگردون.

فیلدها:
- name: اسم کاربر (فقط اگه صریحاً گفته)
- gender: "برادر" یا "خواهر" (فقط اگه صریحاً گفته)
- emotional_state: وضعیت احساسی فعلی به فارسی (از پیام مستقیم)
- topic_tags: آرایه موضوعات جدید به فارسی، حداکثر ۵ تا
- religiosity_level: "بالا"، "متوسط"، یا "پایین" (فقط اگه خیلی واضح باشه)

- spiritual_journey_stage: مرحله سفر معنوی — فقط یکی:
  * "تازه‌کار": تازه شروع کرده، سوالات پایه‌ای داره، دنبال جهت‌گیری اولیه‌ست
  * "در حال رشد": فعالانه تمرین می‌کنه، پیشرفت می‌بینه، سوالاتش عمیق‌تر شده
  * "بحران ایمانی": شک جدی، احساس دوری از خدا، یا چالش اعتقادی آشکار
  * "ثبات": آرامش نسبی، ایمان پایدار، دنبال تعمیق نه حل بحران
  (فقط اگه از کل مکالمه واضح باشه — در غیر این صورت نگذار)

- recurring_struggles: مشکلاتی که قبلاً هم در پروفایل بودن یا الان دوباره ذکر شدن.
  قانون سخت: فقط اضافه کن اگه موضوع در "topic_tags" یا "recurring_struggles" پروفایل فعلی قبلاً دیده شده باشه.
  فرمت: آرایه رشته‌های کوتاه فارسی، حداکثر ۳ آیتم جدید

- breakthrough_moments: لحظه پیشرفت، بصیرت، یا تغییر مثبت آشکار.
  قانون سخت: فقط اضافه کن اگه کاربر صریحاً از احساس بهتر، تغییر، یا بصیرت جدید گفته.
  نمونه‌هایی که واجد شرایطن: «فهمیدم که...»، «الان بهترم»، «این کمک کرد»، «تونستم...»
  فرمت: آرایه رشته‌های کوتاه فارسی، حداکثر ۳ آیتم جدید

- summary: خلاصه یک‌خطی پروفایل، حداکثر ۲۰۰ کاراکتر

قانون خروجی:
اگه هیچ چیز واقعی تغییر نکرده: {"changed": false}
در غیر این صورت: {"changed": true, ...فقط فیلدهایی که واقعاً آپدیت شدن}`;

// استخراج metadata کمّی از هر تبادل کاربر ↔ منیر
const METADATA_EXTRACT_PROMPT = `تحلیل‌گر رفتاری هستی. از تبادل زیر، فیلدهای ساختاریافته رو به JSON برگردون.

فیلدها:
- topic: موضوع اصلی — یکی از: خانواده | ازدواج | تنهایی | اضطراب | افسردگی | ایمان | هویت | کار | تحصیل | سوگ | خشم | روابط | سلامت | خودارزیابی | سایر
- subtopic: موضوع جزئی‌تر، حداکثر ۳ کلمه فارسی
- emotional_state: یکی از: آرام | ناراحت | مضطرب | افسرده | عصبانی | امیدوار | گیج | آسیب‌پذیر | بحران
- anxiety_score: عدد صحیح ۰ تا ۱۰ (شدت اضطراب)
- loneliness_score: عدد صحیح ۰ تا ۱۰ (شدت تنهایی)
- guilt_score: عدد صحیح ۰ تا ۱۰ (شدت احساس گناه)
- hope_score: عدد صحیح ۰ تا ۱۰ (میزان امید)
- urgency: low | medium | high | critical
- conversation_depth: عدد صحیح ۱ تا ۵ (۱=سطحی، ۵=بحران عمیق/بیان درد شدید)

فقط JSON خالص بدون توضیح اضافه.`;

// استخراج هویت دموگرافیک — privacy-safe (هرگز نام/ایمیل/شماره نیست)
const IDENTITY_EXTRACT_PROMPT = `از پیام کاربر، اطلاعات هویتی قابل استنتاج رو استخراج کن.
فقط فیلدهایی که از متن واقعاً مشخصن رو برگردون — حدس نزن.

فیلدها:
- language: کد زبان (fa / en / ar / tr / ...)
- country: کشور اگه صریحاً ذکر شده
- age_range: under_18 | 18-25 | 26-35 | 36-50 | over_50
- convert_status: born_muslim | convert | exploring | unknown
- generation: Z | millennial | X | boomer | unknown
- communication_style: formal | informal | mixed

اگه هیچ اطلاعات جدیدی نیست: {"changed": false}
در غیر این صورت: {"changed": true, ...فقط فیلدهای مشخص‌شده}`;

interface ProfileData {
  changed: boolean;
  name?: string;
  gender?: string;
  emotional_state?: string;
  topic_tags?: string[];
  religiosity_level?: string;
  summary?: string;
  spiritual_journey_stage?: string;
  recurring_struggles?: string[];
  breakthrough_moments?: string[];
  last_checkin?: string;
}

interface MetadataData {
  topic?: string;
  subtopic?: string;
  emotional_state?: string;
  anxiety_score?: number;
  loneliness_score?: number;
  guilt_score?: number;
  hope_score?: number;
  urgency?: string;
  conversation_depth?: number;
}

interface IdentityData {
  changed: boolean;
  language?: string;
  country?: string;
  age_range?: string;
  convert_status?: string;
  generation?: string;
  communication_style?: string;
}

function filterResponse(text: string): string {
  // Protected words - never remove these
  const protected_words: string[] = [];
  const protectedPattern = /\b([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*|Allah|Quran|Islam|Muslim|Monir|deldor)\b/g;

  let processed = text;
  let i = 0;
  processed = processed.replace(protectedPattern, (match) => {
    protected_words.push(match);
    return `__${i++}__`;
  });

  // Filter character by character
  const filtered = Array.from(processed).filter(char => {
    const cp = char.codePointAt(0)!;
    return (
      // Whitespace
      cp === 0x09 || cp === 0x0A || cp === 0x0D || cp === 0x20 ||
      // ASCII digits 0-9
      (cp >= 0x30 && cp <= 0x39) ||
      // ASCII punctuation (no A-Z, no a-z)
      (cp >= 0x21 && cp <= 0x2F) ||
      (cp >= 0x3A && cp <= 0x40) ||
      (cp >= 0x5B && cp <= 0x60) ||
      (cp >= 0x7B && cp <= 0x7E) ||
      // Persian/Arabic + supplements
      (cp >= 0x0600 && cp <= 0x06FF) ||
      (cp >= 0x0750 && cp <= 0x077F) ||
      (cp >= 0x08A0 && cp <= 0x08FF) ||
      (cp >= 0xFB50 && cp <= 0xFDFF) ||
      (cp >= 0xFE70 && cp <= 0xFEFF) ||
      (cp >= 0x2000 && cp <= 0x206F) ||
      (cp >= 0x2600 && cp <= 0x27BF) ||
      (cp >= 0x1F300 && cp <= 0x1FAFF) ||
      (cp >= 0xFE00 && cp <= 0xFE0F)
    );
  }).join('');

  // Restore protected words
  let result = filtered;
  protected_words.forEach((word, idx) => {
    result = result.replace(`__${idx}__`, word);
  });

  return result
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Merge two string arrays without duplicates, capped at max items
function mergeUnique(existing: string[] | undefined, incoming: string[] | undefined, max: number): string[] | undefined {
  if (!incoming?.length) return existing;
  if (!existing?.length) return incoming.slice(0, max);
  const seen = new Set(existing);
  const merged = [...existing, ...incoming.filter(i => !seen.has(i))];
  return merged.slice(0, max);
}

// Inject a 7-day check-in reminder into the system prompt if due
function getCheckinContext(profile: Record<string, any>): { checkinInjection: string; shouldUpdateCheckin: boolean } {
  if (!profile.last_checkin) return { checkinInjection: '', shouldUpdateCheckin: false };

  const daysSince = Math.floor(
    (Date.now() - new Date(profile.last_checkin).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysSince < 7) return { checkinInjection: '', shouldUpdateCheckin: false };

  const struggles: string[] = profile.recurring_struggles ?? [];
  const moments: string[]   = profile.breakthrough_moments ?? [];
  const topics: string[]    = profile.topic_tags ?? [];

  // Most recent memorable item to reference
  const ref = struggles.at(-1) ?? moments.at(-1) ?? topics.at(0);
  if (!ref) return { checkinInjection: '', shouldUpdateCheckin: false };

  const checkinInjection =
    `\n【چک‌این ${daysSince} روزه — اجرای فوری】\n` +
    `در اولین جمله‌ات، قبل از هر چیز دیگه‌ای، دقیقاً این رو بپرس:\n` +
    `«یادته یه بار از "${ref}" حرف زدی؟ این روزا چطوری؟»\n` +
    `صبر کن جواب بده — شاید حلش کرده، شاید عمیق‌تر شده.\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  return { checkinInjection, shouldUpdateCheckin: true };
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
  if (profile.name)                        lines.push(`• اسم: ${profile.name}`);
  if (profile.gender)                      lines.push(`• جنسیت: ${profile.gender}`);
  if (profile.emotional_state)             lines.push(`• وضعیت احساسی اخیر: ${profile.emotional_state}`);
  if (profile.religiosity_level)           lines.push(`• سطح دینداری: ${profile.religiosity_level}`);
  if (profile.spiritual_journey_stage)     lines.push(`• مرحله سفر معنوی: ${profile.spiritual_journey_stage}`);
  if (profile.topic_tags?.length)          lines.push(`• موضوعاتی که قبلاً مطرح کرده: ${profile.topic_tags.join('، ')}`);
  if (profile.recurring_struggles?.length) lines.push(`• مشکلات تکرارشونده: ${profile.recurring_struggles.join('، ')}`);
  if (profile.breakthrough_moments?.length) lines.push(`• لحظات پیشرفت: ${profile.breakthrough_moments.join('، ')}`);
  if (!lines.length) return '';
  return [
    '【اطلاعات ذخیره‌شده از مکالمات قبلی این کاربر】',
    ...lines,
    'از این اطلاعات برای شخصی‌سازی لحن و پاسخ‌هایت استفاده کن — نیازی نیست دوباره بپرسی.',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
  ].join('\n');
}

function repairShortQuery(message: string, history: Array<{ role: string; content: string }>): string {
  const trimmed = message.trim();
  const isShort = trimmed.length < 15;
  const isAmbiguous = !trimmed.includes(' ') || (trimmed.endsWith('؟') && trimmed.length < 10);

  if (isShort && isAmbiguous && history.length > 0) {
    const lastUserMsg = [...history].reverse().find(h => h.role === 'user');
    if (lastUserMsg && lastUserMsg.content !== message) {
      const lastTopic = lastUserMsg.content.slice(0, 40).replace(/\n/g, ' ').trim();
      return `[کاربر در ادامه مکالمه‌ای که درباره "${lastTopic}..." بود پرسید: "${message}"]`;
    }
  }
  return message;
}

function classifyIntent(message: string, history: Array<{ role: string; content: string }>): { type: string; maxTokens: number; temperature: number } {
  const identityCrisisKeywords = ['نمی‌دونم کیم', 'گم شدم', 'دیگه نمی‌دونم', 'کی هستم'];
  const emotionalKeywords = [
    'تنهام', 'افسرده', 'گریه', 'دردم', 'فوت', 'مرد', 'از دست دادم',
    'نمی‌تونم', 'خسته', 'ناامید', 'بدم میاد از خودم', 'شرم',
  ];
  const factualKeywords = [
    'اذان', 'نماز چند', 'زکات', 'ساعت', 'تاریخ', 'چطور محاسبه',
    'چقدر', 'کجا', 'چه روزی', 'چه وقت',
  ];

  if (identityCrisisKeywords.some(k => message.includes(k)))
    return { type: 'identity_crisis', maxTokens: 150, temperature: 0.7 };
  if (emotionalKeywords.some(k => message.includes(k)))
    return { type: 'emotional', maxTokens: 200, temperature: 0.8 };
  if (factualKeywords.some(k => message.includes(k)))
    return { type: 'factual', maxTokens: 100, temperature: 0.2 };
  return { type: 'general', maxTokens: 300, temperature: 0.7 };
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
    
// Safety Check — اول از همه بحران رو چک کن
  const safetyResult = safetyCheck(message)
  if (safetyResult === 'CRISIS') {
    return NextResponse.json({ reply: CRISIS_RESPONSE })
  }
  if (safetyResult === 'EXTREMISM') {
    return NextResponse.json({ 
      reply: 'برادرم، این مسیر نیست. بگو چه دردی داری — گوش می‌دم.' 
    })
  }

    if (!message) {
      return NextResponse.json({ error: 'message الزامی' }, { status: 400 });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const supabase = getSupabase();

    const today     = new Date().toISOString().split('T')[0];
    const sessionId = `${userId}_${sessionStartTime.replace(/\D/g, '').slice(2, 16)}`;
    const timezone  = request.headers.get('cf-timezone') ?? request.headers.get('x-timezone') ?? null;
    const ipCountry = request.headers.get('x-vercel-ip-country') ?? null;
    const ipCity    = request.headers.get('x-vercel-ip-city')    ?? null;

    // --- لیمیت + پروفایل + تاریخچه + هویت در parallel ---
    const [countResult, profileResult, historyResult, identityResult] = await Promise.all([
      supabase.from('message_counts').select('count').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('conversations').select('role, content').eq('user_id', userId)
        .in('role', ['user', 'assistant']).order('created_at', { ascending: false }).limit(10),
      supabase.from('user_identity').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    if (countResult.error)   console.error('[supabase] message_counts:', countResult.error.message);
    if (profileResult.error) console.error('[supabase] user_profiles:', profileResult.error.message);
    if (historyResult.error) console.error('[supabase] conversations:', historyResult.error.message);
    if (identityResult.error) console.error('[supabase] user_identity:', identityResult.error.message);

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

    const { checkinInjection, shouldUpdateCheckin } = getCheckinContext(currentProfile);
    const intent = classifyIntent(message, history);
    const intentNote = `\n[نوع پیام: ${intent.type} — قوانین مربوطه را اجرا کن]\n`;
    const systemFinal = buildProfileContext(currentProfile) + checkinInjection + intentNote + SYSTEM_PROMPT;

    const repairedMessage = repairShortQuery(message, history);
    const groqMessages = [
      ...history.map((h: any) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: repairedMessage },
    ];

    // ۱. جواب اصلی (Groq → Gemini fallback)
    let reply: string;
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemFinal }, ...groqMessages],
        max_tokens: intent.maxTokens,
        temperature: intent.temperature,
      });
      reply = filterResponse(completion.choices[0]?.message?.content || 'لحظه‌ای صبر کن...');
    } catch (err: any) {
      if (err?.status !== 429 && err?.status !== 503 && err?.status !== 529) throw err;
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const gemini = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', systemInstruction: systemFinal });
      const chat = gemini.startChat({ history: buildGeminiHistory(groqMessages.slice(0, -1)) });
      const result = await chat.sendMessage(message);
      reply = filterResponse(result.response.text() || 'لحظه‌ای صبر کن...');
    }

    // ۲. استخراج‌های parallel با مدل سبک‌تر (بعد از reply تا rate-limit نخوریم)
    const currentIdentity: Record<string, any> = identityResult.data ?? {};
    const identityIsComplete = !!(currentIdentity.language && currentIdentity.communication_style && currentIdentity.convert_status);

    const [profileSettled, metadataSettled, identitySettled] = await Promise.allSettled([

      // ── پروفایل: حافظه بلندمدت کاربر ──────────────────────────────────────
      (async (): Promise<ProfileData | null> => {
        const profileCtx: Record<string, unknown> = {};
        if (currentProfile.emotional_state)              profileCtx.emotional_state = currentProfile.emotional_state;
        if (currentProfile.topic_tags?.length)           profileCtx.topic_tags = currentProfile.topic_tags;
        if (currentProfile.recurring_struggles?.length)  profileCtx.recurring_struggles = currentProfile.recurring_struggles;
        if (currentProfile.breakthrough_moments?.length) profileCtx.breakthrough_moments = currentProfile.breakthrough_moments;
        if (currentProfile.spiritual_journey_stage)      profileCtx.spiritual_journey_stage = currentProfile.spiritual_journey_stage;
        const currentSummary = Object.keys(profileCtx).length
          ? `\n\nپروفایل فعلی:\n${JSON.stringify(profileCtx)}`
          : '';
        const res = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: PROFILE_EXTRACT_PROMPT + currentSummary },
            { role: 'user', content: message },
          ],
          max_tokens: 300,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });
        const raw = res.choices[0]?.message?.content || '{"changed":false}';
        const parsed: ProfileData = JSON.parse(raw);
        return parsed.changed ? parsed : null;
      })(),

      // ── metadata: اسکور کمّی هر تبادل ──────────────────────────────────────
      (async (): Promise<MetadataData | null> => {
        const res = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: METADATA_EXTRACT_PROMPT },
            { role: 'user', content: `کاربر: ${message}\nمنیر: ${reply}` },
          ],
          max_tokens: 200,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });
        const raw = res.choices[0]?.message?.content || '{}';
        return JSON.parse(raw) as MetadataData;
      })(),

      // ── هویت: فقط وقتی پروفایل هنوز کامل نشده ──────────────────────────────
      (async (): Promise<IdentityData | null> => {
        if (identityIsComplete) return null;
        const res = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: IDENTITY_EXTRACT_PROMPT },
            { role: 'user', content: message },
          ],
          max_tokens: 150,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });
        const raw = res.choices[0]?.message?.content || '{"changed":false}';
        const parsed = JSON.parse(raw) as IdentityData;
        return parsed.changed ? parsed : null;
      })(),
    ]);

    const newProfileData  = profileSettled.status  === 'fulfilled' ? profileSettled.value  : null;
    const newMetadata     = metadataSettled.status  === 'fulfilled' ? metadataSettled.value  : null;
    const newIdentityData = identitySettled.status  === 'fulfilled' ? identitySettled.value  : null;

    if (profileSettled.status  === 'rejected') console.error('[profile]',  (profileSettled  as any).reason?.message);
    if (metadataSettled.status === 'rejected') console.error('[metadata]', (metadataSettled as any).reason?.message);
    if (identitySettled.status === 'rejected') console.error('[identity]', (identitySettled as any).reason?.message);
    else console.log('[profile] extracted:', JSON.stringify(newProfileData));

    const now = new Date().toISOString();

    // --- ذخیره در Supabase ---
    const saveResults = await Promise.all([
      supabase.from('conversations').insert({ user_id: userId, role: 'user',      content: message }),
      supabase.from('conversations').insert({ user_id: userId, role: 'assistant', content: reply }),
      supabase.from('message_counts').upsert(
        { user_id: userId, date: today, count: todayCount + 1 },
        { onConflict: 'user_id,date' }
      ),
      supabase.rpc('prune_conversations', { p_user_id: userId, p_keep: 40 }),
    ]);

    (saveResults as Array<{ error?: { message: string } | null }>).forEach((r, i) => {
      if (r?.error) console.error(`[supabase] save[${i}]:`, r.error.message);
    });

    // ── conversation_metadata: اسکور کمّی این تبادل ─────────────────────────
    if (newMetadata && Object.keys(newMetadata).length > 0) {
      const clamp = (v: unknown, lo: number, hi: number): number | undefined => {
        const n = typeof v === 'number' ? Math.round(v) : undefined;
        return n !== undefined ? Math.max(lo, Math.min(hi, n)) : undefined;
      };
      supabase.from('conversation_metadata').insert({
        user_id:            userId,
        session_id:         sessionId,
        topic:              newMetadata.topic              ?? null,
        subtopic:           newMetadata.subtopic           ?? null,
        emotional_state:    newMetadata.emotional_state    ?? null,
        anxiety_score:      clamp(newMetadata.anxiety_score,     0, 10),
        loneliness_score:   clamp(newMetadata.loneliness_score,  0, 10),
        guilt_score:        clamp(newMetadata.guilt_score,       0, 10),
        hope_score:         clamp(newMetadata.hope_score,        0, 10),
        urgency:            newMetadata.urgency            ?? null,
        conversation_depth: clamp(newMetadata.conversation_depth, 1, 5),
      }).then(({ error }) => { if (error) console.error('[meta insert]', error.message); });
    }

    // ── user_identity: هویت دموگرافیک (fire-and-forget) ─────────────────────
    if (newIdentityData || (!currentIdentity.user_id)) {
      const { changed: _c, ...identityFields } = newIdentityData ?? { changed: false };
      const identityMerged: Record<string, any> = {
        ...currentIdentity,
        ...identityFields,
        user_id:    userId,
        updated_at: now,
        // زبان از detectLanguage قابل اطمینان‌تر از LLM هست
        language:   currentIdentity.language ?? (identityFields as any).language ?? languageDetected,
        // جنسیت از user_profiles میاد
        gender:     currentProfile.gender    ?? currentIdentity.gender ?? null,
        // timezone از request header
        timezone:   currentIdentity.timezone ?? timezone ?? null,
        country:    ipCountry ?? currentIdentity.country ?? (identityFields as any).country ?? null,
        city:       ipCity    ?? currentIdentity.city    ?? null,
      };
      supabase.from('user_identity')
        .upsert(identityMerged, { onConflict: 'user_id' })
        .then(({ error }) => { if (error) console.error('[identity upsert]', error.message); });
    }

    if (newProfileData || shouldUpdateCheckin || !currentProfile.last_checkin) {
      const extracted = newProfileData
        ? Object.fromEntries(Object.entries(newProfileData).filter(([k]) => k !== 'changed'))
        : {};

      const merged: Record<string, any> = {
        ...currentProfile,
        ...extracted,
        user_id:    userId,
        updated_at: now,
        // last_checkin: set on first message; only refreshed when 7-day checkin fires
        last_checkin: (!currentProfile.last_checkin || shouldUpdateCheckin)
          ? now
          : currentProfile.last_checkin,
        // Arrays: merge new items into existing, no duplicates, capped
        topic_tags:           mergeUnique(currentProfile.topic_tags,           (extracted as any).topic_tags,           10),
        recurring_struggles:  mergeUnique(currentProfile.recurring_struggles,  (extracted as any).recurring_struggles,   6),
        breakthrough_moments: mergeUnique(currentProfile.breakthrough_moments, (extracted as any).breakthrough_moments,  6),
      };

      if (!merged.summary) {
        const parts: string[] = [];
        if (merged.name)                    parts.push(`اسم: ${merged.name}`);
        if (merged.gender)                  parts.push(`جنسیت: ${merged.gender}`);
        if (merged.emotional_state)         parts.push(`احساس: ${merged.emotional_state}`);
        if (merged.religiosity_level)       parts.push(`دینداری: ${merged.religiosity_level}`);
        if (merged.spiritual_journey_stage) parts.push(`مرحله: ${merged.spiritual_journey_stage}`);
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
