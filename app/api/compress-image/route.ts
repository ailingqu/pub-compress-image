export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import sharp from 'sharp';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Get size parameter from query string (default: 1200)
    const { searchParams } = new URL(req.url);
    const sizeParam = searchParams.get('size') || '1200';

    // Validate size parameter (only allow 1200 or 500)
    let size: number;
    if (sizeParam === '500') {
      size = 500;
    } else if (sizeParam === '1200') {
      size = 1200;
    } else {
      return NextResponse.json(
        { error: 'Invalid size parameter. Use size=500 or size=1200' },
        { status: 400 }
      );
    }

    // Validate content-type
    const contentType = req.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Invalid content type. Please upload an image.' },
        { status: 400 }
      );
    }

    // Get image buffer
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate buffer size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (buffer.length > maxSize) {
      return NextResponse.json(
        { error: 'Image too large. Maximum size is 100MB.' },
        { status: 413 }
      );
    }

    // Validate buffer is not empty
    if (buffer.length === 0) {
      return NextResponse.json(
        { error: 'Empty image data received.' },
        { status: 400 }
      );
    }

    // Process image with Sharp
    const compressedImage = await sharp(buffer)
      .resize(size, size, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 85 })
      .toBuffer();

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
    console.error('Image compression error:', error);

    return NextResponse.json(
      { error: 'Failed to process image. Please ensure the file is a valid image.' },
      { status: 500 }
    );
  }
}
