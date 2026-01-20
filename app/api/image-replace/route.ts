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
    const width = originalMeta.width!;
    const height = originalMeta.height!;

    // 计算模糊半径：根据图片尺寸动态调整，范围 5-30
    const blurRadius = Math.max(5, Math.min(30, Math.round(Math.min(width, height) / 50)));

    // 对遮罩应用高斯模糊，创建渐进式边缘过渡
    const grayscaleMask = await sharp(maskBuffer)
      .resize(width, height)
      .grayscale()
      .blur(blurRadius) // 高斯模糊实现羽化效果
      .raw()
      .toBuffer();

    // 读取原图和替换图的原始像素数据
    const originalRaw = await sharp(originalBuffer)
      .resize(width, height)
      .ensureAlpha()
      .raw()
      .toBuffer();

    const replacementRaw = await sharp(replacementBuffer)
      .resize(width, height)
      .ensureAlpha()
      .raw()
      .toBuffer();

    // 创建结果图像的 buffer
    const resultBuffer = Buffer.alloc(width * height * 4);

    // 逐像素混合：根据遮罩值选择原图或替换图的像素
    for (let i = 0; i < width * height; i++) {
      const maskValue = grayscaleMask[i] / 255; // 0-1 之间的值
      const srcIdx = i * 4;

      // 线性混合: result = original * (1 - mask) + replacement * mask
      resultBuffer[srcIdx] = Math.round(originalRaw[srcIdx] * (1 - maskValue) + replacementRaw[srcIdx] * maskValue);         // R
      resultBuffer[srcIdx + 1] = Math.round(originalRaw[srcIdx + 1] * (1 - maskValue) + replacementRaw[srcIdx + 1] * maskValue); // G
      resultBuffer[srcIdx + 2] = Math.round(originalRaw[srcIdx + 2] * (1 - maskValue) + replacementRaw[srcIdx + 2] * maskValue); // B
      resultBuffer[srcIdx + 3] = 255; // A - 完全不透明
    }

    // 将结果转为 PNG
    const result = await sharp(resultBuffer, {
      raw: { width, height, channels: 4 }
    }).png().toBuffer();

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
