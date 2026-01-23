export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import sharp from 'sharp';
import tinify from 'tinify';
import { NextRequest, NextResponse } from 'next/server';

// 配置 TinyPNG API Key
tinify.key = '7KwHwJ3HvfyCmzCtnTPC2wfYGnc84zgf';

// 支持的输出格式
type OutputFormat = 'png' | 'webp' | 'jpg' | 'jpeg' | 'original';

// 根据 Content-Type 获取原始格式
function getOriginalFormat(contentType: string | null): 'png' | 'webp' | 'jpeg' {
  if (!contentType) return 'jpeg';

  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'png'; // GIF 转为 PNG 保持透明度
  if (contentType.includes('bmp')) return 'png';
  // 默认转为 jpeg（包括 jpeg, jpg, heic 等）
  return 'jpeg';
}

// 获取输出格式的 MIME 类型
function getMimeType(format: 'png' | 'webp' | 'jpeg'): string {
  switch (format) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'jpeg': return 'image/jpeg';
    default: return 'image/jpeg';
  }
}

// 获取输出格式的文件扩展名
function getFileExtension(format: 'png' | 'webp' | 'jpeg'): string {
  switch (format) {
    case 'png': return 'png';
    case 'webp': return 'webp';
    case 'jpeg': return 'jpg';
    default: return 'jpg';
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log('[compress-image-stream] Request received');

  try {
    // 获取查询参数
    const { searchParams } = new URL(req.url);

    // 尺寸参数 (默认: 1200, 可选: 500, 1200, original)
    const sizeParam = searchParams.get('size') || '1200';
    // 格式参数 (默认: webp, 可选: png, webp, jpg, jpeg, original)
    const formatParam = (searchParams.get('format') || 'webp').toLowerCase() as OutputFormat;
    // 质量参数 (默认: 85, 范围: 1-100)
    const qualityParam = parseInt(searchParams.get('quality') || '85', 10);

    console.log('[compress-image-stream] Params:', { size: sizeParam, format: formatParam, quality: qualityParam });

    // 验证尺寸参数
    let size: number | null = null;
    if (sizeParam === 'original') {
      size = null; // 不调整尺寸
    } else if (sizeParam === '500') {
      size = 500;
    } else if (sizeParam === '1200') {
      size = 1200;
    } else {
      // 尝试解析自定义尺寸
      const customSize = parseInt(sizeParam, 10);
      if (isNaN(customSize) || customSize < 1 || customSize > 8192) {
        console.log('[compress-image-stream] Invalid size parameter:', sizeParam);
        return NextResponse.json(
          { error: 'Invalid size parameter. Use size=500, size=1200, size=original, or a number between 1-8192' },
          { status: 400 }
        );
      }
      size = customSize;
    }

    // 验证格式参数
    const validFormats: OutputFormat[] = ['png', 'webp', 'jpg', 'jpeg', 'original'];
    if (!validFormats.includes(formatParam)) {
      console.log('[compress-image-stream] Invalid format parameter:', formatParam);
      return NextResponse.json(
        { error: 'Invalid format parameter. Use format=png, format=webp, format=jpg, or format=original' },
        { status: 400 }
      );
    }

    // 验证质量参数
    const quality = Math.max(1, Math.min(100, isNaN(qualityParam) ? 85 : qualityParam));

    // 验证 Content-Type
    const contentType = req.headers.get('content-type');
    console.log('[compress-image-stream] Content-Type:', contentType);
    if (!contentType?.startsWith('image/')) {
      console.log('[compress-image-stream] Invalid content type');
      return NextResponse.json(
        { error: 'Invalid content type. Please upload an image.' },
        { status: 400 }
      );
    }

    // 获取图片 buffer
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('[compress-image-stream] Received buffer size:', buffer.length);

    // 验证 buffer 大小 (最大 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (buffer.length > maxSize) {
      console.log('[compress-image-stream] File too large:', buffer.length);
      return NextResponse.json(
        { error: 'Image too large. Maximum size is 100MB.' },
        { status: 413 }
      );
    }

    // 验证 buffer 不为空
    if (buffer.length === 0) {
      console.log('[compress-image-stream] Empty buffer received');
      return NextResponse.json(
        { error: 'Empty image data received.' },
        { status: 400 }
      );
    }

    // 确定最终输出格式
    let outputFormat: 'png' | 'webp' | 'jpeg';
    if (formatParam === 'original') {
      outputFormat = getOriginalFormat(contentType);
    } else if (formatParam === 'jpg') {
      outputFormat = 'jpeg';
    } else {
      outputFormat = formatParam as 'png' | 'webp' | 'jpeg';
    }

    console.log('[compress-image-stream] Output format:', outputFormat);

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('[compress-image-stream] Starting compression...');

          // 构建 Sharp 处理管道
          let sharpInstance = sharp(buffer);

          // 调整尺寸（如果指定）
          if (size !== null) {
            sharpInstance = sharpInstance.resize(size, size, {
              fit: 'inside',
              withoutEnlargement: true
            });
          }

          // 根据输出格式设置压缩参数
          let compressedImage: Buffer;
          switch (outputFormat) {
            case 'png':
              // 使用 TinyPNG API 进行 PNG 压缩（效果更好）
              console.log('[compress-image-stream] Using TinyPNG for PNG compression...');
              try {
                // 先用 Sharp 调整尺寸（如果需要），然后转为 PNG
                const pngBuffer = await sharpInstance.png().toBuffer();
                // 使用 TinyPNG 压缩
                const tinySource = tinify.fromBuffer(pngBuffer);
                compressedImage = await tinySource.toBuffer() as Buffer;
                console.log('[compress-image-stream] TinyPNG compression successful');
              } catch (tinifyError) {
                // 如果 TinyPNG 失败，回退到 Sharp 压缩
                console.error('[compress-image-stream] TinyPNG failed, falling back to Sharp:', tinifyError);
                compressedImage = await sharpInstance
                  .png({
                    compressionLevel: 9,
                    effort: 10,
                    palette: quality < 80,
                    colours: quality < 80 ? Math.max(16, Math.round(256 * quality / 100)) : 256
                  })
                  .toBuffer();
              }
              break;
            case 'webp':
              compressedImage = await sharpInstance
                .webp({ quality })
                .toBuffer();
              break;
            case 'jpeg':
            default:
              compressedImage = await sharpInstance
                .jpeg({
                  quality,
                  mozjpeg: true // 使用 mozjpeg 进行更好的压缩
                })
                .toBuffer();
              break;
          }

          const duration = Date.now() - startTime;
          console.log(`[compress-image-stream] Compression complete. Original: ${buffer.length}, Compressed: ${compressedImage.length}, Duration: ${duration}ms`);

          // 分块发送数据（模拟流式传输）
          const chunkSize = 64 * 1024; // 64KB 每块
          let offset = 0;

          while (offset < compressedImage.length) {
            const chunk = compressedImage.slice(offset, offset + chunkSize);
            controller.enqueue(chunk);
            offset += chunkSize;
          }

          controller.close();
        } catch (error) {
          console.error('[compress-image-stream] Stream error:', error);
          controller.error(error);
        }
      }
    });

    // 获取 MIME 类型
    const mimeType = getMimeType(outputFormat);
    const fileExtension = getFileExtension(outputFormat);

    // 返回流式响应
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Image-Format': outputFormat,
        'X-Image-Size': size ? `${size}x${size}` : 'original',
        'X-Image-Quality': quality.toString(),
        'Content-Disposition': `inline; filename="compressed.${fileExtension}"`,
        // 流式传输相关头
        'Transfer-Encoding': 'chunked'
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[compress-image-stream] Error after ${duration}ms:`, error);

    return NextResponse.json(
      { error: 'Failed to process image. Please ensure the file is a valid image.' },
      { status: 500 }
    );
  }
}

// GET 方法返回 API 说明
export async function GET() {
  return NextResponse.json({
    name: 'Image Compress Stream API',
    description: '流式图片压缩接口，支持多种输出格式',
    method: 'POST',
    contentType: 'image/*',
    parameters: {
      size: {
        type: 'string | number',
        default: '1200',
        options: ['500', '1200', 'original', '1-8192'],
        description: '输出图片最大尺寸（宽高中较大值）'
      },
      format: {
        type: 'string',
        default: 'webp',
        options: ['png', 'webp', 'jpg', 'jpeg', 'original'],
        description: '输出图片格式，original 表示保持原格式'
      },
      quality: {
        type: 'number',
        default: 85,
        range: '1-100',
        description: '压缩质量，数值越高质量越好，文件越大'
      }
    },
    examples: [
      {
        description: '压缩为 WebP 格式（默认）',
        url: '/api/compress-image-stream'
      },
      {
        description: '压缩为 PNG 格式',
        url: '/api/compress-image-stream?format=png'
      },
      {
        description: '压缩为 JPG 格式，尺寸 500px',
        url: '/api/compress-image-stream?format=jpg&size=500'
      },
      {
        description: '保持原格式，原尺寸，质量 70%',
        url: '/api/compress-image-stream?format=original&size=original&quality=70'
      }
    ],
    response: {
      success: '返回压缩后的图片二进制流',
      headers: {
        'Content-Type': '图片 MIME 类型',
        'X-Image-Format': '实际输出格式',
        'X-Image-Size': '输出尺寸',
        'X-Image-Quality': '压缩质量'
      }
    }
  });
}
