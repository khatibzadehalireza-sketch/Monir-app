import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { getSupabase } from '@/lib/supabase';
import { extractEmotionScores } from '@/lib/extractEmotions';

const WESTERN_COUNTRIES     = new Set(['NL','DE','FR','GB','BE','IT','ES','SE','NO','DK','AT','CH','US','CA','AU','NZ']);
const TRADITIONAL_COUNTRIES = new Set(['TR','PK','BD','ID','SA','AE','EG','MA','NG','IR','IQ','SY','JO','KW','QA','BH','OM','TN','DZ','LY','SN','ML','GH','ET','SO','YE','AF','UZ','KZ','TJ','AZ']);

function getCountryTone(code: string | null): 'western' | 'traditional' | null {
  if (!code) return null;
  if (WESTERN_COUNTRIES.has(code))     return 'western';
  if (TRADITIONAL_COUNTRIES.has(code)) return 'traditional';
  return null;
}

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

const SYSTEM_PROMPT = `تو منیر هستی — یک حضور گرم و هوشمند، نه یک چت‌بات.
دوستی مسلمان و آگاه که کنار کاربر می‌نشیند، گوش می‌دهد و با قلب پاسخ می‌دهد.

══════════════════════════════
قانون اول — قبل از هر پاسخ تشخیص بده
══════════════════════════════

پیش از نوشتن هر جمله‌ای، سه چیز را در ذهن مشخص کن:
۱. وضعیت احساسی کاربر: بحران / غمگین / خسته / سوال / عادی / شاد
۲. نیاز واقعی پشت پیام: می‌خواهد شنیده شود — می‌خواهد راه‌حل — می‌خواهد اطلاعات
۳. چه چیزی نگفته: درد پنهان، ترس ناگفته، یا چیزی که نیمه رها کرده

پاسخ را بر اساس این سه بنویس، نه بر اساس کلمات ظاهری پیام.

══════════════════════════════
قانون دوم — طول پاسخ
══════════════════════════════

بحران: ۱-۲ جمله — فقط حضور، هیچ توصیه‌ای
غمگین/خسته: ۲-۳ جمله + یک سوال عمیق
سوال دینی: حداکثر ۵ جمله
روزمره/عادی: ۲-۳ جمله
هرگز بیش از ۵ جمله. هرگز لیست، هدر، یا فرمت markdown.

══════════════════════════════
قانون سوم — آیات قرآن و احادیث
══════════════════════════════

فقط وقتی واقعاً معنادار است — نه به عنوان پرکننده.
همیشه با ترجمه فارسی کوتاه همراه باشد.
اگر آیه‌ای به ذهن می‌رسد که «شاید مرتبط باشد» — نیاور. فقط وقتی مستقیم به قلب موضوع می‌زند.

══════════════════════════════
قانون چهارم — خطاب و زبان
══════════════════════════════

- همیشه کاربر را با اسمش خطاب کن — هرگز «برادرم» یا «خواهرم» استفاده نکن
- اگر اسم کاربر مشخص نیست، بدون خطاب شروع کن
- لحن: فارسی گرم و طبیعی، مثل یک دوست قدیمی — نه رسمی، نه مشاورانه
- اگر کاربر به عربی، ترکی یا اردو نوشت، به همان زبان پاسخ بده

══════════════════════════════
قانون پنجم — سوال
══════════════════════════════

فقط یک سوال در هر پیام — نه بیشتر.
سوال باید عمیق باشد، نه سطحی:
✅ «آخرین باری که واقعاً آروم بودی کِی بود؟»
❌ «چطوری؟»
اگر پاسخ کامل است و سوالی لازم نیست — سوال نپرس.

══════════════════════════════
قانون ششم — خطوط قرمز
══════════════════════════════

هرگز:
- حکم شرعی قطعی صادر نکن
- تشخیص پزشکی یا روانشناختی نده
- قضاوت نکن — نه آشکار، نه پنهان
- «این احساس طبیعیه» یا «همه این رو دارن» — این جمله‌ها درد را کوچک می‌کنند
- برای دردهای عمیق راه‌حل سریع نده
- «شاید به این دلیل باشه که...» — فرضیه‌سازی بدون اجازه
- دو مشکل کاربر را به هم وصل کنی مگر خودش گفته

══════════════════════════════
قانون هفتم — حافظه و رشد
══════════════════════════════

اسم کاربر و موضوعاتی که در مکالمه مطرح کرده را به یاد بیاور.
اگر رشد یا تغییری در کاربر می‌بینی، آن را به آرامی منعکس کن:
«یادمه چند وقت پیش از این حرف می‌زدی — الان یه جور دیگه‌ای باهاش کنار میای.»

══════════════════════════════
قانون طلایی
══════════════════════════════

قبل از نوشتن، از خودت بپرس:
«یک دوست مسلمان عاقل و دلسوز، الان به این آدم چه می‌گفت؟»
آن را بنویس — نه بیشتر، نه کمتر.`;

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

- prayer_status: وضعیت نماز — یکی از: regular | irregular | not_praying | learning
  (فقط اگه کاربر صریحاً یا ضمنی از نماز خواندن یا نخواندنش گفته)

- family_status: وضعیت خانوادگی — یکی از: single | married | divorced | widowed | with_family | away_from_family
  (فقط اگه از مکالمه مشخص باشه)

- summary: خلاصه یک‌خطی پروفایل، حداکثر ۲۰۰ کاراکتر

قانون خروجی:
اگه هیچ چیز واقعی تغییر نکرده: {"changed": false}
در غیر این صورت: {"changed": true, ...فقط فیلدهایی که واقعاً آپدیت شدن}`;

// استخراج metadata کمّی از هر تبادل کاربر ↔ منیر
const METADATA_EXTRACT_PROMPT = `تحلیل‌گر رفتاری هستی. از تبادل زیر، فیلدهای ساختاریافته رو به JSON برگردون.

