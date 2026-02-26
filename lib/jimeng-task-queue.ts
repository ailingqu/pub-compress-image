import { randomUUID } from 'crypto';
import { getRedis } from './redis';

const TASK_PREFIX = 'jimeng:task:';
const TASK_TTL = 86400; // 24h

export interface JimengTaskParams {
  imageUrl?: string | null;
  prompt: string;
  model: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  fps?: number;
  seed?: number | null;
}

export interface JimengTaskStatus {
  taskId: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  videoUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

function taskKey(taskId: string) {
  return `${TASK_PREFIX}${taskId}`;
}

/**
 * 提交任务到队列，立即返回 taskId，后台异步处理
 */
export async function enqueueTask(params: JimengTaskParams): Promise<string> {
  const redis = getRedis();
  const taskId = randomUUID();
  const now = new Date().toISOString();
  const key = taskKey(taskId);

  await redis.hset(key, {
    status: 'pending',
    params: JSON.stringify(params),
    createdAt: now,
    updatedAt: now,
  });
  await redis.expire(key, TASK_TTL);

  // 后台异步处理，不阻塞返回
  processTask(taskId).catch((err) => {
    console.error(`[JimengQueue] 任务 ${taskId} 处理异常:`, err);
  });

  return taskId;
}

/**
 * 后台处理：调用 Zeakai 同步接口，更新 Redis 状态
 */
async function processTask(taskId: string): Promise<void> {
  const redis = getRedis();
  const key = taskKey(taskId);

  // 标记为处理中
  await redis.hset(key, { status: 'processing', updatedAt: new Date().toISOString() });

  const raw = await redis.hget(key, 'params');
  if (!raw) throw new Error('Task params not found');
  const params: JimengTaskParams = JSON.parse(raw);

  const baseurl = process.env.ZEAKAI_API_URL + '/v1/chat/completions';
  const authToken = process.env.ZEAKAI_TOKEN || '';

  // 构建消息内容，将 aspectRatio 拼接到 prompt 中
  const fullPrompt = params.aspectRatio
    ? `${params.prompt} --ar ${params.aspectRatio}`
    : params.prompt;
  const messageContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text: fullPrompt },
  ];

  // 处理参考图片
  if (params.imageUrl) {
    try {
      if (params.imageUrl.startsWith('http://') || params.imageUrl.startsWith('https://')) {
        const imgResp = await fetch(params.imageUrl);
        if (!imgResp.ok) throw new Error(`Download image failed: ${imgResp.status}`);
        const buf = Buffer.from(await imgResp.arrayBuffer());
        let mime = 'image/jpeg';
        if (buf[0] === 0x89 && buf[1] === 0x50) mime = 'image/png';
        else if (buf[0] === 0x52 && buf[1] === 0x49) mime = 'image/webp';
        messageContent.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${buf.toString('base64')}` } });
      } else {
        messageContent.push({ type: 'image_url', image_url: { url: params.imageUrl } });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await redis.hset(key, { status: 'failed', error: `Image error: ${msg}`, updatedAt: new Date().toISOString() });
      return;
    }
  }

  const requestBody = {
    model: params.model,
    messages: [{ role: 'user', content: messageContent }],
    stream: false,
  };

  try {
    const resp = await fetch(baseurl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      await redis.hset(key, { status: 'failed', error: `API ${resp.status}: ${errText.slice(0, 500)}`, updatedAt: new Date().toISOString() });
      return;
    }

    const result = await resp.json();
    let videoUrl: string | null = null;

    if (result.choices?.[0]?.message?.content) {
      const content = result.choices[0].message.content;
      const m1 = content.match(/\[Download Video\]\((https?:\/\/[^\s)]+)\)/);
      if (m1) videoUrl = m1[1];
      if (!videoUrl) {
        const m2 = content.match(/<video[^>]*>\s*(https?:\/\/[^\s<]+)/);
        if (m2) videoUrl = m2[1].trim();
      }
      if (!videoUrl) {
        const m3 = content.match(/(https?:\/\/[^\s)<]+\.mp4[^\s)<]*)/);
        if (m3) videoUrl = m3[1];
      }
    }

    if (!videoUrl) {
      await redis.hset(key, { status: 'failed', error: 'No video URL in response', updatedAt: new Date().toISOString() });
      return;
    }

    await redis.hset(key, { status: 'success', videoUrl, updatedAt: new Date().toISOString() });
    console.log(`[JimengQueue] 任务 ${taskId} 完成, videoUrl: ${videoUrl}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await redis.hset(key, { status: 'failed', error: msg, updatedAt: new Date().toISOString() });
  }
}

/**
 * 查询任务状态
 */
export async function getTaskStatus(taskId: string): Promise<JimengTaskStatus | null> {
  const redis = getRedis();
  const data = await redis.hgetall(taskKey(taskId));
  if (!data || !data.status) return null;
  return {
    taskId,
    status: data.status as JimengTaskStatus['status'],
    videoUrl: data.videoUrl || undefined,
    error: data.error || undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}
