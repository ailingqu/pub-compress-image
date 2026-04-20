export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { applyWatermark, formatToMime, looksLikeImage, parseBaseOptions } from '@/lib/watermark';

const MAX_FILES = 20;
const MAX_IMAGE_SIZE = 100 * 1024 * 1024;
const MAX_WATERMARK_SIZE = 20 * 1024 * 1024;

interface WatermarkResult {
  originalName: string;
  originalSize: number;
  resultSize?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  data?: string;
  success: boolean;
  error?: string;
}

interface BatchWatermarkResponse {
  results: WatermarkResult[];
  totalOriginalSize: number;
  totalResultSize: number;
  successCount: number;
  failCount: number;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log('[batch-watermark] Request received');

  try {
    const formData = await req.formData();
    const files = formData.getAll('files').filter((f): f is File => f instanceof File);
    const watermarkFile = formData.get('watermark') as File | null;

    if (files.length === 0) {
      return NextResponse.json({ error: '请通过 files 字段上传至少一张图片' }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `单次最多上传 ${MAX_FILES} 张图片` },
        { status: 400 }
      );
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

    const watermarkBuffer = hasWatermarkFile
      ? Buffer.from(await watermarkFile!.arrayBuffer())
      : undefined;

    console.log(
      `[batch-watermark] Processing ${files.length} files, type=${parsed.options.type}, position=${parsed.options.position}`
    );

    const results: WatermarkResult[] = await Promise.all(
      files.map(async (file, index): Promise<WatermarkResult> => {
        const originalName = file.name || `file-${index + 1}`;
        const originalSize = file.size;

        try {
          if (!looksLikeImage(file)) {
            return { originalName, originalSize, success: false, error: '不是有效的图片文件' };
          }
          if (file.size === 0) {
            return { originalName, originalSize, success: false, error: '文件为空' };
          }
          if (file.size > MAX_IMAGE_SIZE) {
            return { originalName, originalSize, success: false, error: '文件超过 100MB 上限' };
          }

          const buffer = Buffer.from(await file.arrayBuffer());
          const result = await applyWatermark(buffer, {
            ...parsed.options,
            watermarkBuffer,
          });

          return {
            originalName,
            originalSize,
            resultSize: result.buffer.length,
            width: result.width,
            height: result.height,
            mimeType: formatToMime(result.format),
            data: result.buffer.toString('base64'),
            success: true,
          };
        } catch (error) {
          console.error(`[batch-watermark] Failed on ${originalName}:`, error);
          const message = error instanceof Error ? error.message : '处理失败';
          return { originalName, originalSize, success: false, error: message };
        }
      })
    );

    const successResults = results.filter((r) => r.success);
    const totalOriginalSize = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalResultSize = successResults.reduce((sum, r) => sum + (r.resultSize || 0), 0);

    const response: BatchWatermarkResponse = {
      results,
      totalOriginalSize,
      totalResultSize,
      successCount: successResults.length,
      failCount: results.length - successResults.length,
    };

    const duration = Date.now() - startTime;
    console.log(
      `[batch-watermark] Done. Success: ${response.successCount}, Failed: ${response.failCount}, ${duration}ms`
    );

    return NextResponse.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[batch-watermark] Error after ${duration}ms:`, error);
    const message = error instanceof Error ? error.message : '图片处理失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
