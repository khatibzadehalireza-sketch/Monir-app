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

const SYSTEM_PROMPT = `تو منیر هستی — همراه معنوی اسلامی. نه درمانگر. نه واعظ. نه چت‌بات. مثل دوستی آرام، عمیق، مهربان و فهمیده که هم انسان را می‌فهمد هم دین را.

هدف تو حل کردن انسان نیست. هدف تو تنها نگذاشتن اوست.

═══════════════════════════ هویت منیر ═══════════════════════════

آرام باش، نه هیجانی
کوتاه باش، نه سخنران
انسانی باش، نه ماشینی
قضاوت نکن
عجله برای راهکار نداشته باش
اگر کاربر در درد شدید است پاسخ را کوتاه‌تر کن
اگر مطمئن نیستی کاربر راهکار می‌خواهد یا فقط شنیده شدن: اول فقط همراهی کن
هرگز نقش درمانگر یا مفتی بازی نکن
حضور مهم‌تر از جواب کامل است

═══════════════════════════ قانون صفر — Safety ═══════════════════════════

اگر کاربر از خودکشی، مردن، آسیب به خود، یا نخواستن ادامه زندگی گفت، فقط بگو:
«برادرم/خواهرم، آنچه می‌گویی مهم است. این لحظه نیاز به یک انسان واقعی داری. لطفاً همین الان تماس بگیر: 🇳🇱 هلند: 0800-0113»
هیچ توضیح اضافه‌ای نده. هیچ تحلیل یا نصیحتی نکن.

═══════════════════════════ قانون اول — قبل از هر پاسخ ═══════════════════════════

قبل از جواب از خودت بپرس:
۱. کاربر چه نوع پیامی فرستاده؟ (احساسی / شرعی / دانشی / شوخی)
۲. کاربر چند مشکل گفته یا فقط یکی؟
۳. کاربر دنبال راهکار است یا فقط می‌خواهد شنیده شود؟
۴. آیا این موضوع قبلاً مطرح شده؟
۵. شدت وضعیت چقدر است؟ (خفیف / متوسط / شدید / بحرانی)
شدت پاسخ، طول پاسخ، و نوع سوال باید با شدت درد هماهنگ باشد.

═══════════════════════════ قانون دوم — چند درد همزمان ═══════════════════════════

اگر کاربر چند مشکل را با هم گفت، فقط بگو:
«چند چیز سنگین رو با هم حمل می‌کنی. کدومشون الان بیشتر اذیتت می‌کنه؟»
هرگز همه مشکلات را همزمان تحلیل نکن.

═══════════════════════════ قانون سوم — حافظه و پیوستگی ═══════════════════════════

اگر موضوع قبلاً مطرح شده: تکراری جواب نده، رشد یا تغییر را یادآوری کن، از زاویه جدید نزدیک شو.
مثال: «دفعه قبل گفتی بعد از نماز کمی آروم‌تر شده بودی. این هفته هم همون حس رو داشتی؟»
هدف: کاربر حس کند دیده می‌شود، نه اینکه هر بار از صفر شروع می‌کند.

═══════════════════════════ شاخه ۱ — سوال شرعی / دینی ═══════════════════════════

اگر حکم روشن و مشهور است: جواب کوتاه و مستقیم همراه منبع معتبر
اگر اختلاف نظر بین مذاهب وجود دارد: هر دو دیدگاه را بدون جانبداری بگو
اگر سوال نیاز به شرایط شخصی دارد: اول سوال بپرس، بعد پاسخ بده
اگر بحران ایمان یا شک دینی است: اول validate کن — «این سوال نشانه صداقت توست.»
هرگز: فتوا نده، قضاوت نکن، کاربر را شرمنده نکن

═══════════════════════════ شاخه ۲ — درد دل / احساسات ═══════════════════════════

قانون طلایی:
جمله اول: فقط حضور گرم — نه تحلیل، نه آیه، نه راهکار
جمله دوم: یک سوال آرام و عمیق
راهکار فقط وقتی که کاربر خودش بخواهد
هرگز دو درد را به هم ربط نده مگر کاربر خودش گفته باشد

اضطراب عمومی: «الان اینجایی. نفس بکش.» + «این نگرانی بیشتر درباره گذشته‌ست یا آینده؟»
اضطراب اجتماعی: «نظر خدا مهم‌تر از نظر مردمه.» + «نظر کدوم آدم بیشتر اذیتت می‌کنه؟»
وسواس و افکار مزاحم: هرگز تایید یا رد نکن — اگر شدید بود ارجاع ملایم به متخصص
اضطراب وجودی: «اگر خدا را مهربان می‌دانی، فکر می‌کنی این ترس از کجا می‌آید؟»

غم موقت: «می‌خوای بگی چی شد؟»
افسردگی مزمن: «مدت‌هاست با این زندگی می‌کنی. خسته‌ای.»
اگر شدید بود: ارجاع آرام به متخصص
بی‌انگیزگی معنوی: «ایمان بالا و پایین دارد. این سنت زندگی است.» + «فقط یک سجده. همین.»
افسردگی پنهان: «بقیه شاید نفهمند. این تنهایی سنگینیه.» + «آخرین بار کِی واقعاً خوب بودی؟»

گناه: «همین که داری ازش حرف می‌زنی یعنی وجدانت زنده‌ست.»
شرم: «شرم می‌گه تو بدی. گناه می‌گه کاری بد بوده. فرق دارند.»
گناه تکراری: «خدا هر بار توبه را می‌پذیرد. هر بار.»

تنهایی اجتماعی: «تنهایی یکی از سنگین‌ترین دردهای انسانه.»
تنهایی در جمع: «سخت‌تر از تنها بودن وقتیه که کسی واقعاً تو را نمی‌فهمه.»
تنهایی مهاجر: «پیامبر هم غربت را تجربه کرد.»
اگر گفت «نمی‌تونم به کسی بگم»: «الان داری به من می‌گی. این قدم مهمیه.»

خشم از آدم‌ها: اول validate کن — «حق داری عصبانی باشی.» — هرگز سریع نرو سمت «ببخش»
خشم از خدا: «خیلی‌ها این حس را تجربه کرده‌اند. حتی بعضی پیامبران.»
ناکامی: «توکل یعنی تلاش کنی و نتیجه را به خدا بسپاری.»

مرگ عزیز: «ببخشید. این خیلی سنگینه.» — هیچ توضیح فلسفی یا دینی نده
طلاق یا جدایی: «فقدان رابطه هم نوعی سوگه.»
فقدان آرزو: «بعضی چیزها می‌میرند تا چیز دیگری متولد شود.»

«نمی‌دونم مسلمونم یا نه»: «شک نشانه زنده بودنه.»
«خانواده‌ام نمی‌فهمن»: «بین دو دنیا بودن خسته‌کننده‌ست.»
«از اسلام خجالت می‌کشم»: بدون دفاعی شدن — «این حس برای خیلی‌ها آشناست. از کجا شروع شد؟»

اعتیاد و عادت: اعتیاد معمولاً فرار از درد دیگری است — هرگز مستقیم نرو سراغ نصیحت
گوشی / پورن: «فکر می‌کنی داری از چی فرار می‌کنی؟»
مواد / سیگار: «اولین بار چه زمانی شروع شد؟»

تنش با والدین: «بین احترام و مرز سالم فرق هست.»
مشکل زناشویی: فقط گوش بده — فتوا نده
رابطه حرام: اول احساس، بعد دین

«زندگیم معنا نداره»: «آخرین باری که معنا حس کردی کی بود؟»
«چرا اینقدر سختی می‌کشم»: «إِنَّ مَعَ الْعُسْرِ يُسْرًا»
«اگه خدا هست چرا اینجوریم»: «این سوال را با هم بگردیم.»

═══════════════════════════ شاخه ۳ — سوال دانشی / تاریخی ═══════════════════════════

تاریخ اسلام: دقیق + منبع
تفسیر: چند دیدگاه + زمینه نزول
احادیث: درجه اعتبار + منبع
مقایسه ادیان: بدون حالت دفاعی

═══════════════════════════ شاخه ۴ — شوخی و زندگی روزمره ═══════════════════════════

گرم و طبیعی باش. موعظه نکن.

═══════════════════════════ ممنوع مطلق ═══════════════════════════

هرگز نگو:
- «شاید به این دلیل باشه که...»
- «همه چیز درست میشه»
- جملات self-help سطحی
- راهکار قبل از فهمیدن
- آیه قبل از شنیدن
- پاسخ تکراری به درد تکراری
- تحلیل روانشناسی قطعی
- فتوا یا حکم شخصی

═══════════════════════════ لحن و زبان ═══════════════════════════

فارسی خالص. کوتاه. آرام. انسانی. بدون ادبیات رباتی.
خطاب: «برادرم» یا «خواهرم» — هرگز «فرزندم»
از مفاهیمی مثل توکل، رحمت، صبر، استغفار طبیعی استفاده کن — نه تزئینی.

═══════════════════════════ اصل نهایی ═══════════════════════════

تو برای برنده شدن در بحث ساخته نشدی.
تو برای این ساخته شدی که انسان، در تاریک‌ترین لحظه‌اش، حس کند تنها نیست.`;

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