فیلدها:
- main_topic: موضوع اصلی — یکی از: خانواده | ازدواج | تنهایی | اضطراب | افسردگی | ایمان | هویت | کار | تحصیل | سوگ | خشم | روابط | سلامت | خودارزیابی | سایر
- sub_topic: موضوع جزئی‌تر، حداکثر ۳ کلمه فارسی
- emotional_state: یکی از: آرام | ناراحت | مضطرب | افسرده | عصبانی | امیدوار | گیج | آسیب‌پذیر | بحران
- anxiety_score: عدد صحیح ۰ تا ۱۰ (شدت اضطراب)
- loneliness_score: عدد صحیح ۰ تا ۱۰ (شدت تنهایی)
- guilt_score: عدد صحیح ۰ تا ۱۰ (شدت احساس گناه)
- hope_score: عدد صحیح ۰ تا ۱۰ (میزان امید)
- urgency: low | medium | high | critical
- session_depth: عدد صحیح ۱ تا ۵ (۱=سطحی، ۵=بحران عمیق/بیان درد شدید)

فقط JSON خالص بدون توضیح اضافه.`;

// استخراج خلاصه کل جلسه — یک رکورد در conversation_metadata
const SESSION_SUMMARY_PROMPT = `تحلیل‌گر جلسه هستی. کل مکالمه زیر را بررسی کن و خلاصه جلسه را به JSON برگردون.

فیلدها:
- main_topic: موضوع اصلی — یکی از: خانواده | ازدواج | تنهایی | اضطراب | افسردگی | ایمان | هویت | کار | تحصیل | سوگ | خشم | روابط | سلامت | خودارزیابی | سایر
- sub_topic: موضوع جزئی‌تر، حداکثر ۳ کلمه فارسی
- dominant_emotions: آرایه احساسات غالب (حداکثر ۳)
- emotion_intensity: آبجکت JSON از احساس → شدت (۰.۰ تا ۱.۰)
- emotional_volatility: low | medium | high
- semantic_topics: آرایه موضوعات معنایی (حداکثر ۵)
- urgency: low | medium | high | critical
- session_depth: عدد صحیح ۱ تا ۵ (۱=سطحی، ۵=بحران عمیق)

فقط JSON خالص بدون توضیح.`;

// استخراج رویدادهای مهم زندگی — ذخیره در life_events
const LIFE_EVENT_EXTRACT_PROMPT = `از پیام کاربر، رویدادهای مهم زندگی رو استخراج کن.
فقط اگه یک رویداد مشخص و مهم ذکر شده باشه — مثل: مرگ عزیزان، طلاق، مهاجرت، بیماری جدی، از دست دادن شغل، ازدواج، تولد فرزند، پایان رابطه، بحران مالی.

اگه هیچ رویداد مهمی نیست: {"detected": false}

در غیر این صورت:
{
  "detected": true,
  "event_type": "نوع رویداد به فارسی، حداکثر ۴ کلمه",
  "event_year": عدد سال میلادی یا null (سال فعلی: 2026 — «سال پیش» یعنی 2025),
  "impact_on_faith": عدد صحیح -3 تا +3 (منفی=ایمان ضعیف‌تر، مثبت=ایمان قوی‌تر، 0=نامشخص),
  "description": "خلاصه یک‌جمله‌ای از رویداد",
  "current_life_pressure": "فشار فعلی ناشی از این رویداد (اگه مشخص باشه، وگرنه null)",
  "support_network": "شبکه حمایتی که ذکر شده (اگه مشخص باشه، وگرنه null)"
}

فقط JSON خالص بدون توضیح.`;

// نسخه پویا با سال جاری و فیلد emotional_impact
function buildLifeEventPrompt(currentYear: number): string {
  const lastYear = currentYear - 1;
  return `از مکالمه زیر، رویدادهای مهم زندگی رو استخراج کن.
فقط اگه یک رویداد مشخص و مهم ذکر شده باشه — مثل: مرگ عزیزان، طلاق، مهاجرت، بیماری جدی، از دست دادن شغل، ازدواج، تولد فرزند، پایان رابطه، بحران مالی، جدایی از خانواده.
کاربر ممکنه به فارسی، عربی، ترکی، اردو یا انگلیسی صحبت کنه — همان زبان را تشخیص بده.

اگه هیچ رویداد مهمی نیست: {"detected": false}

در غیر این صورت:
{
  "detected": true,
  "event_type": "نوع رویداد به زبان کاربر، حداکثر ۴ کلمه",
  "event_year": عدد سال میلادی یا null (سال فعلی: ${currentYear} — «سال پیش» یعنی ${lastYear}),
  "impact_on_faith": عدد صحیح -3 تا +3 (منفی=ایمان ضعیف‌تر، مثبت=ایمان قوی‌تر، 0=نامشخص),
  "emotional_impact": عدد صحیح 1 تا 10 (شدت تأثیر احساسی کلی — 1=کم، 10=بسیار شدید),
  "description": "خلاصه یک‌جمله‌ای از رویداد",
  "current_life_pressure": "فشار فعلی ناشی از این رویداد (اگه مشخص باشه، وگرنه null)",
  "support_network": "شبکه حمایتی که ذکر شده (اگه مشخص باشه، وگرنه null)"
}

فقط JSON خالص بدون توضیح.`;
}

interface LifeEventData {
  detected: boolean;
  event_type?: string;
  event_year?: number | null;
  impact_on_faith?: number;
  emotional_impact?: number;
  description?: string;
  current_life_pressure?: string | null;
  support_network?: string | null;
}

// تشخیص «ناگفته‌ها» — موضوعات فراری، جمله‌های ناتمام، کلمات جایگزین سبک‌تر
const UNSAID_DETECT_PROMPT = `تحلیل‌گر ناگفته‌ها هستی. تاریخچه کوتاه مکالمه و پیام آخر کاربر را بررسی کن.

فقط اگه یکی از موارد زیر را واقعاً تشخیص دادی جواب بده، وگرنه {"detected": false} برگردون:

۱. avoided_topics: موضوعی که منیر مطرح کرد ولی کاربر ازش فرار کرد یا تغییر موضوع داد
۲. half_mentioned: جمله‌ای که شروع شد ولی ناتمام موند («یه چیزی هست ولی...»، «نمی‌خوام بگم»، «مهم نیست»)
۳. softened_words: کلمه‌ای که جای کلمه سنگین‌تری نشسته («خسته» به جای «افسرده»، «یکم ناراحتم» به جای «خیلی دردناکه»، «مشکل کوچیکی دارم» به جای بحران)

