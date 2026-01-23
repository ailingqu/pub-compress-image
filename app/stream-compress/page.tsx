'use client'

import { useState, useRef } from 'react'

type OutputFormat = 'png' | 'webp' | 'jpg' | 'original'
type SizeOption = '500' | '1200' | 'original' | 'custom'

export default function StreamCompressPage() {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<OutputFormat>('webp')
  const [sizeOption, setSizeOption] = useState<SizeOption>('1200')
  const [customSize, setCustomSize] = useState<string>('800')
  const [quality, setQuality] = useState<number>(85)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<number>(0)
  const [result, setResult] = useState<{ blob: Blob; originalSize: number; compressedSize: number; format: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [streamInfo, setStreamInfo] = useState<{ chunks: number; bytesReceived: number } | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
      setResult(null)
      setStreamInfo(null)

      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(selectedFile)
    }
  }

  const handleCompress = async () => {
    if (!file) {
      setError('请先选择图片')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setProgress(0)
    setStreamInfo({ chunks: 0, bytesReceived: 0 })

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()

    try {
      const arrayBuffer = await file.arrayBuffer()

      // Build query parameters
      const size = sizeOption === 'custom' ? customSize : sizeOption
      const params = new URLSearchParams({
        format,
        size,
        quality: quality.toString()
      })

      const response = await fetch(`/api/compress-image-stream?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type
        },
        body: arrayBuffer,
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `压缩失败 (${response.status})`)
      }

      // Get response headers info
      const outputFormat = response.headers.get('X-Image-Format') || format

      // Read stream
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取响应流')
      }

      const chunks: Uint8Array[] = []
      let totalBytes = 0
      let chunkCount = 0

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        chunks.push(value)
        totalBytes += value.length
        chunkCount++

        // Update stream info
        setStreamInfo({ chunks: chunkCount, bytesReceived: totalBytes })

        // Simulate progress (since we don't know total size upfront in streaming)
        setProgress(Math.min(95, chunkCount * 10))
      }

      setProgress(100)

      // Combine chunks into a single blob
      const blob = new Blob(chunks as BlobPart[], { type: `image/${outputFormat === 'jpeg' ? 'jpeg' : outputFormat}` })

      setResult({
        blob,
        originalSize: file.size,
        compressedSize: blob.size,
        format: outputFormat
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('压缩已取消')
      } else {
        setError(err instanceof Error ? err.message : '压缩失败')
      }
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleDownload = () => {
    if (!result) return

    const ext = result.format === 'jpeg' ? 'jpg' : result.format
    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compressed.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const compressionRatio = result
    ? Math.round((1 - result.compressedSize / result.originalSize) * 100)
    : 0

  const formatOptions: { value: OutputFormat; label: string; desc: string }[] = [
    { value: 'webp', label: 'WebP', desc: '最佳压缩比，现代浏览器支持' },
    { value: 'jpg', label: 'JPG', desc: '兼容性最好，适合照片' },
    { value: 'png', label: 'PNG', desc: '使用 TinyPNG 智能压缩' },
    { value: 'original', label: '保持原格式', desc: '自动检测并保持原始格式' }
  ]

  const sizeOptions: { value: SizeOption; label: string }[] = [
    { value: '1200', label: '1200px' },
    { value: '500', label: '500px' },
    { value: 'original', label: '原尺寸' },
    { value: 'custom', label: '自定义' }
  ]

  return (
    <main style={{
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '900px',
      margin: '0 auto',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h1 style={{
            fontSize: '2rem',
            margin: 0,
            background: 'linear-gradient(135deg, #fd79a8 0%, #e84393 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            ⚡ 流式图片压缩
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
            🏠 返回首页
          </a>
        </div>
        <p style={{ color: '#6c757d', marginBottom: '2rem' }}>
          流式传输压缩，支持 PNG、WebP、JPG 格式，可保持原格式输出
        </p>

        {/* 上传区域 */}
        <div style={{
          border: '2px dashed #dee2e6',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          marginBottom: '1.5rem',
          backgroundColor: '#f8f9fa',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.currentTarget.style.borderColor = '#e84393'
          e.currentTarget.style.backgroundColor = '#ffeef8'
        }}
        onDragLeave={(e) => {
          e.currentTarget.style.borderColor = '#dee2e6'
          e.currentTarget.style.backgroundColor = '#f8f9fa'
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.currentTarget.style.borderColor = '#dee2e6'
          e.currentTarget.style.backgroundColor = '#f8f9fa'
          const droppedFile = e.dataTransfer.files[0]
          if (droppedFile && droppedFile.type.startsWith('image/')) {
            setFile(droppedFile)
            setResult(null)
            setStreamInfo(null)
            const reader = new FileReader()
            reader.onload = (e) => setPreview(e.target?.result as string)
            reader.readAsDataURL(droppedFile)
          }
        }}>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="file-upload"
          />
          <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'block' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📁</div>
            <div style={{ color: '#495057', marginBottom: '0.5rem' }}>
              {file ? file.name : '点击选择图片或拖拽到此处'}
            </div>
            <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>
              支持 JPG、PNG、GIF、WebP 等格式，最大 100MB
            </div>
          </label>
        </div>

        {/* 预览图 */}
        {preview && (
          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <img
              src={preview}
              alt="预览"
              style={{
                maxWidth: '100%',
                maxHeight: '250px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            />
            <div style={{ marginTop: '0.5rem', color: '#6c757d', fontSize: '0.875rem' }}>
              原始大小: {formatBytes(file?.size || 0)} | 类型: {file?.type}
            </div>
          </div>
        )}

        {/* 格式选择 */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '600',
            color: '#495057'
          }}>
            输出格式:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            {formatOptions.map((opt) => (
              <label key={opt.value} style={{
                padding: '0.75rem',
                border: `2px solid ${format === opt.value ? '#e84393' : '#dee2e6'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: format === opt.value ? '#ffeef8' : 'white',
                transition: 'all 0.3s ease'
              }}>
                <input
                  type="radio"
                  value={opt.value}
                  checked={format === opt.value}
                  onChange={(e) => setFormat(e.target.value as OutputFormat)}
                  style={{ marginRight: '0.5rem' }}
                />
                <strong>{opt.label}</strong>
                <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: '0.25rem', marginLeft: '1.25rem' }}>
                  {opt.desc}
                </div>
              </label>
            ))}
          </div>
          {/* PNG 格式提示 */}
          {(format === 'png' || (format === 'original' && file?.type === 'image/png')) && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              backgroundColor: '#d1f2eb',
              border: '1px solid #a3e4d7',
              borderRadius: '6px',
              fontSize: '0.85rem',
              color: '#0f5132'
            }}>
              🐼 <strong>PNG 优化：</strong>使用 TinyPNG 智能压缩，可减少 50-80% 文件大小，同时保持高质量。
            </div>
          )}
        </div>

        {/* 尺寸选择 */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '600',
            color: '#495057'
          }}>
            输出尺寸:
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {sizeOptions.map((opt) => (
              <label key={opt.value} style={{
                padding: '0.5rem 1rem',
                border: `2px solid ${sizeOption === opt.value ? '#e84393' : '#dee2e6'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: sizeOption === opt.value ? '#ffeef8' : 'white',
                transition: 'all 0.3s ease'
              }}>
                <input
                  type="radio"
                  value={opt.value}
                  checked={sizeOption === opt.value}
                  onChange={(e) => setSizeOption(e.target.value as SizeOption)}
                  style={{ marginRight: '0.5rem' }}
                />
                {opt.label}
              </label>
            ))}
            {sizeOption === 'custom' && (
              <input
                type="number"
                value={customSize}
                onChange={(e) => setCustomSize(e.target.value)}
                min="1"
                max="8192"
                style={{
                  padding: '0.5rem',
                  border: '2px solid #e84393',
                  borderRadius: '6px',
                  width: '100px',
                  fontSize: '1rem'
                }}
                placeholder="1-8192"
              />
            )}
          </div>
        </div>

        {/* 质量滑块 */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '600',
            color: '#495057'
          }}>
            压缩质量: <span style={{ color: '#e84393' }}>{quality}%</span>
          </label>
          <input
            type="range"
            min="1"
            max="100"
            value={quality}
            onChange={(e) => setQuality(parseInt(e.target.value))}
            style={{
              width: '100%',
              height: '8px',
              borderRadius: '4px',
              appearance: 'none',
              background: `linear-gradient(to right, #e84393 0%, #e84393 ${quality}%, #dee2e6 ${quality}%, #dee2e6 100%)`,
              cursor: 'pointer'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6c757d' }}>
            <span>低质量 / 小文件</span>
            <span>高质量 / 大文件</span>
          </div>
        </div>

        {/* 压缩按钮 */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <button
            onClick={handleCompress}
            disabled={!file || loading}
            style={{
              flex: 1,
              padding: '1rem 2rem',
              fontSize: '1.125rem',
              fontWeight: '600',
              color: 'white',
              background: !file || loading
                ? '#adb5bd'
                : 'linear-gradient(135deg, #fd79a8 0%, #e84393 100%)',
              border: 'none',
              borderRadius: '8px',
              cursor: !file || loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: !file || loading ? 'none' : '0 4px 12px rgba(232, 67, 147, 0.4)'
            }}
          >
            {loading ? '⏳ 流式压缩中...' : '⚡ 开始流式压缩'}
          </button>
          {loading && (
            <button
              onClick={handleCancel}
              style={{
                padding: '1rem 2rem',
                fontSize: '1.125rem',
                fontWeight: '600',
                color: 'white',
                background: '#dc3545',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              ❌ 取消
            </button>
          )}
        </div>

        {/* 进度条 */}
        {loading && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              height: '8px',
              backgroundColor: '#e9ecef',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(135deg, #fd79a8 0%, #e84393 100%)',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }} />
            </div>
            {streamInfo && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6c757d', textAlign: 'center' }}>
                已接收 {streamInfo.chunks} 个数据块 | {formatBytes(streamInfo.bytesReceived)}
              </div>
            )}
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffecb5',
            borderRadius: '8px',
            color: '#856404',
            marginBottom: '1rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* 结果展示 */}
        {result && (
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#d1f2eb',
            border: '1px solid #a3e4d7',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#0f5132',
              marginBottom: '1rem'
            }}>
              ✅ 流式压缩完成！
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <div>
                <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>原始大小</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f5132' }}>
                  {formatBytes(result.originalSize)}
                </div>
              </div>
              <div>
                <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>压缩后</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f5132' }}>
                  {formatBytes(result.compressedSize)}
                </div>
              </div>
              <div>
                <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>压缩比</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: compressionRatio > 0 ? '#0f5132' : '#dc3545' }}>
                  {compressionRatio > 0 ? `${compressionRatio}%` : `+${Math.abs(compressionRatio)}%`}
                </div>
              </div>
              <div>
                <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>输出格式</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f5132' }}>
                  {result.format.toUpperCase()}
                </div>
              </div>
            </div>
            {streamInfo && (
              <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#0f5132' }}>
                📊 流式传输: 共 {streamInfo.chunks} 个数据块
              </div>
            )}
            <button
              onClick={handleDownload}
              style={{
                width: '100%',
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                fontWeight: '600',
                color: 'white',
                background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(17, 153, 142, 0.4)'
              }}
            >
              💾 下载压缩图片 (.{result.format === 'jpeg' ? 'jpg' : result.format})
            </button>
          </div>
        )}

        {/* API 文档 */}
        <details style={{ marginTop: '2rem' }}>
          <summary style={{
            cursor: 'pointer',
            fontWeight: '600',
            padding: '0.75rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            📚 API 使用文档
          </summary>

          <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0 }}>API 端点</h3>
            <code style={{
              display: 'block',
              padding: '0.5rem',
              backgroundColor: '#e9ecef',
              borderRadius: '4px',
              marginBottom: '1rem'
            }}>
              POST /api/compress-image-stream?format=webp&size=1200&quality=85
            </code>

            <h3>参数说明</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#e9ecef' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #dee2e6' }}>参数</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #dee2e6' }}>默认值</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #dee2e6' }}>可选值</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>format</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>webp</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>png, webp, jpg, original</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>size</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>1200</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>500, 1200, original, 1-8192</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>quality</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>85</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>1-100</td>
                </tr>
              </tbody>
            </table>

            <h3>cURL 示例</h3>
            <pre style={{
              background: '#282c34',
              color: '#abb2bf',
              padding: '1rem',
              borderRadius: '8px',
              overflow: 'auto',
              fontSize: '0.8rem'
            }}>
{`# 压缩为 WebP (默认)
curl -X POST \\
  -H "Content-Type: image/png" \\
  --data-binary @image.png \\
  "http://localhost:3000/api/compress-image-stream" \\
  -o output.webp

# 压缩为 PNG
curl -X POST \\
  -H "Content-Type: image/jpeg" \\
  --data-binary @photo.jpg \\
  "http://localhost:3000/api/compress-image-stream?format=png" \\
  -o output.png

# 压缩为 JPG, 500px, 质量70%
curl -X POST \\
  -H "Content-Type: image/png" \\
  --data-binary @image.png \\
  "http://localhost:3000/api/compress-image-stream?format=jpg&size=500&quality=70" \\
  -o output.jpg

# 保持原格式和原尺寸
curl -X POST \\
  -H "Content-Type: image/png" \\
  --data-binary @image.png \\
  "http://localhost:3000/api/compress-image-stream?format=original&size=original" \\
  -o output.png`}
            </pre>

            <h3>特性</h3>
            <ul style={{ color: '#495057' }}>
              <li><strong>流式传输</strong>: 分块返回数据，适合大文件</li>
              <li><strong>多格式支持</strong>: PNG、WebP、JPG/JPEG</li>
              <li><strong>保持原格式</strong>: format=original 自动检测</li>
              <li><strong>自定义尺寸</strong>: 1-8192px 任意值</li>
              <li><strong>质量控制</strong>: 1-100 可调</li>
            </ul>
          </div>
        </details>

        {/* 页脚 */}
        <div style={{
          marginTop: '3rem',
          paddingTop: '2rem',
          borderTop: '1px solid #dee2e6',
          textAlign: 'center',
          color: '#6c757d',
          fontSize: '0.875rem'
        }}>
          <div style={{ marginBottom: '0.5rem' }}>
            由 <a
              href="https://nanobananas.ai/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#e84393', textDecoration: 'none', fontWeight: '600' }}
            >
              NanoBananas AI
            </a> 提供技术支持
          </div>
          <div>
            开源项目 •
            <a
              href="https://github.com/ailingqu/pub-compress-image"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#e84393', textDecoration: 'none', marginLeft: '0.5rem' }}
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
