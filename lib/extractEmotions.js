import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function extractEmotionScores(messages) {
  const conversation = messages
    .map(m => `${m.role === 'user' ? 'کاربر' : 'منیر'}: ${m.content}`)
    .join('\n');

  const prompt = `این مکالمه را تحلیل کن و فقط یک JSON برگردان بدون هیچ توضیح یا markdown:

${conversation}

فرمت دقیق:
{"anxiety_score":0,"loneliness_score":0,"hope_score":0,"guilt_score":0,"dominant_emotion":"","spiritual_state":"stable","session_summary":""}

مقادیر:
- anxiety/loneliness/hope/guilt: عدد 0 تا 10
- spiritual_state: فقط یکی از: struggling, stable, growing, crisis
- dominant_emotion: یک کلمه فارسی
- session_summary: یک جمله فارسی`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('Emotion extraction failed:', err);
    return null;
  }
}
