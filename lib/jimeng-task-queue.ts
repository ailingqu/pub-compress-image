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

  console.log(`[JimengQueue] 任务 ${taskId} 开始处理`);
  console.log(`[JimengQueue] API URL: ${baseurl}`);
  console.log(`[JimengQueue] Model: ${params.model}, Prompt: ${params.prompt.slice(0, 100)}`);
  console.log(`[JimengQueue] ImageUrl: ${params.imageUrl || '无'}, AspectRatio: ${params.aspectRatio || '无'}`);

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
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      const cause = err?.cause ? ` | cause: ${err.cause?.message || JSON.stringify(err.cause)}` : '';
      console.error(`[JimengQueue] 任务 ${taskId} 图片处理失败: ${msg}${cause}`);
      await redis.hset(key, { status: 'failed', error: `Image error: ${msg}${cause}`.slice(0, 500), updatedAt: new Date().toISOString() });
      return;
    }
  }

  const requestBody = {
    model: params.model,
    messages: [{ role: 'user', content: messageContent }],
    stream: true,
  };

  console.log(`[JimengQueue] 任务 ${taskId} 发送请求到 Zeakai (stream mode)...`);
  console.log(`[JimengQueue] 请求体:`, JSON.stringify(requestBody, (key, value) => {
    if (key === 'url' && typeof value === 'string' && value.startsWith('data:')) {
      return value.slice(0, 50) + '...[base64 truncated]';
    }
    return value;
  }, 2));

  try {
    const fetchStart = Date.now();
    const resp = await fetch(baseurl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(600_000),
    });
    console.log(`[JimengQueue] 任务 ${taskId} 收到流式响应头, status=${resp.status}, 耗时=${Date.now() - fetchStart}ms`);

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[JimengQueue] 任务 ${taskId} API 返回错误: ${resp.status}`, errText.slice(0, 500));
      await redis.hset(key, { status: 'failed', error: `API ${resp.status}: ${errText.slice(0, 500)}`, updatedAt: new Date().toISOString() });
      return;
    }

    // 读取 SSE 流，拼接 content
    const reader = resp.body?.getReader();
    if (!reader) {
      await redis.hset(key, { status: 'failed', error: 'No response body', updatedAt: new Date().toISOString() });
      return;
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        try {
          const chunk = JSON.parse(data);
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            chunkCount++;
          }
        } catch {
          // 忽略非 JSON 行
        }
      }
    }

    console.log(`[JimengQueue] 任务 ${taskId} 流式读取完成, chunks=${chunkCount}, 总耗时=${Date.now() - fetchStart}ms`);
    console.log(`[JimengQueue] 任务 ${taskId} 完整内容:`, fullContent.slice(0, 2000));

    // 提取 videoUrl
    let videoUrl: string | null = null;
    const m1 = fullContent.match(/\[Download Video\]\((https?:\/\/[^\s)]+)\)/);
    if (m1) videoUrl = m1[1];
    if (!videoUrl) {
      const m2 = fullContent.match(/<video[^>]*>\s*(https?:\/\/[^\s<]+)/);
      if (m2) videoUrl = m2[1].trim();
    }
    if (!videoUrl) {
      const m3 = fullContent.match(/(https?:\/\/[^\s)<]+\.mp4[^\s)<]*)/);
      if (m3) videoUrl = m3[1];
    }

    if (!videoUrl) {
      await redis.hset(key, { status: 'failed', error: 'No video URL in response', updatedAt: new Date().toISOString() });
      return;
    }

    await redis.hset(key, { status: 'success', videoUrl, updatedAt: new Date().toISOString() });
    console.log(`[JimengQueue] 任务 ${taskId} 完成, videoUrl: ${videoUrl}`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    const cause = err?.cause ? ` | cause: ${err.cause?.message || JSON.stringify(err.cause)}` : '';
    const code = err?.code ? ` | code: ${err.code}` : '';
    const fullError = `${msg}${cause}${code}`;
    console.error(`[JimengQueue] 任务 ${taskId} 异常:`, fullError);
    console.error(`[JimengQueue] 完整错误对象:`, err);
    await redis.hset(key, { status: 'failed', error: fullError.slice(0, 500), updatedAt: new Date().toISOString() });
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
