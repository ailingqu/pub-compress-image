export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import sharp from 'sharp';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log('[compress-image] Request received');

  try {
    // Get size parameter from query string (default: 1200)
    const { searchParams } = new URL(req.url);
    const sizeParam = searchParams.get('size') || '1200';
    console.log('[compress-image] Size param:', sizeParam);

    // Validate size parameter (only allow 1200 or 500)
    let size: number;
    if (sizeParam === '500') {
      size = 500;
    } else if (sizeParam === '1200') {
      size = 1200;
    } else {
      console.log('[compress-image] Invalid size parameter:', sizeParam);
      return NextResponse.json(
        { error: 'Invalid size parameter. Use size=500 or size=1200' },
        { status: 400 }
      );
    }

    // Validate content-type
    const contentType = req.headers.get('content-type');
    console.log('[compress-image] Content-Type:', contentType);
    if (!contentType?.startsWith('image/')) {
      console.log('[compress-image] Invalid content type');
      return NextResponse.json(
        { error: 'Invalid content type. Please upload an image.' },
        { status: 400 }
      );
    }

    // Get image buffer
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('[compress-image] Received buffer size:', buffer.length);

    // Validate buffer size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (buffer.length > maxSize) {
      console.log('[compress-image] File too large:', buffer.length);
      return NextResponse.json(
        { error: 'Image too large. Maximum size is 100MB.' },
        { status: 413 }
      );
    }

    // Validate buffer is not empty
    if (buffer.length === 0) {
      console.log('[compress-image] Empty buffer received');
      return NextResponse.json(
        { error: 'Empty image data received.' },
        { status: 400 }
      );
    }

    // Process image with Sharp
    console.log('[compress-image] Starting compression...');
    const compressedImage = await sharp(buffer)
      .resize(size, size, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 85 })
      .toBuffer();

    const duration = Date.now() - startTime;
    console.log(`[compress-image] Compression complete. Original: ${buffer.length}, Compressed: ${compressedImage.length}, Duration: ${duration}ms`);

    // Return compressed image
    return new Response(compressedImage as any, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': compressedImage.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Image-Size': `${size}x${size}`
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[compress-image] Error after ${duration}ms:`, error);

    return NextResponse.json(
      { error: 'Failed to process image. Please ensure the file is a valid image.' },
      { status: 500 }
    );
  }
}
