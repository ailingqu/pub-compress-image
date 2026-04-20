'use client'

import { useState, useCallback } from 'react'
import JSZip from 'jszip'

interface CompressResult {
  originalName: string;
  originalSize: number;
  compressedSize?: number;
  compressionRatio?: number;
  data?: string;
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

export default function BatchPage() {
  const [files, setFiles] = useState<File[]>([])
  const [size, setSize] = useState<'1200' | '500' | 'original'>('1200')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<BatchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    const imageFiles = selectedFiles.filter(f => f.type.startsWith('image/'))
    setFiles(prev => [...prev, ...imageFiles].slice(0, 20))
    setError(null)
    setResults(null)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files)
    const imageFiles = droppedFiles.filter(f => f.type.startsWith('image/'))
    setFiles(prev => [...prev, ...imageFiles].slice(0, 20))
    setError(null)
    setResults(null)
  }, [])

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const clearFiles = () => {
    setFiles([])
    setResults(null)
    setError(null)
  }

  const handleCompress = async () => {
    if (files.length === 0) {
      setError('请先选择图片')
      return
    }

    setLoading(true)
    setError(null)
    setResults(null)
    setProgress(0)

    try {
      const formData = new FormData()
      files.forEach(file => {
        formData.append('files', file)
      })

      const response = await fetch(`/api/batch-compress?size=${size}`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `压缩失败 (${response.status})`)
      }

      const data: BatchResponse = await response.json()
      setResults(data)
      setProgress(100)
    } catch (err) {
      setError(err instanceof Error ? err.message : '压缩失败')
    } finally {
      setLoading(false)
    }
  }

  const downloadSingle = (result: CompressResult) => {
    if (!result.success || !result.data) return

    const byteCharacters = atob(result.data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'image/webp' })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // 保留原文件名，只改扩展名
    const newName = result.originalName.replace(/\.[^.]+$/, '.webp')
    a.download = newName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadAll = async () => {
    if (!results) return

    const successResults = results.results.filter(r => r.success && r.data)
    if (successResults.length === 0) {
      setError('没有可下载的文件')
      return
    }

    const zip = new JSZip()

    successResults.forEach(result => {
      const newName = result.originalName.replace(/\.[^.]+$/, '.webp')
      zip.file(newName, result.data!, { base64: true })
    })

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'compressed-images.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <main style={{
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '1200px',
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 style={{
            fontSize: '2rem',
            margin: 0,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            📦 批量图片压缩
          </h1>
          <a
            href="/"
            style={{
              color: '#667eea',
              textDecoration: 'none',
              fontSize: '0.9rem'
            }}
          >
            ← 返回单张压缩
          </a>
        </div>
        <p style={{ color: '#6c757d', marginBottom: '2rem' }}>
          一次上传多张图片，批量压缩为 WebP 格式，支持打包下载
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
            e.currentTarget.style.borderColor = '#667eea'
            e.currentTarget.style.backgroundColor = '#e7f3ff'
          }}
          onDragLeave={(e) => {
            e.currentTarget.style.borderColor = '#dee2e6'
            e.currentTarget.style.backgroundColor = '#f8f9fa'
          }}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="file-upload"
          />
          <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'block' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📁</div>
            <div style={{ color: '#495057', marginBottom: '0.5rem' }}>
              点击选择图片或拖拽到此处（最多 20 张）
            </div>
            <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>
              支持 JPG、PNG、GIF、TIFF 等格式，单个文件最大 100MB
            </div>
          </label>
        </div>

        {/* 已选文件列表 */}
        {files.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem'
            }}>
              <span style={{ fontWeight: '600', color: '#495057' }}>
                已选择 {files.length} 个文件
              </span>
              <button
                onClick={clearFiles}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc3545',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                清空全部
              </button>
            </div>
            <div style={{
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              padding: '0.5rem'
            }}>
              {files.map((file, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem',
                    borderBottom: index < files.length - 1 ? '1px solid #f0f0f0' : 'none'
                  }}
                >
                  <span style={{ color: '#495057', fontSize: '0.875rem' }}>
                    {file.name} ({formatBytes(file.size)})
                  </span>
                  <button
                    onClick={() => removeFile(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc3545',
                      cursor: 'pointer',
                      padding: '0.25rem'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
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
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {[
              { value: '1200', label: '1200×1200', desc: '网页/社交媒体' },
              { value: '500', label: '500×500', desc: '缩略图/头像' },
              { value: 'original', label: '原尺寸', desc: '仅压缩格式' }
            ].map(option => (
              <label
                key={option.value}
                style={{
                  flex: '1 1 150px',
                  padding: '0.75rem',
                  border: `2px solid ${size === option.value ? '#667eea' : '#dee2e6'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: size === option.value ? '#e7f3ff' : 'white',
                  transition: 'all 0.3s ease',
                  minWidth: '120px'
                }}
              >
                <input
                  type="radio"
                  value={option.value}
                  checked={size === option.value}
                  onChange={(e) => setSize(e.target.value as '1200' | '500' | 'original')}
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
          disabled={files.length === 0 || loading}
          style={{
            width: '100%',
            padding: '1rem 2rem',
            fontSize: '1.125rem',
            fontWeight: '600',
            color: 'white',
            background: files.length === 0 || loading
              ? '#adb5bd'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            cursor: files.length === 0 || loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: files.length === 0 || loading ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)',
            marginBottom: '1rem'
          }}
        >
          {loading ? `压缩中... ${progress}%` : `🚀 开始压缩 (${files.length} 个文件)`}
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
        {results && (
          <div style={{ marginTop: '1.5rem' }}>
            {/* 总体统计 */}
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
                ✅ 压缩完成！成功 {results.successCount} 个，失败 {results.failCount} 个
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div>
                  <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>原始总大小</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#0f5132' }}>
                    {formatBytes(results.totalOriginalSize)}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>压缩后总大小</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#0f5132' }}>
                    {formatBytes(results.totalCompressedSize)}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>总压缩率</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#0f5132' }}>
                    {results.overallCompressionRatio}%
                  </div>
                </div>
              </div>

              {results.successCount > 0 && (
                <button
                  onClick={downloadAll}
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
                  💾 下载全部 (ZIP)
                </button>
              )}
            </div>

            {/* 详细结果表格 */}
            <div style={{
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>文件名</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>原始大小</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>压缩后</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>压缩率</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((result, index) => (
                    <tr
                      key={index}
                      style={{ backgroundColor: result.success ? 'white' : '#fff3cd' }}
                    >
                      <td style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid #f0f0f0',
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {result.originalName}
                      </td>
                      <td style={{
                        padding: '0.75rem',
                        textAlign: 'right',
                        borderBottom: '1px solid #f0f0f0'
                      }}>
                        {formatBytes(result.originalSize)}
                      </td>
                      <td style={{
                        padding: '0.75rem',
                        textAlign: 'right',
                        borderBottom: '1px solid #f0f0f0'
                      }}>
                        {result.success ? formatBytes(result.compressedSize || 0) : '-'}
                      </td>
                      <td style={{
                        padding: '0.75rem',
                        textAlign: 'right',
                        borderBottom: '1px solid #f0f0f0',
                        color: result.success ? '#0f5132' : '#856404',
                        fontWeight: '600'
                      }}>
                        {result.success ? `${result.compressionRatio}%` : result.error}
                      </td>
                      <td style={{
                        padding: '0.75rem',
                        textAlign: 'center',
                        borderBottom: '1px solid #f0f0f0'
                      }}>
                        {result.success ? (
                          <button
                            onClick={() => downloadSingle(result)}
                            style={{
                              padding: '0.25rem 0.75rem',
                              fontSize: '0.875rem',
                              color: '#667eea',
                              backgroundColor: '#e7f3ff',
                              border: '1px solid #667eea',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            下载
                          </button>
                        ) : (
                          <span style={{ color: '#dc3545' }}>✕</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
