import { NextRequest, NextResponse } from 'next/server';
import { getProTaskStatus } from '@/lib/jimeng-pro-task-queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;

    if (!taskId) {
      return NextResponse.json({ error: 'taskId 为必填参数' }, { status: 400 });
    }

    const task = await getProTaskStatus(taskId);

    if (!task) {
      return NextResponse.json({ error: '任务不存在或已过期' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (err) {
    console.error('[JimengPro Status] 错误:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
