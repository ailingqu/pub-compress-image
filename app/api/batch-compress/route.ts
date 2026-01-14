export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import sharp from 'sharp';
import { NextRequest, NextResponse } from 'next/server';

interface CompressResult {
  originalName: string;
  originalSize: number;
  compressedSize?: number;
  compressionRatio?: number;
  data?: string; // base64
  success: boolean;
  error?: string;
}

interface BatchResponse {
  results: CompressResult[];
  totalOriginalSize: number;
  totalCompressedSize: number;
  overallCompressionRatio: number;
  successCount: number;
  failCount: number;
}

export async function POST(req: NextRequest) {
  try {
    // Get size parameter from query string (default: 1200, 'original' for no resize)
    const { searchParams } = new URL(req.url);
    const sizeParam = searchParams.get('size') || '1200';

    // Validate size parameter (allow 1200, 500, or 'original')
    let size: number | null = null;
    if (sizeParam === 'original') {
      size = null; // No resize
    } else if (sizeParam === '500') {
      size = 500;
    } else if (sizeParam === '1200') {
      size = 1200;
    } else {
      return NextResponse.json(
        { error: 'Invalid size parameter. Use size=500, size=1200, or size=original' },
        { status: 400 }
      );
    }

    // Parse FormData
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded. Please upload at least one image.' },
        { status: 400 }
      );
    }

    // Limit number of files
    const maxFiles = 20;
    if (files.length > maxFiles) {
      return NextResponse.json(
        { error: `Too many files. Maximum is ${maxFiles} files per request.` },
        { status: 400 }
      );
    }

    // Process all files in parallel
    const results: CompressResult[] = await Promise.all(
      files.map(async (file): Promise<CompressResult> => {
        const originalName = file.name;
        const originalSize = file.size;

        try {
          // Validate file type
          if (!file.type.startsWith('image/')) {
            return {
              originalName,
              originalSize,
              success: false,
              error: 'Invalid file type. Only images are allowed.'
            };
          }

          // Validate file size (max 100MB per file)
          const maxSize = 100 * 1024 * 1024;
          if (file.size > maxSize) {
            return {
              originalName,
              originalSize,
              success: false,
              error: 'File too large. Maximum size is 100MB.'
            };
          }

          // Get image buffer
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          if (buffer.length === 0) {
            return {
              originalName,
              originalSize,
              success: false,
              error: 'Empty file received.'
            };
          }

          // Process image with Sharp
          let sharpInstance = sharp(buffer);

          // Only resize if size is specified (not 'original')
          if (size !== null) {
            sharpInstance = sharpInstance.resize(size, size, {
              fit: 'inside',
              withoutEnlargement: true
            });
          }

          const compressedImage = await sharpInstance
            .webp({ quality: 85 })
            .toBuffer();

          const compressedSize = compressedImage.length;
          const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100);

          // Convert to base64
          const base64Data = compressedImage.toString('base64');

          return {
            originalName,
            originalSize,
            compressedSize,
            compressionRatio,
            data: base64Data,
            success: true
          };
        } catch (error) {
          console.error(`Error processing ${originalName}:`, error);
          return {
            originalName,
            originalSize,
            success: false,
            error: 'Failed to process image. Please ensure the file is a valid image.'
          };
        }
      })
    );

    // Calculate totals
    const successResults = results.filter(r => r.success);
    const failResults = results.filter(r => !r.success);

    const totalOriginalSize = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalCompressedSize = successResults.reduce((sum, r) => sum + (r.compressedSize || 0), 0);
    const overallCompressionRatio = totalOriginalSize > 0
      ? Math.round((1 - totalCompressedSize / totalOriginalSize) * 100)
      : 0;

    const response: BatchResponse = {
      results,
      totalOriginalSize,
      totalCompressedSize,
      overallCompressionRatio,
      successCount: successResults.length,
      failCount: failResults.length
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Batch compression error:', error);

    return NextResponse.json(
      { error: 'Failed to process images. Please try again.' },
      { status: 500 }
    );
  }
}
