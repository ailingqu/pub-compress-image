'use client'

import { useState } from 'react'

export default function HeicConvertPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ blob: Blob; originalSize: number; convertedSize: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
      setResult(null)
    }
  }

  const handleConvert = async () => {
    if (!file) {
      setError('请先选择图片')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const response = await fetch('/api/heic-to-webp', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'image/heic'
        },
        body: arrayBuffer
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `转换失败 (${response.status})`)
      }

      const blob = await response.blob()
      setResult({
        blob,
        originalSize: file.size,
        convertedSize: blob.size
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '转换失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!result) return

    const originalName = file?.name?.replace(/\.(heic|heif)$/i, '') || 'converted'
    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${originalName}.webp`
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
            background: 'linear-gradient(135deg, #00b894 0%, #00cec9 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            🔄 HEIC/HEIF 转 WebP
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
          将 HEIC/HEIF 图片转换为 WebP 格式，保持原始分辨率，压缩体积
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
          e.currentTarget.style.borderColor = '#00b894'
          e.currentTarget.style.backgroundColor = '#e6fff9'
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
          if (droppedFile) {
            setFile(droppedFile)
            setError(null)
            setResult(null)
          }
        }}>
          <input
            type="file"
            accept=".heic,.heif,image/heic,image/heif"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="file-upload"
          />
          <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'block' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📱</div>
            <div style={{ color: '#495057', marginBottom: '0.5rem' }}>
              {file ? file.name : '点击选择 HEIC/HEIF 图片或拖拽到此处'}
            </div>
            <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>
              支持 HEIC、HEIF 格式（苹果设备照片格式），最大 50MB
            </div>
          </label>
        </div>

        {/* 文件信息 */}
        {file && !result && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
            <div style={{ color: '#495057', fontWeight: '600' }}>{file.name}</div>
            <div style={{ color: '#6c757d', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              大小: {formatBytes(file.size)}
            </div>
            <div style={{ color: '#adb5bd', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              (HEIC 格式需要转换后才能预览)
            </div>
          </div>
        )}

        {/* 转换按钮 */}
        <button
          onClick={handleConvert}
          disabled={!file || loading}
          style={{
            width: '100%',
            padding: '1rem 2rem',
            fontSize: '1.125rem',
            fontWeight: '600',
            color: 'white',
            background: !file || loading
              ? '#adb5bd'
              : 'linear-gradient(135deg, #00b894 0%, #00cec9 100%)',
            border: 'none',
            borderRadius: '8px',
            cursor: !file || loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: !file || loading ? 'none' : '0 4px 12px rgba(0, 184, 148, 0.4)',
            marginBottom: '1rem'
          }}
          onMouseEnter={(e) => {
            if (!loading && file) {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 184, 148, 0.5)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 184, 148, 0.4)'
          }}
        >
          {loading ? '转换中...' : '🔄 开始转换'}
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
              ✅ 转换完成！
            </div>

            {/* 转换后预览 */}
            <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
              <img
                src={URL.createObjectURL(result.blob)}
                alt="转换结果"
                style={{
                  maxWidth: '100%',
                  maxHeight: '300px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              />
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
                <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>转换后</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#0f5132' }}>
                  {formatBytes(result.convertedSize)}
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
              💾 下载 WebP 图片
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
              POST /api/heic-to-webp
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
{`# HEIC 转 WebP
curl -X POST \\
  -H "Content-Type: image/heic" \\
  --data-binary @photo.heic \\
  "https://processimage.mexxxxai.win/api/heic-to-webp" \\
  -o converted.webp

# HEIF 转 WebP
curl -X POST \\
  -H "Content-Type: image/heif" \\
  --data-binary @photo.heif \\
  "https://processimage.mexxxxai.win/api/heic-to-webp" \\
  -o converted.webp`}
            </pre>

            <h3>技术规格</h3>
            <ul style={{ color: '#495057' }}>
              <li>输入格式: HEIC, HEIF</li>
              <li>输出格式: WebP</li>
              <li>分辨率: 保持原始分辨率</li>
              <li>压缩质量: 85%</li>
              <li>最大文件: 50MB</li>
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
              style={{ color: '#00b894', textDecoration: 'none', fontWeight: '600' }}
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
              style={{ color: '#00b894', textDecoration: 'none', marginLeft: '0.5rem' }}
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