اگه موردی تشخیص دادی:
{
  "detected": true,
  "avoided_topics": ["موضوع فراری — حداکثر ۲ تا"],
  "half_mentioned": ["اشاره مبهم یا جمله ناتمام — حداکثر ۲ تا"],
  "softened_words": [{"said": "کلمه گفته‌شده", "likely_meant": "منظور احتمالی"}]
}

فقط JSON خالص.`;

interface UnsaidData {
  detected: boolean;
  avoided_topics?: string[];
  half_mentioned?: string[];
  softened_words?: Array<{ said: string; likely_meant: string }>;
}

// تشخیص ریسک بحران — نشانه‌های ظریف که کلیدواژه‌های صریح نیستن
const SAFETY_RISK_DETECT_PROMPT = `تحلیل‌گر ریسک هستی. پیام کاربر رو برای نشانه‌های بحران بررسی کن — حتی وقتی صریح نگفته.

دسته‌بندی trigger_type:
- self_harm: «کاش نبودم»، «خسته از زندگی»، «به درد نمی‌خورم»، آرزوی مرگ غیرمستقیم، احساس بار بودن برای دیگران
- panic: وحشت شدید، «دارم دیوونه می‌شم»، احساس خفگی، از دست دادن کنترل
- isolation: «هیچکس نمی‌فهمه‌م»، «به کسی نمی‌تونم بگم»، قطع کامل از خانواده/دوستان
- grief: داغ تازه فلج‌کننده، «از وقتی رفت آدم نیستم»، از دست دادن معنا

سطح ریسک:
- critical: قصد صریح یا شبه‌صریح آسیب یا مرگ
- high: نشانه‌های قوی بدون بیان مستقیم (مثل «کاش نبودم»، «دیگه نمی‌تونم»)
- medium: نگرانی مشخص، نیاز به حمایت فعال
- low: غم/اضطراب معمول، بدون نشانه بحران

اگه پیام عادی‌ست یا هیچ نشانه‌ای نیست: {"detected": false}

در غیر این صورت:
{"detected": true, "risk_level": "low|medium|high|critical", "trigger_type": "self_harm|panic|isolation|grief", "confidence": 0.0-1.0, "reasoning": "یک جمله"}

فقط JSON خالص.`;

interface SafetyRiskData {
  detected: boolean;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  trigger_type?: 'self_harm' | 'panic' | 'isolation' | 'grief';
  confidence?: number;
  reasoning?: string;
}

interface SessionSummaryData {
  main_topic?: string;
  sub_topic?: string;
  dominant_emotions?: string[];
  emotion_intensity?: Record<string, number>;
  emotional_volatility?: string;
  semantic_topics?: string[];
  urgency?: string;
  session_depth?: number;
}

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
- family_status: single | married | divorced | widowed | with_family | away_from_family
  (فقط اگه از مکالمه واضح باشه)

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
  prayer_status?: string;
  family_status?: string;
}

interface MetadataData {
  main_topic?: string;
  sub_topic?: string;
  emotional_state?: string;
  anxiety_score?: number;
  loneliness_score?: number;
  guilt_score?: number;
  hope_score?: number;
  urgency?: string;
  session_depth?: number;
}

interface IdentityData {
  changed: boolean;
  language?: string;
  country?: string;
  age_range?: string;
  convert_status?: string;
  generation?: string;
  communication_style?: string;
  family_status?: string;
}

interface EmotionData {
  anxiety_score?: number;
  loneliness_score?: number;
  hope_score?: number;
  guilt_score?: number;
  dominant_emotion?: string;
  spiritual_state?: string;
  session_summary?: string;
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

function detectUserLanguage(message: string, storedLang?: string): 'fa' | 'ar' | 'tr' | 'ur' | 'en' {
  if (storedLang && ['fa', 'ar', 'tr', 'ur', 'en'].includes(storedLang)) {
    return storedLang as 'fa' | 'ar' | 'tr' | 'ur' | 'en';
  }
  // Turkish: Latin script with Turkish-specific characters
  if (/[ğşıüöçĞŞİÜÖÇ]/.test(message)) return 'tr';
  const arabicChars = (message.match(/[؀-ۿ]/g) || []).length;
  const total = message.replace(/\s/g, '').length;
  if (total > 0 && arabicChars / total > 0.3) {
    const persianSpecific = (message.match(/[پچژگ]/g) || []).length;
    const urduSpecific    = (message.match(/[ٹڈڑں]/g) || []).length;
    if (urduSpecific > persianSpecific) return 'ur';
    if (persianSpecific > 0)            return 'fa';
    return 'ar';
  }
  return 'en';
}

function buildLimitMessage(lang: 'fa' | 'ar' | 'tr' | 'ur' | 'en'): string {
  switch (lang) {
    case 'fa':
      return 'مولانا می‌گوید:\n«آتش عشق است کاندر نی فتاد — بی‌قراری‌ها از آن آتش بزاد»\n\nامروز به اندازه‌ای که سهم ما بود کنارت بودم. برای ادامه گفتگو می‌توانی پرو را فعال کنی.';
    case 'ar':
      return 'قال ابن عطاء الله السكندري:\n«ادفن وجودك في أرض الخمول، فما نبت مما لم يُدفن لا يتمّ نتاجه»\n\nحديثنا لهذا اليوم قد اكتمل. يمكنك تفعيل الاشتراك المميّز للمتابعة.';
    case 'tr':
      return 'Yunus Emre der ki:\n«Bir ben vardır bende, benden içeri»\n\nBugün paylaşacaklarımız bu kadardı, dostum. Devam etmek için pro sürümünü etkinleştirebilirsin.';
    case 'ur':
      return 'اقبال نے کہا:\n«تو شاہیں ہے، پرواز ہے کام تیرا\nترے سامنے آسماں اور بھی ہیں»\n\nآج کی ہماری گفتگو یہیں تک تھی۔ جاری رکھنے کے لیے پرو ورژن فعال کریں۔';
    case 'en':
      return 'Rumi once said:\n"Out beyond ideas of wrongdoing and rightdoing, there is a field. I\'ll meet you there."\n\nWe\'ve shared all we can for today, dear friend. You can activate pro to continue our journey.';
  }
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
  if (profile.prayer_status)                lines.push(`• وضعیت نماز: ${profile.prayer_status}`);
  if (profile.family_status)                lines.push(`• وضعیت خانوادگی: ${profile.family_status}`);
  if (!lines.length) return '';
  return [
    '【اطلاعات ذخیره‌شده از مکالمات قبلی این کاربر】',
    ...lines,
    'از این اطلاعات برای شخصی‌سازی لحن و پاسخ‌هایت استفاده کن — نیازی نیست دوباره بپرسی.',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
  ].join('\n');
}

function buildSubtleQuestionsHint(
  profile: Record<string, any>,
  identity: Record<string, any>,
): string {
  const missing: string[] = [];
  if (!identity.age_range)    missing.push('سن کاربر (ضمنی — نه مستقیم)');
  if (!identity.city)         missing.push('شهر محل سکونت');
  if (!profile.prayer_status) missing.push('وضعیت نماز');
  if (!identity.family_status && !profile.family_status) missing.push('وضعیت خانوادگی');
  if (!missing.length) return '';
  return (
    '\n【اطلاعات هنوز ناشناخته — وقتی موضوع طبیعی بود، یکی را بپرس】\n' +
    missing.map(m => `• ${m}`).join('\n') +
    '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
  );
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

const PRAYER_TIME_RE = /اذان|اوقات شرعی|وقت نماز|ساعت نماز|نماز.*ساعت|ساعت.*نماز/;

async function fetchPrayerTimes(city: string, country: string): Promise<Record<string, string> | null> {
  try {
    const url =
      `https://api.aladhan.com/v1/timingsByCity` +
      `?city=${encodeURIComponent(city)}` +
      `&country=${encodeURIComponent(country)}` +
      `&method=2`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.data?.timings as Record<string, string>) ?? null;
  } catch {
    return null;
  }
}

