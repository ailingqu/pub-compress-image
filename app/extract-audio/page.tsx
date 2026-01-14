'use client'

import { useState, useCallback } from 'react'
import JSZip from 'jszip'

interface ExtractResponse {
  originalName: string;
  originalSize: number;
  audioSize: number;
  videoSize: number;
  audioData: string;
  videoData: string;
  audioFormat: string;
  success: boolean;
  error?: string;
}

export default function ExtractAudioPage() {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<'mp3' | 'aac'>('mp3')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ExtractResponse | null>(null)
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

  const handleExtract = async () => {
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

      const response = await fetch(`/api/extract-audio?format=${format}`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `提取失败 (${response.status})`)
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '提取失败')
    } finally {
      setLoading(false)
    }
  }

  const downloadZip = async () => {
    if (!result || !result.success) return

    const baseName = result.originalName.replace(/\.[^.]+$/, '')
    const zip = new JSZip()

    // 添加音频文件
    zip.file(`${baseName}_audio.${result.audioFormat}`, result.audioData, { base64: true })

    // 添加无声视频文件
    zip.file(`${baseName}_noaudio.mp4`, result.videoData, { base64: true })

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${baseName}_extracted.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadAudioOnly = () => {
    if (!result || !result.success) return

    const byteCharacters = atob(result.audioData)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: result.audioFormat === 'mp3' ? 'audio/mpeg' : 'audio/aac' })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const baseName = result.originalName.replace(/\.[^.]+$/, '')
    a.download = `${baseName}_audio.${result.audioFormat}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadVideoOnly = () => {
    if (!result || !result.success) return

    const byteCharacters = atob(result.videoData)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'video/mp4' })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const baseName = result.originalName.replace(/\.[^.]+$/, '')
    a.download = `${baseName}_noaudio.mp4`
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
            background: 'linear-gradient(135deg, #f39c12 0%, #e74c3c 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            🎵 视频音频分离
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
          从视频中分离音频，下载 ZIP 包含音频文件和无声视频
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
            e.currentTarget.style.borderColor = '#f39c12'
            e.currentTarget.style.backgroundColor = '#fef9e7'
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
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎬</div>
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

        {/* 音频格式选择 */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '600',
            color: '#495057'
          }}>
            选择音频格式:
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {[
              { value: 'mp3', label: 'MP3', desc: '兼容性最好，通用格式' },
              { value: 'aac', label: 'AAC', desc: '更高音质，体积更小' }
            ].map(option => (
              <label
                key={option.value}
                style={{
                  flex: '1 1 150px',
                  padding: '0.75rem',
                  border: `2px solid ${format === option.value ? '#f39c12' : '#dee2e6'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: format === option.value ? '#fef9e7' : 'white',
                  transition: 'all 0.3s ease',
                  minWidth: '120px'
                }}
              >
                <input
                  type="radio"
                  value={option.value}
                  checked={format === option.value}
                  onChange={(e) => setFormat(e.target.value as 'mp3' | 'aac')}
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

        {/* 提取按钮 */}
        <button
          onClick={handleExtract}
          disabled={!file || loading}
          style={{
            width: '100%',
            padding: '1rem 2rem',
            fontSize: '1.125rem',
            fontWeight: '600',
            color: 'white',
            background: !file || loading
              ? '#adb5bd'
              : 'linear-gradient(135deg, #f39c12 0%, #e74c3c 100%)',
            border: 'none',
            borderRadius: '8px',
            cursor: !file || loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: !file || loading ? 'none' : '0 4px 12px rgba(243, 156, 18, 0.4)',
            marginBottom: '1rem'
          }}
        >
          {loading ? '分离中（处理需要一些时间）...' : '🎵 开始分离音频'}
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
            ⏳ 正在分离音频和视频，请耐心等待...
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
              ✅ 分离完成！
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <div>
                <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>原始视频</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f5132' }}>
                  {formatBytes(result.originalSize)}
                </div>
              </div>
              <div>
                <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>音频 ({result.audioFormat.toUpperCase()})</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f5132' }}>
                  {formatBytes(result.audioSize)}
                </div>
              </div>
              <div>
                <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>无声视频</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f5132' }}>
                  {formatBytes(result.videoSize)}
                </div>
              </div>
            </div>

            {/* 下载按钮组 */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={downloadZip}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: 'white',
                  background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  minWidth: '150px'
                }}
              >
                📦 下载 ZIP（全部）
              </button>
              <button
                onClick={downloadAudioOnly}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: '#f39c12',
                  background: 'white',
                  border: '2px solid #f39c12',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  minWidth: '120px'
                }}
              >
                🎵 仅音频
              </button>
              <button
                onClick={downloadVideoOnly}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: '#3498db',
                  background: 'white',
                  border: '2px solid #3498db',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  minWidth: '120px'
                }}
              >
                🎬 仅视频
              </button>
            </div>
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
              POST /api/extract-audio?format=mp3
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
{`# 提取为 MP3
curl -X POST \\
  -F "file=@video.mp4" \\
  "https://your-domain/api/extract-audio?format=mp3"

# 提取为 AAC
curl -X POST \\
  -F "file=@video.mp4" \\
  "https://your-domain/api/extract-audio?format=aac"`}
            </pre>

            <h3>返回格式</h3>
            <pre style={{
              background: '#282c34',
              color: '#abb2bf',
              padding: '1rem',
              borderRadius: '8px',
              overflow: 'auto',
              fontSize: '0.875rem'
            }}>
{`{
  "originalName": "video.mp4",
  "originalSize": 10485760,
  "audioSize": 1048576,
  "videoSize": 9437184,
  "audioData": "base64...",
  "videoData": "base64...",
  "audioFormat": "mp3",
  "success": true
}`}
            </pre>
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
