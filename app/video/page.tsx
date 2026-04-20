'use client'

import { useState, useCallback } from 'react'

interface CompressResponse {
  originalName: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  data: string;
  success: boolean;
  error?: string;
}

export default function VideoPage() {
  const [file, setFile] = useState<File | null>(null)
  const [quality, setQuality] = useState<'high' | 'balanced' | 'small'>('balanced')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CompressResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
      setResult(null)

      // 生成视频预览
      const url = URL.createObjectURL(selectedFile)
      setPreview(url)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type.startsWith('video/')) {
      setFile(droppedFile)
      setError(null)
      setResult(null)
      const url = URL.createObjectURL(droppedFile)
      setPreview(url)
    }
  }, [])

  const handleCompress = async () => {
    if (!file) {
      setError('请先选择视频')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/compress-video?quality=${quality}`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `压缩失败 (${response.status})`)
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '压缩失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!result || !result.success || !result.data) return

    const byteCharacters = atob(result.data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'video/mp4' })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // 保留原文件名，扩展名改为 .mp4
    const newName = result.originalName.replace(/\.[^.]+$/, '_compressed.mp4')
    a.download = newName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

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
        {/* 标题和导航 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h1 style={{
            fontSize: '2rem',
            margin: 0,
            background: 'linear-gradient(135deg, #e74c3c 0%, #9b59b6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            🎬 视频压缩工具
          </h1>
          <a
            href="/"
            style={{
              color: '#667eea',
              textDecoration: 'none',
              fontSize: '0.9rem'
            }}
          >
            ← 返回首页
          </a>
        </div>
        <p style={{ color: '#6c757d', marginBottom: '2rem' }}>
          将视频压缩为 MP4 格式 (H.264)，大幅减少文件体积
        </p>

        {/* 上传区域 */}
        <div
          style={{
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
            e.currentTarget.style.borderColor = '#e74c3c'
            e.currentTarget.style.backgroundColor = '#fdf2f2'
          }}
          onDragLeave={(e) => {
            e.currentTarget.style.borderColor = '#dee2e6'
            e.currentTarget.style.backgroundColor = '#f8f9fa'
          }}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="video-upload"
          />
          <label htmlFor="video-upload" style={{ cursor: 'pointer', display: 'block' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎥</div>
            <div style={{ color: '#495057', marginBottom: '0.5rem' }}>
              {file ? file.name : '点击选择视频或拖拽到此处'}
            </div>
            <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>
              支持 MP4、MOV、AVI、MKV、WebM 等格式，最大 500MB
            </div>
          </label>
        </div>

        {/* 视频预览 */}
        {preview && (
          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <video
              src={preview}
              controls
              style={{
                maxWidth: '100%',
                maxHeight: '300px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            />
            <div style={{ marginTop: '0.5rem', color: '#6c757d', fontSize: '0.875rem' }}>
              原始大小: {formatBytes(file?.size || 0)}
            </div>
          </div>
        )}

        {/* 质量选择 */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '600',
            color: '#495057'
          }}>
            选择压缩质量:
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {[
              { value: 'high', label: '高质量', desc: '压缩率 30-50%', color: '#27ae60' },
              { value: 'balanced', label: '平衡', desc: '压缩率 50-70%（推荐）', color: '#3498db' },
              { value: 'small', label: '小体积', desc: '压缩率 70-85%', color: '#e74c3c' }
            ].map(option => (
              <label
                key={option.value}
                style={{
                  flex: '1 1 150px',
                  padding: '0.75rem',
                  border: `2px solid ${quality === option.value ? option.color : '#dee2e6'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: quality === option.value ? `${option.color}10` : 'white',
                  transition: 'all 0.3s ease',
                  minWidth: '120px'
                }}
              >
                <input
                  type="radio"
                  value={option.value}
                  checked={quality === option.value}
                  onChange={(e) => setQuality(e.target.value as 'high' | 'balanced' | 'small')}
                  style={{ marginRight: '0.5rem' }}
                />
                <strong>{option.label}</strong>
                <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: '0.25rem' }}>
                  {option.desc}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 压缩按钮 */}
        <button
          onClick={handleCompress}
          disabled={!file || loading}
          style={{
            width: '100%',
            padding: '1rem 2rem',
            fontSize: '1.125rem',
            fontWeight: '600',
            color: 'white',
            background: !file || loading
              ? '#adb5bd'
              : 'linear-gradient(135deg, #e74c3c 0%, #9b59b6 100%)',
            border: 'none',
            borderRadius: '8px',
            cursor: !file || loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: !file || loading ? 'none' : '0 4px 12px rgba(231, 76, 60, 0.4)',
            marginBottom: '1rem'
          }}
        >
          {loading ? '压缩中（视频处理需要一些时间）...' : '🚀 开始压缩'}
        </button>

        {/* 提示信息 */}
        {loading && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#e3f2fd',
            border: '1px solid #90caf9',
            borderRadius: '8px',
            color: '#1565c0',
            marginBottom: '1rem',
            textAlign: 'center'
          }}>
            ⏳ 视频压缩需要较长时间，请耐心等待...
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
        {result && result.success && (
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
              ✅ 压缩完成！
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <div>
                <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>原始大小</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#0f5132' }}>
                  {formatBytes(result.originalSize)}
                </div>
              </div>
              <div>
                <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>压缩后</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#0f5132' }}>
                  {formatBytes(result.compressedSize)}
                </div>
              </div>
              <div>
                <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>压缩率</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#0f5132' }}>
                  {result.compressionRatio}%
                </div>
              </div>
            </div>
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
              💾 下载压缩视频
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
              POST /api/compress-video?quality=balanced
            </code>

            <h3>cURL 示例</h3>
            <pre style={{
              background: '#282c34',
              color: '#abb2bf',
              padding: '1rem',
              borderRadius: '8px',
              overflow: 'auto',
              fontSize: '0.875rem'
            }}>
{`# 平衡质量（推荐）
curl -X POST \\
  -F "file=@video.mp4" \\
  "https://your-domain/api/compress-video?quality=balanced"

# 高质量
curl -X POST \\
  -F "file=@video.mp4" \\
  "https://your-domain/api/compress-video?quality=high"

# 小体积
curl -X POST \\
  -F "file=@video.mp4" \\
  "https://your-domain/api/compress-video?quality=small"`}
            </pre>

            <h3>质量选项</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#e9ecef' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #dee2e6' }}>参数值</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #dee2e6' }}>说明</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #dee2e6' }}>压缩率</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>high</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>高质量，保留更多细节</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>30-50%</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>balanced</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>平衡（推荐）</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>50-70%</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>small</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>小体积，节省空间</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>70-85%</td>
                </tr>
              </tbody>
            </table>

            <h3>技术规格</h3>
            <ul style={{ color: '#495057' }}>
              <li>输出格式: MP4 (H.264 + AAC)</li>
              <li>最大文件: 500MB</li>
              <li>支持格式: MP4, MOV, AVI, MKV, WebM</li>
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
              href="https://vinano.ai/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#667eea', textDecoration: 'none', fontWeight: '600' }}
            >
              ViNano AI
            </a> 提供技术支持
          </div>
          <div>
            开源项目 •
            <a
              href="https://github.com/ailingqu/pub-compress-image"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#667eea', textDecoration: 'none', marginLeft: '0.5rem' }}
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
