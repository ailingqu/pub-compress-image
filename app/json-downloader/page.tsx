'use client';

import { useState } from 'react';

interface ExtractedUrl {
  url: string;
  path: string;
  type: 'image' | 'video' | 'unknown';
}

export default function JsonDownloader() {
  const [jsonInput, setJsonInput] = useState('');
  const [extractedUrls, setExtractedUrls] = useState<ExtractedUrl[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadProgress, setDownloadProgress] = useState('');

  // 从JSON中递归提取所有URL
  const extractUrlsFromJson = (obj: any, urls: Set<string> = new Set()): Set<string> => {
    if (typeof obj === 'string') {
      // 检测URL模式（支持带或不带文件扩展名的URL）
      const urlPattern = /(https?:\/\/[^\s"'<>]+)/gi;
      const matches = obj.match(urlPattern);
      if (matches) {
        matches.forEach(url => {
          // 清理URL末尾可能的标点符号
          url = url.replace(/[,;:\]})]+$/, '');
          urls.add(url);
        });
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(item => extractUrlsFromJson(item, urls));
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(value => extractUrlsFromJson(value, urls));
    }
    return urls;
  };

  // 直接从文本中提取所有HTTP(S) URL
  const extractUrlsFromText = (text: string): Set<string> => {
    const urls = new Set<string>();
    // 提取所有HTTP(S) URL
    const urlPattern = /(https?:\/\/[^\s"'<>]+)/gi;
    const matches = text.match(urlPattern);
    if (matches) {
      matches.forEach(url => {
        // 清理URL末尾可能的标点符号
        url = url.replace(/[,;:\]})]+$/, '');
        urls.add(url);
      });
    }
    return urls;
  };

  // 解析URL路径和类型
  const parseUrl = (url: string): ExtractedUrl => {
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif'];
    const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v', 'mpg', 'mpeg'];

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // 提取文件扩展名（如果有）
      const pathParts = pathname.split('/').filter(p => p);
      const lastPart = pathParts[pathParts.length - 1] || '';
      const extMatch = lastPart.match(/\.([a-z0-9]+)$/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : '';

      let type: 'image' | 'video' | 'unknown' = 'unknown';

      if (ext) {
        // 如果有扩展名，根据扩展名判断
        if (imageExts.includes(ext)) type = 'image';
        else if (videoExts.includes(ext)) type = 'video';
      } else {
        // 如果没有扩展名，根据路径和域名进行智能判断
        const lowerUrl = url.toLowerCase();
        const lowerPath = pathname.toLowerCase();

        // 常见的图片URL模式
        if (
          lowerPath.includes('/image') ||
          lowerPath.includes('/photo') ||
          lowerPath.includes('/picture') ||
          lowerPath.includes('/img') ||
          lowerPath.includes('/avatar') ||
          lowerPath.includes('/thumb') ||
          lowerPath.includes('/icon') ||
          lowerUrl.includes('placeholder.com') ||
          lowerUrl.includes('picsum.photos') ||
          lowerUrl.includes('unsplash.com') ||
          lowerUrl.includes('pexels.com') ||
          lowerUrl.includes('imgur.com')
        ) {
          type = 'image';
        }
        // 常见的视频URL模式
        else if (
          lowerPath.includes('/video') ||
          lowerPath.includes('/media') ||
          lowerPath.includes('/clip') ||
          lowerUrl.includes('youtube.com') ||
          lowerUrl.includes('vimeo.com') ||
          lowerUrl.includes('dailymotion.com')
        ) {
          type = 'video';
        }
      }

      return { url, path: pathname, type };
    } catch {
      return { url, path: url, type: 'unknown' };
    }
  };

  // 解析JSON（支持单引号和双引号，失败时使用正则提取）
  const handleParse = () => {
    setError('');
    setExtractedUrls([]);

    let urlSet: Set<string>;
    let isJsonParsed = false;

    try {
      let parsed;

      // 先尝试标准JSON解析
      try {
        parsed = JSON.parse(jsonInput);
        isJsonParsed = true;
      } catch (firstError) {
        // 如果失败，尝试将单引号替换为双引号后再解析
        try {
          const normalizedJson = jsonInput.replace(/'/g, '"');
          parsed = JSON.parse(normalizedJson);
          isJsonParsed = true;
        } catch (secondError) {
          // JSON解析失败，使用正则表达式提取URL
          console.log('JSON解析失败，使用正则表达式提取URL');
          urlSet = extractUrlsFromText(jsonInput);

          if (urlSet.size === 0) {
            setError('未找到任何URL。请确保输入包含有效的HTTP(S) URL。');
            return;
          }

          const urls = Array.from(urlSet).map(parseUrl);
          setExtractedUrls(urls);
          setError('⚠️ JSON格式无效，已使用正则表达式提取URL（共 ' + urls.length + ' 个）');
          return;
        }
      }

      // JSON解析成功
      urlSet = extractUrlsFromJson(parsed);
      const urls = Array.from(urlSet).map(parseUrl);

      if (urls.length === 0) {
        setError('未找到任何URL');
      } else {
        setExtractedUrls(urls);
      }
    } catch (err) {
      setError('处理失败：' + (err as Error).message);
    }
  };

  // 下载并打包
  const handleDownload = async () => {
    if (extractedUrls.length === 0) return;

    setIsLoading(true);
    setDownloadProgress('正在准备下载...');
    setError('');

    try {
      const response = await fetch('/api/download-urls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urls: extractedUrls.map(u => u.url)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '下载失败');
      }

      setDownloadProgress('正在打包文件...');

      // 获取blob并触发下载
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `downloaded-files-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadProgress('下载完成！');
      setTimeout(() => setDownloadProgress(''), 3000);
    } catch (err) {
      setError('下载失败：' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={{
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* 头部 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h1 style={{
              fontSize: '2.5rem',
              margin: 0,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              📦 JSON URL 下载器
            </h1>
            <a
              href="/"
              style={{
                padding: '0.5rem 1rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: '600'
              }}
            >
              ← 返回首页
            </a>
          </div>
          <p style={{ color: '#6c757d', margin: 0 }}>
            解析JSON字符串，提取并批量下载图片和视频
          </p>
        </div>

        {/* 主要内容区域 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {/* 左侧：输入区域 */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#495057',
              marginTop: 0,
              marginBottom: '1rem'
            }}>
              输入JSON
            </h2>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='粘贴JSON字符串，例如：&#10;{&#10;  "images": ["https://example.com/path/to/image1.jpg"],&#10;  "videos": ["https://example.com/media/video.mp4"]&#10;}'
              style={{
                width: '100%',
                height: '400px',
                padding: '1rem',
                border: '2px solid #dee2e6',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                resize: 'vertical',
                outline: 'none',
                transition: 'border-color 0.3s ease',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#dee2e6'}
            />

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                onClick={handleParse}
                disabled={!jsonInput.trim()}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: 'white',
                  background: !jsonInput.trim()
                    ? '#adb5bd'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: !jsonInput.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                🔍 解析 JSON
              </button>
              <button
                onClick={() => {
                  setJsonInput('');
                  setExtractedUrls([]);
                  setError('');
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: 'white',
                  background: '#6c757d',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                🗑️ 清空
              </button>
            </div>

            {error && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffecb5',
                borderRadius: '8px',
                color: '#856404'
              }}>
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* 右侧：结果区域 */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#495057',
                margin: 0
              }}>
                提取的URL ({extractedUrls.length})
              </h2>
              {extractedUrls.length > 0 && (
                <button
                  onClick={handleDownload}
                  disabled={isLoading}
                  style={{
                    padding: '0.6rem 1.2rem',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: 'white',
                    background: isLoading
                      ? '#adb5bd'
                      : 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {isLoading ? '⏳ 下载中...' : '📥 打包下载'}
                </button>
              )}
            </div>

            {downloadProgress && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                backgroundColor: '#d1f2eb',
                border: '1px solid #a3e4d7',
                borderRadius: '8px',
                color: '#0f5132'
              }}>
                {downloadProgress}
              </div>
            )}

            <div style={{
              height: '500px',
              overflowY: 'auto',
              border: '2px solid #dee2e6',
              borderRadius: '8px'
            }}>
              {extractedUrls.length === 0 ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: '#adb5bd',
                  textAlign: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📄</div>
                    <p>暂无提取结果</p>
                  </div>
                </div>
              ) : (
                <div>
                  {extractedUrls.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid #dee2e6',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <span style={{
                          padding: '0.2rem 0.4rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: '600',
                          flexShrink: 0,
                          height: 'fit-content',
                          backgroundColor: item.type === 'image'
                            ? '#dbeafe'
                            : item.type === 'video'
                            ? '#e9d5ff'
                            : '#e5e7eb',
                          color: item.type === 'image'
                            ? '#1e40af'
                            : item.type === 'video'
                            ? '#6b21a8'
                            : '#374151'
                        }}>
                          {item.type === 'image' ? '🖼️' : item.type === 'video' ? '🎬' : '❓'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                          <p style={{
                            margin: 0,
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            color: '#212529',
                            wordBreak: 'break-all',
                            lineHeight: '1.3'
                          }}>
                            {item.path.split('/').pop() || 'unknown'}
                          </p>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={item.url}
                            style={{
                              fontSize: '0.7rem',
                              color: '#667eea',
                              textDecoration: 'none',
                              wordBreak: 'break-all',
                              lineHeight: '1.4',
                              display: 'block',
                              marginTop: '0.2rem'
                            }}
                          >
                            {item.url}
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 使用说明 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            color: '#495057',
            marginTop: 0,
            marginBottom: '1.5rem'
          }}>
            📖 使用说明
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>1️⃣</div>
              <p style={{ margin: 0, color: '#495057' }}>在左侧文本框中粘贴包含URL的JSON字符串</p>
            </div>
            <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>2️⃣</div>
              <p style={{ margin: 0, color: '#495057' }}>点击"解析 JSON"按钮，自动提取所有图片和视频URL</p>
            </div>
            <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>3️⃣</div>
              <p style={{ margin: 0, color: '#495057' }}>在右侧查看提取结果，确认后点击"打包下载"</p>
            </div>
            <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>4️⃣</div>
              <p style={{ margin: 0, color: '#495057' }}>下载的ZIP文件会保持原URL的目录结构</p>
            </div>
          </div>

          <div style={{
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px'
          }}>
            <p style={{
              margin: '0 0 0.75rem 0',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#495057'
            }}>
              支持的文件类型：
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {['JPG', 'PNG', 'GIF', 'WEBP', 'BMP', 'SVG'].map(ext => (
                <span key={ext} style={{
                  padding: '0.25rem 0.75rem',
                  backgroundColor: '#dbeafe',
                  color: '#1e40af',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  borderRadius: '4px'
                }}>
                  {ext}
                </span>
              ))}
              {['MP4', 'AVI', 'MOV', 'WEBM', 'FLV', 'MKV'].map(ext => (
                <span key={ext} style={{
                  padding: '0.25rem 0.75rem',
                  backgroundColor: '#e9d5ff',
                  color: '#6b21a8',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  borderRadius: '4px'
                }}>
                  {ext}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