function buildPrayerContext(timings: Record<string, string>, city: string | null): string {
  const order = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const names: Record<string, string> = {
    Fajr: 'صبح', Sunrise: 'طلوع', Dhuhr: 'ظهر', Asr: 'عصر', Maghrib: 'مغرب', Isha: 'عشا',
  };
  const lines = order.filter(k => timings[k]).map(k => `${names[k]}: ${timings[k]}`).join(' | ');
  return (
    `\n【اوقات شرعی امروز${city ? ` — ${city}` : ''}】\n` +
    `${lines}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
  );
}

function mergeUnsaidPatterns(
  existing: Record<string, any> | undefined,
  incoming: UnsaidData,
): Record<string, any> {
  const base = existing ?? { avoided_topics: [], half_mentioned: [], softened_words: [] };

  const avoidedSet = new Set<string>(base.avoided_topics ?? []);
  (incoming.avoided_topics ?? []).forEach(t => avoidedSet.add(t));

  const halfSet = new Set<string>(base.half_mentioned ?? []);
  (incoming.half_mentioned ?? []).forEach(t => halfSet.add(t));

  const softenedMap = new Map<string, string>();
  (base.softened_words ?? []).forEach((sw: { said: string; likely_meant: string }) =>
    softenedMap.set(sw.said, sw.likely_meant));
  (incoming.softened_words ?? []).forEach(sw => softenedMap.set(sw.said, sw.likely_meant));

  return {
    avoided_topics: [...avoidedSet].slice(0, 10),
    half_mentioned: [...halfSet].slice(0, 6),
    softened_words: [...softenedMap.entries()]
      .map(([said, likely_meant]) => ({ said, likely_meant }))
      .slice(0, 8),
  };
}

function deriveWhatWorked(
  topic: string | undefined,
  hopeDelta: number | null,
  anxietyDelta: number | null,
): string | null {
  const improved = (hopeDelta ?? 0) > 0 || (anxietyDelta ?? 0) < 0;
  if (!improved) return null;
  if (topic === 'ایمان' || topic === 'هویت')           return 'تقویت ایمان و معنا';
  if (topic === 'سوگ'   || topic === 'خانواده')         return 'همدلی و حضور عاطفی';
  if (topic === 'اضطراب' || topic === 'افسردگی')        return 'شنیدن فعال و تایید احساسات';
  if (topic === 'تنهایی')                               return 'ایجاد احساس دیده‌شدن';
  if (topic === 'ازدواج' || topic === 'روابط')          return 'راهنمایی رابطه‌ای';
  return 'حضور همراه';
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

async function generateEmotionEmbedding(
  emotion: EmotionData,
  profile: Record<string, any>,
): Promise<number[] | null> {
  const parts: string[] = [];
  if (emotion.anxiety_score    != null) parts.push(`اضطراب: ${emotion.anxiety_score}/10`);
  if (emotion.loneliness_score != null) parts.push(`تنهایی: ${emotion.loneliness_score}/10`);
  if (emotion.hope_score       != null) parts.push(`امید: ${emotion.hope_score}/10`);
  if (emotion.guilt_score      != null) parts.push(`احساس گناه: ${emotion.guilt_score}/10`);
  if (emotion.dominant_emotion)         parts.push(`احساس غالب: ${emotion.dominant_emotion}`);
  if (emotion.spiritual_state)          parts.push(`وضعیت معنوی: ${emotion.spiritual_state}`);
  if (emotion.session_summary)          parts.push(emotion.session_summary);
  if (profile.recurring_struggles?.length)
    parts.push(`چالش‌ها: ${(profile.recurring_struggles as string[]).slice(0, 3).join(', ')}`);
  if (profile.topic_tags?.length)
    parts.push(`موضوعات: ${(profile.topic_tags as string[]).slice(0, 5).join(', ')}`);
  if (parts.length === 0) return null;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text: parts.join(' | ') }] },
    taskType: TaskType.SEMANTIC_SIMILARITY,
    outputDimensionality: 384,
  } as import('@google/generative-ai').EmbedContentRequest & { outputDimensionality: number });
  return result.embedding.values;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body.message;
    const userId = body.userId || 'guest';
    const sessionStartTime: string = body.sessionStartTime || new Date().toISOString();
    const sessionMessageCount: number = body.sessionMessageCount || 1;
    const userName: string | undefined = typeof body.userName === 'string' ? body.userName.trim() || undefined : undefined;
    const consentGiven: boolean | undefined = body.consentGiven === true ? true : undefined;
    const consentDate: string | undefined = typeof body.consentDate === 'string' ? body.consentDate : undefined;
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

    // --- لیمیت + پروفایل + تاریخچه + هویت + اوقات شرعی + before scores در parallel ---
    const isPrayerTimeQuery = PRAYER_TIME_RE.test(message);
    const isTasbihQuery     = /تسبیح|ذکر/u.test(message);
    const isAdhkarQuery     = /اذکار|اذکار صبح|اذکار شب|ذکر صبح|ذکر شب|ذکر بگم|ذکر بگویم|میخوام ذکر|می‌خوام ذکر|وقت ذکره|اوقات اذکار|adhkar|morning adhkar|evening adhkar|hisnulmuslim/i.test(message);
    const [countResult, profileResult, historyResult, identityResult, rawPrayerTimings, sessionBeforeResult, bpResult, existingLifeEventsResult] = await Promise.all([
      supabase.from('message_counts').select('count').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('conversations').select('role, content').eq('user_id', userId)
        .in('role', ['user', 'assistant']).order('created_at', { ascending: false }).limit(10),
      supabase.from('user_identity').select('*').eq('user_id', userId).maybeSingle(),
      isPrayerTimeQuery && ipCity
        ? fetchPrayerTimes(ipCity, ipCountry ?? '')
        : Promise.resolve(null),
      sessionMessageCount >= 5
        ? supabase.from('conversation_metadata')
            .select('before_hope, before_anxiety')
            .eq('session_id', sessionId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from('behavioral_patterns').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('life_events').select('event_type, event_year').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(30),
    ]);

    if (countResult.error)       console.error('[supabase] message_counts:', countResult.error.message);
    if (profileResult.error)     console.error('[supabase] user_profiles:', profileResult.error.message);
    if (historyResult.error)     console.error('[supabase] conversations:', historyResult.error.message);
    if (identityResult.error)    console.error('[supabase] user_identity:', identityResult.error.message);
    if ((sessionBeforeResult as any)?.error) console.error('[supabase] before_scores:', (sessionBeforeResult as any).error.message);
    if ((bpResult as any)?.error) console.error('[supabase] behavioral_patterns:', (bpResult as any).error.message);
    if ((existingLifeEventsResult as any)?.error) console.error('[supabase] life_events:', (existingLifeEventsResult as any).error.message);

    const beforeRow = (sessionBeforeResult as any)?.data as
      { before_hope: number | null; before_anxiety: number | null } | null;

    const countRow   = countResult.data;
    const profileRow = profileResult.data;
    const rawHistory = historyResult.data;

    const todayCount = countRow?.count ?? 0;

    if (todayCount >= 70) {
      const userLang = detectUserLanguage(message, identityResult.data?.language);
      return NextResponse.json({
        reply: buildLimitMessage(userLang),
        limitReached: true,
      });
    }

    const currentProfile: Record<string, any> = profileRow ?? {};
    const currentIdentity: Record<string, any> = identityResult.data ?? {};
    const currentBP: Record<string, any> | null = (bpResult as any).data ?? null;
    const existingLifeEvents: Array<{ event_type: string | null; event_year: number | null }> =
      (existingLifeEventsResult as any).data ?? [];
    const history = rawHistory ? [...rawHistory].reverse() : [];

    // اوقات شرعی: اگه ipCity نداشتیم، از شهر ذخیره‌شده در هویت استفاده کن
    const cityForPrayer    = ipCity    ?? currentIdentity.city    ?? null;
    const countryForPrayer = ipCountry ?? currentIdentity.country ?? '';
    let prayerTimings = rawPrayerTimings;
    if (isPrayerTimeQuery && !prayerTimings && cityForPrayer) {
      prayerTimings = await fetchPrayerTimes(cityForPrayer, countryForPrayer);
    }

    const { checkinInjection, shouldUpdateCheckin } = getCheckinContext(currentProfile);
    const intent = classifyIntent(message, history);
    const intentNote = `\n[نوع پیام: ${intent.type} — قوانین مربوطه را اجرا کن]\n`;
    const subtleHint    = buildSubtleQuestionsHint(currentProfile, currentIdentity);
    const prayerContext = prayerTimings ? buildPrayerContext(prayerTimings, cityForPrayer) : '';
    const nameHint      = userName
      ? `\n【اسم کاربر: ${userName} — همیشه از این اسم مستقیم استفاده کن، نه «برادرم» یا «خواهرم»】\n`
      : '';

    const lastSeen = currentIdentity.last_seen ? new Date(currentIdentity.last_seen) : null;
    const daysSinceSeen = lastSeen ? Math.floor((Date.now() - lastSeen.getTime()) / 86_400_000) : null;
    const freshStartNote = (daysSinceSeen !== null && daysSinceSeen >= 30)
      ? `\n【این کاربر ${daysSinceSeen} روز غایب بوده — با گرمی و بدون ارجاع به گذشته شروع کن، انگار اولین مکالمه‌ست】\n`
      : '';

    const _now = new Date();
    const dateContext =
      `\n【تاریخ و ساعت جاری: ${_now.toISOString().slice(0, 10)} — ${_now.toISOString().slice(11, 16)} UTC` +
      (timezone ? ` | منطقه زمانی کاربر: ${timezone}` : '') +
      `】\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    const countryTone = getCountryTone(request.headers.get('x-vercel-ip-country'));
    const countryToneNote = countryTone === 'western'
      ? '\nلحن تو شاعرانه، عمیق و عارفانه باشد. از شعر و استعاره استفاده کن.'
      : countryTone === 'traditional'
      ? '\nلحن تو صمیمی، مستقیم و کلاسیک اسلامی باشد.'
      : '';
    const systemFinal   = buildProfileContext(currentProfile) + prayerContext + nameHint + checkinInjection + subtleHint + intentNote + freshStartNote + dateContext + SYSTEM_PROMPT + countryToneNote;

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
    const identityIsComplete = !!(currentIdentity.language && currentIdentity.communication_style && currentIdentity.convert_status);

    const sessionMessages = [
      ...history,
      { role: 'user' as const,      content: message },
      { role: 'assistant' as const, content: reply   },
    ];

    const [profileSettled, metadataSettled, identitySettled, sessionSettled, emotionSettled, lifeEventSettled, unsaidSettled, safetyRiskSettled] = await Promise.allSettled([

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

      // ── خلاصه جلسه: کل تاریخچه جلسه را تحلیل می‌کند ──────────────────────
      (async (): Promise<SessionSummaryData | null> => {
        const sessionHistory = [
          ...history.map((h: any) => `${h.role === 'user' ? 'کاربر' : 'منیر'}: ${h.content}`),
          `کاربر: ${message}`,
          `منیر: ${reply}`,
        ].join('\n');
        const res = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: SESSION_SUMMARY_PROMPT },
            { role: 'user', content: sessionHistory },
          ],
          max_tokens: 250,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });
        const raw = res.choices[0]?.message?.content || '{}';
        return JSON.parse(raw) as SessionSummaryData;
      })(),

      // ── اسکور احساسی جلسه (extractEmotionScores از Gemini) ─────────────────
      extractEmotionScores(sessionMessages) as Promise<EmotionData | null>,

      // ── رویدادهای مهم زندگی ─────────────────────────────────────────────────
      (async (): Promise<LifeEventData | null> => {
        // Include recent conversation context so events spanning multiple messages are caught
        const lifeEventCtx = [
          ...history.slice(-5).map((h: any) =>
            `${h.role === 'user' ? 'کاربر' : 'منیر'}: ${h.content}`),
          `کاربر: ${message}`,
        ].join('\n');
        const res = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: buildLifeEventPrompt(new Date().getFullYear()) },
            { role: 'user',   content: lifeEventCtx },
          ],
          max_tokens: 250,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });
        const raw    = res.choices[0]?.message?.content || '{"detected":false}';
        const parsed = JSON.parse(raw) as LifeEventData;
        return parsed.detected ? parsed : null;
      })(),

      // ── ناگفته‌ها: فرار، جمله ناتمام، کلمه جایگزین ─────────────────────────
      (async (): Promise<UnsaidData | null> => {
        const recentCtx = [
          ...history.slice(-3).map((h: any) =>
            `${h.role === 'user' ? 'کاربر' : 'منیر'}: ${h.content}`),
          `کاربر: ${message}`,
        ].join('\n');
        const res = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: UNSAID_DETECT_PROMPT },
            { role: 'user',   content: recentCtx },
          ],
          max_tokens: 200,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });
        const raw    = res.choices[0]?.message?.content || '{"detected":false}';
        const parsed = JSON.parse(raw) as UnsaidData;
        return parsed.detected ? parsed : null;
      })(),

      // ── ریسک بحران: نشانه‌های ظریف در پیام کاربر ─────────────────────────
      (async (): Promise<SafetyRiskData | null> => {
        const res = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: SAFETY_RISK_DETECT_PROMPT },
            { role: 'user',   content: message },
          ],
          max_tokens: 150,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });
        const raw    = res.choices[0]?.message?.content || '{"detected":false}';
        const parsed = JSON.parse(raw) as SafetyRiskData;
        return parsed.detected ? parsed : null;
      })(),
    ]);

    const newProfileData    = profileSettled.status    === 'fulfilled' ? profileSettled.value    : null;
    const newMetadata       = metadataSettled.status   === 'fulfilled' ? metadataSettled.value   : null;
    const newIdentityData   = identitySettled.status   === 'fulfilled' ? identitySettled.value   : null;
    const newSessionSummary = sessionSettled.status    === 'fulfilled' ? sessionSettled.value    : null;
    const newEmotionData    = emotionSettled.status    === 'fulfilled' ? emotionSettled.value    : null;
    const newLifeEvent      = lifeEventSettled.status  === 'fulfilled' ? lifeEventSettled.value  : null;
    const newUnsaidData     = unsaidSettled.status     === 'fulfilled' ? unsaidSettled.value     : null;

    if (profileSettled.status    === 'rejected') console.error('[profile]',    (profileSettled    as any).reason?.message);
    if (metadataSettled.status   === 'rejected') console.error('[metadata]',   (metadataSettled   as any).reason?.message);
    if (identitySettled.status   === 'rejected') console.error('[identity]',   (identitySettled   as any).reason?.message);
    if (sessionSettled.status    === 'rejected') console.error('[session]',    (sessionSettled    as any).reason?.message);
    if (emotionSettled.status    === 'rejected') console.error('[emotion]',    (emotionSettled    as any).reason?.message);
    if (lifeEventSettled.status  === 'rejected') console.error('[life_event]', (lifeEventSettled  as any).reason?.message);
    if (unsaidSettled.status     === 'rejected') console.error('[unsaid]',     (unsaidSettled     as any).reason?.message);
    else console.log('[profile] extracted:', JSON.stringify(newProfileData));

    const newSafetyRisk = safetyRiskSettled.status === 'fulfilled' ? safetyRiskSettled.value : null;
    if (safetyRiskSettled.status === 'rejected') console.error('[safety_risk]', (safetyRiskSettled as any).reason?.message);

    // اگه ریسک high یا critical: منابع بحران رو به جواب اضافه کن
    if (newSafetyRisk?.detected && (newSafetyRisk.risk_level === 'high' || newSafetyRisk.risk_level === 'critical')) {
      reply += '\n\n—\n🌙 اگه این روزا سنگینه، کمک گرفتن شجاعانه‌ست:\n🇳🇱 هلند: 0800-0113 (رایگان، ۲۴ ساعته)';
    }

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
        main_topic:         newMetadata.main_topic         ?? null,
        sub_topic:          newMetadata.sub_topic          ?? null,
        emotional_state:    newMetadata.emotional_state    ?? null,
        anxiety_score:      clamp(newMetadata.anxiety_score,    0, 10),
        loneliness_score:   clamp(newMetadata.loneliness_score, 0, 10),
        guilt_score:        clamp(newMetadata.guilt_score,      0, 10),
        hope_score:         clamp(newMetadata.hope_score,       0, 10),
        urgency:            newMetadata.urgency            ?? null,
        session_depth:      clamp(newMetadata.session_depth,    1,  5),
      }).then(({ error }) => { if (error) console.error('[meta insert]', error.message); });
    }

    // ── conversation_metadata: خلاصه جلسه (upsert — یک رکورد در session_id) ──
    if (newEmotionData || newSessionSummary) {
      const clampF = (v: unknown, lo: number, hi: number): number | undefined => {
        const n = typeof v === 'number' ? Math.round(v) : undefined;
        return n !== undefined ? Math.max(lo, Math.min(hi, n)) : undefined;
      };

      // Intervention outcome deltas (only when we have both before and after)
      const afterHope    = clampF(newEmotionData?.hope_score,    0, 10) ?? null;
      const afterAnxiety = clampF(newEmotionData?.anxiety_score, 0, 10) ?? null;
      const hopeDelta    = sessionMessageCount >= 5 && beforeRow?.before_hope    != null && afterHope    != null
        ? afterHope    - beforeRow.before_hope    : null;
      const anxietyDelta = sessionMessageCount >= 5 && beforeRow?.before_anxiety != null && afterAnxiety != null
        ? afterAnxiety - beforeRow.before_anxiety : null;

      supabase.from('conversation_metadata').upsert({
        user_id:              userId,
        session_id:           sessionId,
        main_topic:           newSessionSummary?.main_topic          ?? null,
        sub_topic:            newSessionSummary?.sub_topic           ?? null,
        dominant_emotions:    newSessionSummary?.dominant_emotions   ?? null,
        emotion_intensity:    newSessionSummary?.emotion_intensity   ?? null,
        emotional_volatility: newSessionSummary?.emotional_volatility ?? null,
        semantic_topics:      newSessionSummary?.semantic_topics     ?? null,
        urgency:              newSessionSummary?.urgency             ?? null,
        session_depth:        clampF(newSessionSummary?.session_depth, 1, 5),
        message_count:        sessionMessageCount,
        // emotion scores (feature 3)
        anxiety_score:        clampF(newEmotionData?.anxiety_score,    0, 10),
        loneliness_score:     clampF(newEmotionData?.loneliness_score, 0, 10),
        hope_score:           clampF(newEmotionData?.hope_score,       0, 10),
        guilt_score:          clampF(newEmotionData?.guilt_score,      0, 10),
        dominant_emotion:     newEmotionData?.dominant_emotion  ?? null,
        spiritual_state:      newEmotionData?.spiritual_state   ?? null,
        session_summary:      newEmotionData?.session_summary   ?? null,
        // intervention outcomes — undefined fields are omitted by JSON.stringify → DB value preserved
        before_hope:    sessionMessageCount === 1 ? clampF(newEmotionData?.hope_score,    0, 10) : undefined,
        before_anxiety: sessionMessageCount === 1 ? clampF(newEmotionData?.anxiety_score, 0, 10) : undefined,
        after_hope:     sessionMessageCount >= 5  ? afterHope    ?? undefined : undefined,
        after_anxiety:  sessionMessageCount >= 5  ? afterAnxiety ?? undefined : undefined,
        hope_delta:     hopeDelta    != null ? hopeDelta    : undefined,
        anxiety_delta:  anxietyDelta != null ? anxietyDelta : undefined,
        what_worked:    sessionMessageCount >= 5
          ? deriveWhatWorked(newSessionSummary?.main_topic, hopeDelta, anxietyDelta) ?? undefined
          : undefined,
      }, { onConflict: 'session_id' })
        .then(({ error }) => { if (error) console.error('[session upsert]', error.message); });
    }

    // ── trajectory: snapshot ماهانه — یک رکورد در (user_id, month) ──────────
    {
      const currentMonth = new Date().toISOString().slice(0, 7); // "2026-05"
      const tHope      = newEmotionData?.hope_score      ?? null;
      const tAnxiety   = newEmotionData?.anxiety_score   ?? null;
      const tLonely    = newEmotionData?.loneliness_score ?? null;
      const reliText   = (newProfileData?.religiosity_level ?? currentProfile.religiosity_level) as string | undefined;
      const reliInt    = reliText === 'بالا' ? 3 : reliText === 'متوسط' ? 2 : reliText === 'پایین' ? 1 : null;
      const tTransform = (tHope !== null && tAnxiety !== null && tLonely !== null)
        ? Math.round((tHope - (tAnxiety + tLonely) / 2) * 10) / 10
        : null;

      if (tHope !== null || tAnxiety !== null || tLonely !== null) {
        supabase.from('trajectory').upsert({
          user_id:              userId,
          month:                currentMonth,
          hope_score:           tHope,
          anxiety_score:        tAnxiety,
          loneliness_score:     tLonely,
          prayer_status:        newProfileData?.prayer_status ?? currentProfile.prayer_status ?? null,
          religiosity_level:    reliInt,
          transformation_score: tTransform,
        }, { onConflict: 'user_id,month' })
          .then(({ error }) => { if (error) console.error('[trajectory upsert]', error.message); });
      }
    }

    // ── life_events: رویداد مهم زندگی (insert — هر رویداد یک رکورد جدید) ──────
    if (newLifeEvent) {
      // Deduplication: skip if same event_type + year already recorded for this user
      const isDuplicateLifeEvent = existingLifeEvents.some(
        e => e.event_type === newLifeEvent.event_type &&
             (e.event_year === newLifeEvent.event_year || newLifeEvent.event_year == null),
      );
      if (!isDuplicateLifeEvent) {
        supabase.from('life_events').insert({
          user_id:               userId,
          event_type:            newLifeEvent.event_type            ?? null,
          event_year:            newLifeEvent.event_year            ?? null,
          impact_on_faith:       newLifeEvent.impact_on_faith       ?? 0,
          emotional_impact:      newLifeEvent.emotional_impact      ?? null,
          description:           newLifeEvent.description           ?? null,
          current_life_pressure: newLifeEvent.current_life_pressure ?? null,
          support_network:       newLifeEvent.support_network       ?? null,
        }).then(({ error }) => { if (error) console.error('[life_event insert]', error.message); });
      }
    }

    // ── user_identity: هویت دموگرافیک (fire-and-forget) ─────────────────────
    if (newIdentityData || (!currentIdentity.user_id) || (consentGiven && !currentIdentity.consent_given) || sessionMessageCount === 1) {
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
        country:       ipCountry ?? currentIdentity.country ?? (identityFields as any).country ?? null,
        city:          ipCity    ?? currentIdentity.city    ?? null,
        consent_given: consentGiven ?? currentIdentity.consent_given ?? undefined,
        consent_date:  consentGiven ? (consentDate ?? currentIdentity.consent_date ?? null) : (currentIdentity.consent_date ?? undefined),
        last_seen:     now,
        // Return rate tracking — only increment on the first message of each session
        total_sessions: sessionMessageCount === 1
          ? (currentIdentity.total_sessions ?? 0) + 1
          : (currentIdentity.total_sessions ?? 0),
        day7_return: (currentIdentity.day7_return === true ||
          (sessionMessageCount === 1 && daysSinceSeen !== null && daysSinceSeen >= 6 && daysSinceSeen <= 8))
          ? true : (currentIdentity.day7_return ?? null),
        day30_return: (currentIdentity.day30_return === true ||
          (sessionMessageCount === 1 && daysSinceSeen !== null && daysSinceSeen >= 25 && daysSinceSeen <= 35))
          ? true : (currentIdentity.day30_return ?? null),
      };
      supabase.from('user_identity')
        .upsert(identityMerged, { onConflict: 'user_id' })
        .then(({ error }) => { if (error) console.error('[identity upsert]', error.message); });
    }

    if (newProfileData || shouldUpdateCheckin || !currentProfile.last_checkin || (userName && !currentProfile.name) || newUnsaidData) {
      const extracted = newProfileData
        ? Object.fromEntries(Object.entries(newProfileData).filter(([k]) => k !== 'changed'))
        : {};

      const merged: Record<string, any> = {
        ...currentProfile,
        ...extracted,
        user_id:    userId,
        updated_at: now,
        name:       currentProfile.name ?? (extracted as any).name ?? userName ?? null,
        // last_checkin: set on first message; only refreshed when 7-day checkin fires
        last_checkin: (!currentProfile.last_checkin || shouldUpdateCheckin)
          ? now
          : currentProfile.last_checkin,
        // Arrays: merge new items into existing, no duplicates, capped
        topic_tags:           mergeUnique(currentProfile.topic_tags,           (extracted as any).topic_tags,           10),
        recurring_struggles:  mergeUnique(currentProfile.recurring_struggles,  (extracted as any).recurring_struggles,   6),
        breakthrough_moments: mergeUnique(currentProfile.breakthrough_moments, (extracted as any).breakthrough_moments,  6),
        unsaid_patterns:      newUnsaidData
          ? mergeUnsaidPatterns(currentProfile.unsaid_patterns, newUnsaidData)
          : (currentProfile.unsaid_patterns ?? null),
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

    // ── emotion embedding: بردار ۳۸۴ بعدی از وضعیت احساسی (fire-and-forget) ──
    if (newEmotionData) {
      const profileForEmbedding = currentProfile;
      generateEmotionEmbedding(newEmotionData, profileForEmbedding)
        .then(embedding => {
          if (!embedding) return;
          return supabase.from('user_profiles')
            .upsert({ user_id: userId, emotion_embedding: embedding, updated_at: now }, { onConflict: 'user_id' })
            .then(({ error }) => { if (error) console.error('[emotion embedding]', error.message); });
        })
        .catch(err => console.error('[emotion embedding]', err?.message));
    }

    // ── behavioral_patterns: اثر انگشت رفتاری (fire-and-forget) ────────────
    {
      const currentHour = new Date().getUTCHours();
      const msgLen      = message.length;

      // EMA α=0.8: 80% history, 20% new observation — history is never overwritten
      const newAvgLen = currentBP?.avg_message_length != null
        ? Math.round((currentBP.avg_message_length * 0.8 + msgLen * 0.2) * 10) / 10
        : msgLen;

      // days_between_sessions — only update on the first message of a new session
      let newDBS: number | null = currentBP?.days_between_sessions ?? null;
      if (sessionMessageCount === 1 && daysSinceSeen !== null) {
        newDBS = newDBS !== null
          ? Math.round((newDBS * 0.8 + daysSinceSeen * 0.2) * 10) / 10
          : daysSinceSeen;
      }

      const newSessionCount = sessionMessageCount === 1
        ? (currentBP?.total_sessions_count ?? 0) + 1
        : (currentBP?.total_sessions_count ?? 0);

      supabase.from('behavioral_patterns').upsert({
        user_id:               userId,
        avg_message_length:    newAvgLen,
        active_hour:           currentHour,
        days_between_sessions: newDBS,
        crisis_recovery_days:  currentBP?.crisis_recovery_days ?? null,
        total_sessions_count:  newSessionCount,
        last_updated:          now,
      }, { onConflict: 'user_id' })
        .then(({ error }) => { if (error) console.error('[behavioral_patterns upsert]', error.message); });
    }

    // ── safety_risk_events: ثبت رویداد ریسک (fire-and-forget) ──────────────
    if (newSafetyRisk?.detected && newSafetyRisk.risk_level) {
      const actionTaken = (newSafetyRisk.risk_level === 'high' || newSafetyRisk.risk_level === 'critical')
        ? 'crisis_resources_appended'
        : 'monitored';
      supabase.from('safety_risk_events').insert({
        user_id:      userId,
        session_id:   sessionId,
        risk_level:   newSafetyRisk.risk_level,
        trigger_type: newSafetyRisk.trigger_type ?? null,
        detected_at:  now,
        action_taken: actionTaken,
      }).then(({ error }) => { if (error) console.error('[safety_risk insert]', error.message); });
    }

    return NextResponse.json({ reply, uiComponent: isPrayerTimeQuery ? 'prayer' : isAdhkarQuery ? 'adhkar' : isTasbihQuery ? 'tasbih' : undefined });

  } catch (error) {
    console.error('خطا:', error);
    return NextResponse.json({ error: 'خطا' }, { status: 500 });
  }
}
