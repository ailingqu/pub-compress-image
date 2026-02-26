import { NextRequest, NextResponse } from 'next/server';
import { enqueueTask, JimengTaskParams } from '@/lib/jimeng-task-queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, model, imageUrl, aspectRatio, resolution, duration, fps, seed } = body;

    if (!prompt || !model) {
      return NextResponse.json({ error: 'prompt 和 model 为必填参数' }, { status: 400 });
    }

    const params: JimengTaskParams = {
      prompt,
      model,
      imageUrl: imageUrl || null,
      aspectRatio: aspectRatio || '16:9',
      resolution: resolution || '720p',
      duration: duration || 5,
      fps: fps || 24,
      seed: seed ?? null,
    };

    const taskId = await enqueueTask(params);

    return NextResponse.json({ taskId, status: 'pending' });
  } catch (err) {
    console.error('[Jimeng Submit] 错误:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