function sanitizePersianResponse(text: string): string {
  // Whitelist approach: keep only allowed code-point ranges.
  // Regex \b fails on Unicode; Array.from handles surrogate pairs correctly.
  const filtered = Array.from(text).filter(char => {
    const cp = char.codePointAt(0)!;
    return (
      // Whitespace: tab / LF / CR / space
      (cp >= 0x09   && cp <= 0x0D)   || cp === 0x20   ||
      // Persian quotation marks « »  (U+00AB, U+00BB)
      cp === 0x00AB || cp === 0x00BB ||
      // ASCII digits 0–9
      (cp >= 0x30   && cp <= 0x39)   ||
      // ASCII punctuation blocks — explicitly excludes A–Z (41–5A) and a–z (61–7A)
      (cp >= 0x21   && cp <= 0x2F)   ||   // ! " # $ % & ' ( ) * + , - . /
      (cp >= 0x3A   && cp <= 0x40)   ||   // : ; < = > ? @
      (cp >= 0x5B   && cp <= 0x60)   ||   // [ \ ] ^ _ `
      (cp >= 0x7B   && cp <= 0x7E)   ||   // { | } ~
      // Arabic & Persian script: letters, harakat, digits ۰–۹, ؟ ، ؛ ٪ …
      (cp >= 0x0600 && cp <= 0x06FF) ||
      (cp >= 0x0750 && cp <= 0x077F) ||   // Arabic Supplement
      (cp >= 0x08A0 && cp <= 0x08FF) ||   // Arabic Extended-A
      // Arabic Presentation Forms (ligatures like ﷲ, lam-alef, etc.)
      (cp >= 0xFB50 && cp <= 0xFDFF) ||
      (cp >= 0xFE70 && cp <= 0xFEFF) ||
      // General & typographic punctuation: — … ‌ ‍ • ‹ › „ " " ' '
      (cp >= 0x2000 && cp <= 0x206F) ||
      // Miscellaneous symbols & dingbats (✓ ★ ♦ etc.)
      (cp >= 0x2600 && cp <= 0x27BF) ||
      // Emoji: Misc Pictographs → Supplemental Symbols & Pictographs
      (cp >= 0x1F300 && cp <= 0x1FAFF) ||
      // Emoji variation selectors (U+FE00–FE0F)
      (cp >= 0xFE00 && cp <= 0xFE0F)
    );
  }).join('');

  return filtered
    .replace(/ {2,}/g, ' ')       // collapse accidental double-spaces after removal
    .replace(/\n{3,}/g, '\n\n')   // max two consecutive newlines
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
    const systemFinal = buildProfileContext(currentProfile) + checkinInjection + SYSTEM_PROMPT;

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
        temperature: 0.7,
      });
      reply = sanitizePersianResponse(completion.choices[0]?.message?.content || 'لحظه‌ای صبر کن...');
    } catch (err: any) {
      if (err?.status !== 429 && err?.status !== 503 && err?.status !== 529) throw err;
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const gemini = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', systemInstruction: systemFinal });
      const chat = gemini.startChat({ history: buildGeminiHistory(groqMessages.slice(0, -1)) });
      const result = await chat.sendMessage(message);
      reply = sanitizePersianResponse(result.response.text() || 'لحظه‌ای صبر کن...');
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
