import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

export interface R2Message {
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

interface DailyBlob {
  userId: string;
  date: string;
  messages: R2Message[];
  updatedAt: string;
}

function makeClient(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

const getBucket = () => process.env.R2_BUCKET_NAME ?? 'monir-conversations';

export const isR2Ready = () =>
  !!(process.env.R2_ACCOUNT_ID &&
     process.env.R2_ACCESS_KEY_ID &&
     process.env.R2_SECRET_ACCESS_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// Conversations — append-only daily blob per user
// Key: conversations/{userId}/{YYYY-MM-DD}.json
// ─────────────────────────────────────────────────────────────────────────────

export async function appendConversation(
  userId: string,
  date: string,
  messages: R2Message[],
): Promise<string> {
  const key = `conversations/${userId}/${date}.json`;
  const client = makeClient();

  let blob: DailyBlob = { userId, date, messages: [], updatedAt: '' };
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
    const text = await res.Body?.transformToString();
    if (text) blob = JSON.parse(text);
  } catch { /* new day — start fresh blob */ }

  blob.messages.push(...messages);
  blob.updatedAt = new Date().toISOString();

  await client.send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: JSON.stringify(blob),
    ContentType: 'application/json',
  }));

  return key;
}

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge base — extensible slot for Islamic / psychology content
// Key convention: knowledge/{category}/{filename}
// Supported categories: 'islamic' | 'psychology' | 'prompts'
// To add content later: call putKnowledge('islamic', 'quran-topics.md', text)
// ─────────────────────────────────────────────────────────────────────────────

export async function getKnowledge(category: string, filename: string): Promise<string | null> {
  try {
    const res = await makeClient().send(
      new GetObjectCommand({ Bucket: getBucket(), Key: `knowledge/${category}/${filename}` }),
    );
    return (await res.Body?.transformToString()) ?? null;
  } catch {
    return null;
  }
}

export async function putKnowledge(category: string, filename: string, content: string): Promise<void> {
  await makeClient().send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: `knowledge/${category}/${filename}`,
    Body: content,
    ContentType: filename.endsWith('.md') ? 'text/markdown' : 'text/plain',
  }));
}
