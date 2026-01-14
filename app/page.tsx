'use client'

import { useState } from 'react'

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [size, setSize] = useState<'1200' | '500'>('1200')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ blob: Blob; originalSize: number; compressedSize: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
      setResult(null)

      // 生成预览
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

    try {
      const arrayBuffer = await file.arrayBuffer()
      const response = await fetch(`/api/compress-image?size=${size}`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type
        },
        body: arrayBuffer
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `压缩失败 (${response.status})`)
      }

      const blob = await response.blob()
      setResult({
        blob,
        originalSize: file.size,
        compressedSize: blob.size
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '压缩失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!result) return

    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compressed-${size}.webp`
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
            fontSize: '2.5rem',
            margin: 0,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            🖼️ 图片压缩工具
          </h1>
          <a
            href="/batch"
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
            📦 批量压缩
          </a>
        </div>
        <p style={{ color: '#6c757d', marginBottom: '2rem' }}>
          将图片压缩为 WebP 格式，最高可节省 99% 体积
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
          e.currentTarget.style.borderColor = '#667eea'
          e.currentTarget.style.backgroundColor = '#e7f3ff'
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
              支持 JPG、PNG、GIF、TIFF 等格式，最大 100MB
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

        {/* 尺寸选择 */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '600',
            color: '#495057'
          }}>
            选择输出尺寸:
          </label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label style={{
              flex: 1,
              padding: '1rem',
              border: `2px solid ${size === '1200' ? '#667eea' : '#dee2e6'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: size === '1200' ? '#e7f3ff' : 'white',
              transition: 'all 0.3s ease'
            }}>
              <input
                type="radio"
                value="1200"
                checked={size === '1200'}
                onChange={(e) => setSize(e.target.value as '1200' | '500')}
                style={{ marginRight: '0.5rem' }}
              />
              <strong>1200x1200</strong>
              <div style={{ fontSize: '0.875rem', color: '#6c757d', marginTop: '0.25rem' }}>
                适合网页展示、社交媒体
              </div>
            </label>
            <label style={{
              flex: 1,
              padding: '1rem',
              border: `2px solid ${size === '500' ? '#667eea' : '#dee2e6'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: size === '500' ? '#e7f3ff' : 'white',
              transition: 'all 0.3s ease'
            }}>
              <input
                type="radio"
                value="500"
                checked={size === '500'}
                onChange={(e) => setSize(e.target.value as '1200' | '500')}
                style={{ marginRight: '0.5rem' }}
              />
              <strong>500x500</strong>
              <div style={{ fontSize: '0.875rem', color: '#6c757d', marginTop: '0.25rem' }}>
                适合缩略图、头像
              </div>
            </label>
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
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            cursor: !file || loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: !file || loading ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)',
            marginBottom: '1rem'
          }}
          onMouseEnter={(e) => {
            if (!loading && file) {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)'
          }}
        >
          {loading ? '压缩中...' : '🚀 开始压缩'}
        </button>

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
                <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>压缩比</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#0f5132' }}>
                  {compressionRatio}%
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
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(17, 153, 142, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(17, 153, 142, 0.4)'
              }}
            >
              💾 下载压缩图片
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
              POST /api/compress-image?size=1200
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
{`# 大尺寸 (1200x1200)
curl -X POST \\
  -H "Content-Type: image/jpeg" \\
  --data-binary @image.jpg \\
  "https://processimage.mexxxxai.win/api/compress-image?size=1200" \\
  -o compressed-1200.webp

# 小尺寸 (500x500)
curl -X POST \\
  -H "Content-Type: image/jpeg" \\
  --data-binary @image.jpg \\
  "https://processimage.mexxxxai.win/api/compress-image?size=500" \\
  -o compressed-500.webp`}
            </pre>

            <h3>技术规格</h3>
            <ul style={{ color: '#495057' }}>
              <li>输出格式: WebP</li>
              <li>压缩质量: 85%</li>
              <li>支持尺寸: 1200x1200 或 500x500</li>
              <li>最大文件: 100MB</li>
              <li>保持宽高比: 是</li>
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
              style={{ color: '#667eea', textDecoration: 'none', fontWeight: '600' }}
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
