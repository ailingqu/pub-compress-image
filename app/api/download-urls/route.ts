import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 最长5分钟

interface DownloadRequest {
  urls: string[];
}

// 从URL提取路径结构
function getFilePath(url: string): string {
  try {
    const urlObj = new URL(url);
    // 去掉开头的斜杠，保留完整路径结构
    let path = urlObj.pathname.substring(1);

    // 如果有查询参数，清理文件名
    if (urlObj.search) {
      const parts = path.split('/');
      const fileName = parts[parts.length - 1];
      const cleanFileName = fileName.split('?')[0];
      parts[parts.length - 1] = cleanFileName;
      path = parts.join('/');
    }

    // 使用域名作为根目录
    return `${urlObj.hostname}/${path}`;
  } catch (error) {
    // 如果URL解析失败，使用原始路径
    return url.replace(/^https?:\/\//, '').replace(/\?.*$/, '');
  }
}

// 下载单个文件
async function downloadFile(url: string): Promise<{ success: boolean; data?: ArrayBuffer; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const arrayBuffer = await response.arrayBuffer();
    return { success: true, data: arrayBuffer };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '下载失败';
    return { success: false, error: errorMessage };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: DownloadRequest = await request.json();
    const { urls } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: '请提供有效的URL数组' },
        { status: 400 }
      );
    }

    // 限制URL数量
    if (urls.length > 100) {
      return NextResponse.json(
        { error: 'URL数量超过限制（最多100个）' },
        { status: 400 }
      );
    }

    const zip = new JSZip();
    const results: { url: string; path: string; status: string }[] = [];
    let successCount = 0;
    let failCount = 0;

    // 并发下载文件（限制并发数为5）
    const concurrentLimit = 5;
    for (let i = 0; i < urls.length; i += concurrentLimit) {
      const batch = urls.slice(i, i + concurrentLimit);

      await Promise.all(
        batch.map(async (url) => {
          const filePath = getFilePath(url);
          const result = await downloadFile(url);

          if (result.success && result.data) {
            zip.file(filePath, result.data);
            results.push({ url, path: filePath, status: 'success' });
            successCount++;
          } else {
            results.push({ url, path: filePath, status: `failed: ${result.error}` });
            failCount++;

            // 添加失败记录到zip
            const errorInfo = `Failed to download: ${result.error}\nURL: ${url}\n`;
            zip.file(`_errors/${filePath}.txt`, errorInfo);
          }
        })
      );
    }

    // 添加下载报告
    const report = `下载报告
================
总URL数: ${urls.length}
成功: ${successCount}
失败: ${failCount}
时间: ${new Date().toLocaleString('zh-CN')}

详细结果:
${results.map((r, i) => `${i + 1}. ${r.status} - ${r.url}`).join('\n')}
`;

    zip.file('_download_report.txt', report);

    // 生成ZIP
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // 返回ZIP文件
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="downloaded-files-${Date.now()}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      {
        error: '处理失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}
