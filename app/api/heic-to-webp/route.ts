export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import sharp from 'sharp';
import { NextRequest, NextResponse } from 'next/server';
import convert from 'heic-convert';

export async function POST(req: NextRequest) {
  try {
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

    // Check if it's a HEIC/HEIF file by checking magic bytes
    // HEIC files start with "ftyp" at offset 4
    const isHeic = buffer.length > 12 &&
      buffer.slice(4, 8).toString() === 'ftyp' &&
      (buffer.slice(8, 12).toString() === 'heic' ||
       buffer.slice(8, 12).toString() === 'heix' ||
       buffer.slice(8, 12).toString() === 'hevc' ||
       buffer.slice(8, 12).toString() === 'hevx' ||
       buffer.slice(8, 12).toString() === 'mif1' ||
       buffer.slice(8, 12).toString() === 'msf1');

    let imageBuffer: Buffer;

    if (isHeic) {
      // Convert HEIC to PNG first using heic-convert
      const pngBuffer = await convert({
        buffer: buffer,
        format: 'PNG',
        quality: 1
      });
      imageBuffer = Buffer.from(pngBuffer);
    } else {
      // For non-HEIC images, use directly
      imageBuffer = buffer;
    }

    // Convert to WebP with compression
    // Keep original resolution, only compress file size
    const convertedImage = await sharp(imageBuffer)
      .webp({ quality: 85 })
      .toBuffer();

    // Return converted image
    return new Response(convertedImage as any, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': convertedImage.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });

  } catch (error) {
    console.error('HEIC to WebP conversion error:', error);

    return NextResponse.json(
      { error: 'Failed to convert image. Please ensure the file is a valid HEIC/HEIF image.' },
      { status: 500 }
    );
  }
}
