export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { applyWatermark, formatToMime, looksLikeImage, parseBaseOptions } from '@/lib/watermark';

const MAX_IMAGE_SIZE = 100 * 1024 * 1024;
const MAX_WATERMARK_SIZE = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log('[watermark] Request received');

  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;
    const watermarkFile = formData.get('watermark') as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: '请上传 image 字段的图片文件' }, { status: 400 });
    }

    if (!looksLikeImage(imageFile)) {
      return NextResponse.json({ error: 'image 字段必须是有效的图片文件' }, { status: 400 });
    }

    if (imageFile.size === 0) {
      return NextResponse.json({ error: '上传的图片为空' }, { status: 400 });
    }

    if (imageFile.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: '图片过大，最大支持 100MB' }, { status: 413 });
    }

    const hasWatermarkFile = !!watermarkFile && watermarkFile.size > 0;
    if (hasWatermarkFile) {
      if (!looksLikeImage(watermarkFile!)) {
        return NextResponse.json({ error: 'watermark 字段必须是有效的图片文件' }, { status: 400 });
      }
      if (watermarkFile!.size > MAX_WATERMARK_SIZE) {
        return NextResponse.json({ error: '水印图过大，最大支持 20MB' }, { status: 413 });
      }
    }

    const parsed = parseBaseOptions(formData, hasWatermarkFile);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const watermarkBuffer = hasWatermarkFile
      ? Buffer.from(await watermarkFile!.arrayBuffer())
      : undefined;

    console.log(
      `[watermark] Processing: type=${parsed.options.type}, position=${parsed.options.position}, image=${imageBuffer.length}B, watermark=${watermarkBuffer?.length ?? 0}B`
    );

    const result = await applyWatermark(imageBuffer, {
      ...parsed.options,
      watermarkBuffer,
    });

    const duration = Date.now() - startTime;
    console.log(
      `[watermark] Done. Output: ${result.buffer.length}B (${result.format}), ${result.width}x${result.height}, ${duration}ms`
    );

    return new Response(result.buffer as any, {
      status: 200,
      headers: {
        'Content-Type': formatToMime(result.format),
        'Content-Length': result.buffer.length.toString(),
        'X-Image-Size': `${result.width}x${result.height}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[watermark] Error after ${duration}ms:`, error);
    const message = error instanceof Error ? error.message : '图片处理失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
