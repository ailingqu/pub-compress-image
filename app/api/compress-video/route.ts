export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

interface CompressResponse {
  originalName: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  data: string; // base64
  success: boolean;
  error?: string;
}

interface QualitySettings {
  crf: number;
  preset: string;
}

const qualitySettingsMap: Record<string, QualitySettings> = {
  high: { crf: 23, preset: 'medium' },
  balanced: { crf: 28, preset: 'fast' },
  small: { crf: 32, preset: 'faster' }
};

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const quality = searchParams.get('quality') || 'balanced';

  const settings = qualitySettingsMap[quality] || qualitySettingsMap.balanced;

  let inputPath = '';
  let outputPath = '';

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: '请上传视频文件', success: false },
        { status: 400 }
      );
    }

    // 验证文件类型
    if (!file.type.startsWith('video/')) {
      return NextResponse.json(
        { error: '只支持视频文件', success: false },
        { status: 400 }
      );
    }

    // 文件大小限制 (500MB)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: '文件过大，最大支持 500MB', success: false },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const tempDir = '/tmp';
    const uuid = randomUUID();

    // 获取原始文件扩展名
    const originalExt = path.extname(file.name) || '.mp4';
    inputPath = path.join(tempDir, `${uuid}_input${originalExt}`);
    outputPath = path.join(tempDir, `${uuid}_output.mp4`);

    // 写入临时文件
    fs.writeFileSync(inputPath, buffer);

    // FFmpeg 压缩
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',
          `-crf ${settings.crf}`,
          `-preset ${settings.preset}`,
          '-c:a aac',
          '-b:a 128k',
          '-movflags +faststart' // 优化网络播放
        ])
        .save(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    // 读取压缩后的文件
    const compressedBuffer = fs.readFileSync(outputPath);
    const compressedSize = compressedBuffer.length;
    const compressionRatio = Math.round((1 - compressedSize / file.size) * 100);

    // 清理临时文件
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    // 返回 base64 数据
    const response: CompressResponse = {
      originalName: file.name,
      originalSize: file.size,
      compressedSize,
      compressionRatio,
      data: compressedBuffer.toString('base64'),
      success: true
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Video compression error:', error);

    // 清理临时文件
    try {
      if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch {
      // 忽略清理错误
    }

    return NextResponse.json(
      { error: '视频压缩失败，请确保文件格式正确后重试', success: false },
      { status: 500 }
    );
  }
}
