export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

interface ExtractResponse {
  originalName: string;
  originalSize: number;
  audioSize: number;
  videoSize: number;
  audioData: string; // base64
  videoData: string; // base64
  audioFormat: string;
  success: boolean;
  error?: string;
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const audioFormat = searchParams.get('format') || 'mp3'; // mp3 or aac

  let inputPath = '';
  let audioPath = '';
  let videoPath = '';

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
    const baseName = path.basename(file.name, originalExt);

    inputPath = path.join(tempDir, `${uuid}_input${originalExt}`);
    audioPath = path.join(tempDir, `${uuid}_audio.${audioFormat}`);
    videoPath = path.join(tempDir, `${uuid}_video_noaudio.mp4`);

    // 写入临时文件
    fs.writeFileSync(inputPath, buffer);

    // 提取音频
    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg(inputPath)
        .noVideo()
        .audioCodec(audioFormat === 'mp3' ? 'libmp3lame' : 'aac')
        .audioBitrate('192k');

      if (audioFormat === 'mp3') {
        cmd.format('mp3');
      } else {
        cmd.format('adts'); // AAC 格式
      }

      cmd.save(audioPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    // 提取无声视频
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .noAudio()
        .videoCodec('copy') // 不重新编码视频，速度更快
        .format('mp4')
        .outputOptions(['-movflags +faststart'])
        .save(videoPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    // 读取输出文件
    const audioBuffer = fs.readFileSync(audioPath);
    const videoBuffer = fs.readFileSync(videoPath);

    // 清理临时文件
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);

    // 返回 base64 数据
    const response: ExtractResponse = {
      originalName: file.name,
      originalSize: file.size,
      audioSize: audioBuffer.length,
      videoSize: videoBuffer.length,
      audioData: audioBuffer.toString('base64'),
      videoData: videoBuffer.toString('base64'),
      audioFormat,
      success: true
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Audio extraction error:', error);

    // 清理临时文件
    try {
      if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
    } catch {
      // 忽略清理错误
    }

    return NextResponse.json(
      { error: '音频提取失败，请确保视频包含音频轨道', success: false },
      { status: 500 }
    );
  }
}
