export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import sharp from 'sharp';
import { NextRequest, NextResponse } from 'next/server';

interface ReplaceResponse {
  success: boolean;
  originalSize?: number;
  resultSize?: number;
  width?: number;
  height?: number;
  data?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const originalFile = formData.get('original') as File;
    const replacementFile = formData.get('replacement') as File;
    const maskFile = formData.get('mask') as File;

    // 验证文件
    if (!originalFile || !replacementFile || !maskFile) {
      return NextResponse.json<ReplaceResponse>(
        { error: '请上传原图、替换图和遮罩图', success: false },
        { status: 400 }
      );
    }

    // 验证文件类型
    if (!originalFile.type.startsWith('image/') ||
        !replacementFile.type.startsWith('image/') ||
        !maskFile.type.startsWith('image/')) {
      return NextResponse.json<ReplaceResponse>(
        { error: '请上传有效的图片文件', success: false },
        { status: 400 }
      );
    }

    // 读取 buffer
    const originalBuffer = Buffer.from(await originalFile.arrayBuffer());
    const replacementBuffer = Buffer.from(await replacementFile.arrayBuffer());
    const maskBuffer = Buffer.from(await maskFile.arrayBuffer());

    // 获取图片元数据
    const originalMeta = await sharp(originalBuffer).metadata();
    const replacementMeta = await sharp(replacementBuffer).metadata();
    const maskMeta = await sharp(maskBuffer).metadata();

    // 验证尺寸一致
    if (originalMeta.width !== replacementMeta.width ||
        originalMeta.height !== replacementMeta.height) {
      return NextResponse.json<ReplaceResponse>(
        { error: '原图和替换图的尺寸必须相同', success: false },
        { status: 400 }
      );
    }

    // 处理遮罩：转为灰度图并调整尺寸匹配原图
    const processedMask = await sharp(maskBuffer)
      .resize(originalMeta.width, originalMeta.height)
      .grayscale()
      .toBuffer();

    // 将遮罩应用到替换图（提取要替换的区域）
    // 先确保替换图有 alpha 通道
    const replacementWithAlpha = await sharp(replacementBuffer)
      .ensureAlpha()
      .toBuffer();

    // 使用遮罩作为 alpha 通道来提取替换区域
    const maskedReplacement = await sharp(replacementWithAlpha)
      .composite([{
        input: processedMask,
        blend: 'dest-in'
      }])
      .toBuffer();

    // 将提取的区域合成到原图上
    const result = await sharp(originalBuffer)
      .ensureAlpha()
      .composite([{
        input: maskedReplacement,
        blend: 'over'
      }])
      .png()
      .toBuffer();

    const response: ReplaceResponse = {
      success: true,
      originalSize: originalFile.size,
      resultSize: result.length,
      width: originalMeta.width,
      height: originalMeta.height,
      data: result.toString('base64')
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Image replace error:', error);
    return NextResponse.json<ReplaceResponse>(
      { error: '图片处理失败，请确保上传有效的图片文件', success: false },
      { status: 500 }
    );
  }
}
