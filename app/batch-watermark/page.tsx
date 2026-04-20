'use client'

import { useState, useCallback } from 'react'
import JSZip from 'jszip'

type WatermarkMode = 'text' | 'image'
type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'tile'
type OutputFormat = 'webp' | 'jpeg' | 'png'

interface WatermarkResult {
  originalName: string
  originalSize: number
  resultSize?: number
  width?: number
  height?: number
  mimeType?: string
  data?: string
  success: boolean
  error?: string
}

interface BatchResponse {
  results: WatermarkResult[]
  totalOriginalSize: number
  totalResultSize: number
  successCount: number
  failCount: number
}

const POSITIONS: { value: Position; label: string }[] = [
  { value: 'top-left', label: '↖ 左上' },
  { value: 'top-right', label: '↗ 右上' },
  { value: 'bottom-left', label: '↙ 左下' },
  { value: 'bottom-right', label: '↘ 右下' },
  { value: 'center', label: '⊙ 居中' },
  { value: 'tile', label: '✣ 平铺' },
]

export default function BatchWatermarkPage() {
  const [files, setFiles] = useState<File[]>([])
  const [mode, setMode] = useState<WatermarkMode>('text')
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null)
  const [watermarkPreview, setWatermarkPreview] = useState<string | null>(null)

  const [text, setText] = useState('© NanoBananas')
  const [color, setColor] = useState('#ffffff')
  const [fontSize, setFontSize] = useState<string>('')
  const [position, setPosition] = useState<Position>('bottom-right')
  const [opacity, setOpacity] = useState(0.5)
  const [scale, setScale] = useState(0.2)
  const [margin, setMargin] = useState(20)
  const [format, setFormat] = useState<OutputFormat>('webp')
  const [quality, setQuality] = useState(85)

  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<BatchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
  }

  const addFiles = (incoming: File[]) => {
    const imgs = incoming.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|tiff?|bmp|avif|heic|heif|svg)$/i.test(f.name))
    setFiles((prev) => [...prev, ...imgs].slice(0, 20))
    setError(null)
    setResults(null)
  }

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    addFiles(Array.from(e.dataTransfer.files))
  }, [])

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i))
  const clearFiles = () => { setFiles([]); setResults(null); setError(null) }

  const handleWatermarkFileChange = (file: File | null) => {
    setWatermarkFile(file)
    if (file) {
      const r = new FileReader()
      r.onload = (e) => setWatermarkPreview(e.target?.result as string)
      r.readAsDataURL(file)
    } else {
      setWatermarkPreview(null)
    }
  }

  const handleSubmit = async () => {
    if (files.length === 0) { setError('请先上传图片'); return }
    if (mode === 'text' && !text.trim()) { setError('请输入水印文字'); return }
    if (mode === 'image' && !watermarkFile) { setError('请上传水印图片'); return }

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const fd = new FormData()
      files.forEach((f) => fd.append('files', f))
      if (mode === 'image' && watermarkFile) {
        fd.append('watermark', watermarkFile)
      } else {
        fd.append('text', text.trim())
        fd.append('color', color)
        if (fontSize.trim()) fd.append('fontSize', fontSize.trim())
      }
      fd.append('position', position)
      fd.append('opacity', String(opacity))
      fd.append('scale', String(scale))
      fd.append('margin', String(margin))
      fd.append('format', format)
      fd.append('quality', String(quality))

      const res = await fetch('/api/batch-watermark', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `处理失败 (${res.status})` }))
        throw new Error(data.error || `处理失败 (${res.status})`)
      }
      const data: BatchResponse = await res.json()
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理失败')
    } finally {
      setLoading(false)
    }
  }

  const downloadSingle = (r: WatermarkResult) => {
    if (!r.success || !r.data) return
    const bytes = atob(r.data)
    const arr = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    const blob = new Blob([arr], { type: r.mimeType || 'image/webp' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = r.originalName.replace(/\.[^.]+$/, '') + `-watermarked.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadAll = async () => {
    if (!results) return
    const ok = results.results.filter((r) => r.success && r.data)
    if (ok.length === 0) { setError('没有可下载的文件'); return }
    const zip = new JSZip()
    ok.forEach((r) => {
      const name = r.originalName.replace(/\.[^.]+$/, '') + `-watermarked.${format}`
      zip.file(name, r.data!, { base64: true })
    })
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'watermarked-images.zip'
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
      <div style={{ backgroundColor: 'white', borderRadius: 12, padding: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h1 style={{
            fontSize: '2rem',
            margin: 0,
            background: 'linear-gradient(135deg, #f09433 0%, #dc2743 50%, #bc1888 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            🖼️ 批量图片水印
          </h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <a href="/watermark" style={navLinkStyle('linear-gradient(135deg, #f09433 0%, #bc1888 100%)')}>💧 单张水印</a>
            <a href="/" style={{ color: '#667eea', textDecoration: 'none', fontSize: '0.9rem', alignSelf: 'center' }}>← 返回首页</a>
          </div>
        </div>
        <p style={{ color: '#6c757d', marginBottom: '2rem' }}>
          一次最多上传 20 张图片，统一添加文字或 Logo 水印，支持 ZIP 打包下载
        </p>

        {/* 模式切换 */}
        <div style={sectionStyle}>
          <div style={labelStyle}>水印类型：</div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {(['text', 'image'] as WatermarkMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: `2px solid ${mode === m ? '#dc2743' : '#dee2e6'}`,
                  borderRadius: 8,
                  background: mode === m ? '#fff0f3' : 'white',
                  color: mode === m ? '#bc1888' : '#495057',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {m === 'text' ? '🔤 文字水印' : '🖼️ 图片水印'}
              </button>
            ))}
          </div>
        </div>

        {/* 批量图片上传 */}
        <div
          style={dropZoneStyle}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#dc2743'; e.currentTarget.style.backgroundColor = '#fff0f3' }}
          onDragLeave={(e) => { e.currentTarget.style.borderColor = '#dee2e6'; e.currentTarget.style.backgroundColor = '#f8f9fa' }}
          onDrop={handleDrop}
        >
          <input type="file" accept="image/*" multiple onChange={handleFilesChange} style={{ display: 'none' }} id="batch-upload" />
          <label htmlFor="batch-upload" style={{ cursor: 'pointer', display: 'block' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📁</div>
            <div style={{ color: '#495057', fontWeight: 600 }}>点击选择或拖拽图片到此处（最多 20 张）</div>
            <div style={{ color: '#6c757d', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              支持 JPG、PNG、GIF、WebP 等，单个文件最大 100MB
            </div>
          </label>
        </div>

        {files.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 600, color: '#495057' }}>已选择 {files.length} 个文件</span>
              <button onClick={clearFiles} style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '0.875rem' }}>清空全部</button>
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: 8, padding: '0.5rem' }}>
              {files.map((f, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderBottom: i < files.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <span style={{ color: '#495057', fontSize: '0.875rem' }}>{f.name} ({formatBytes(f.size)})</span>
                  <button onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', padding: '0.25rem' }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 文字水印配置 */}
        {mode === 'text' && (
          <div style={sectionStyle}>
            <div style={labelStyle}>文字水印：</div>
            <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="请输入水印文字" style={textInputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
              <div>
                <label style={smallLabelStyle}>文字颜色</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 50, height: 36, border: '1px solid #dee2e6', borderRadius: 6, cursor: 'pointer' }} />
                  <input type="text" value={color} onChange={(e) => setColor(e.target.value)} style={{ ...textInputStyle, marginTop: 0 }} />
                </div>
              </div>
              <div>
                <label style={smallLabelStyle}>字号（留空自动）</label>
                <input type="number" value={fontSize} onChange={(e) => setFontSize(e.target.value)} placeholder="自适应" min={8} max={512} style={{ ...textInputStyle, marginTop: 0 }} />
              </div>
            </div>
          </div>
        )}

        {/* 图片水印上传 */}
        {mode === 'image' && (
          <div style={sectionStyle}>
            <div style={labelStyle}>水印图片（建议带透明通道的 PNG）：</div>
            <input type="file" accept="image/*" onChange={(e) => handleWatermarkFileChange(e.target.files?.[0] || null)} style={{ display: 'none' }} id="wm-upload" />
            <label htmlFor="wm-upload" style={{ ...smallDropZone, display: 'block' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🎨</div>
              <div style={{ color: '#495057', fontSize: '0.9rem' }}>{watermarkFile ? watermarkFile.name : '点击选择水印图'}</div>
            </label>
            {watermarkPreview && (
              <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                <img src={watermarkPreview} alt="水印" style={{ maxWidth: 160, maxHeight: 80, border: '1px solid #dee2e6', borderRadius: 6, background: '#f8f9fa' }} />
              </div>
            )}
          </div>
        )}

        {/* 位置 */}
        <div style={sectionStyle}>
          <div style={labelStyle}>位置：</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {POSITIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPosition(p.value)}
                style={{
                  padding: '0.6rem',
                  border: `2px solid ${position === p.value ? '#dc2743' : '#dee2e6'}`,
                  borderRadius: 6,
                  background: position === p.value ? '#fff0f3' : 'white',
                  color: position === p.value ? '#bc1888' : '#495057',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 滑条 */}
        <div style={sectionStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div>
              <label style={smallLabelStyle}>透明度 {(opacity * 100).toFixed(0)}%</label>
              <input type="range" min={0} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
            {mode === 'image' && (
              <div>
                <label style={smallLabelStyle}>水印相对大小 {(scale * 100).toFixed(0)}%</label>
                <input type="range" min={0.05} max={1} step={0.01} value={scale} onChange={(e) => setScale(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
            )}
            <div>
              <label style={smallLabelStyle}>边距 {margin}px</label>
              <input type="range" min={0} max={200} step={1} value={margin} onChange={(e) => setMargin(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        {/* 输出格式 & 质量 */}
        <div style={sectionStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={smallLabelStyle}>输出格式</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['webp', 'jpeg', 'png'] as OutputFormat[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      border: `2px solid ${format === f ? '#dc2743' : '#dee2e6'}`,
                      borderRadius: 6,
                      background: format === f ? '#fff0f3' : 'white',
                      color: format === f ? '#bc1888' : '#495057',
                      cursor: 'pointer',
                      fontWeight: 600,
                      textTransform: 'uppercase'
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            {format !== 'png' && (
              <div>
                <label style={smallLabelStyle}>质量 {quality}</label>
                <input type="range" min={1} max={100} step={1} value={quality} onChange={(e) => setQuality(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={files.length === 0 || loading}
          style={{
            width: '100%',
            padding: '1rem 2rem',
            fontSize: '1.125rem',
            fontWeight: 600,
            color: 'white',
            background: files.length === 0 || loading ? '#adb5bd' : 'linear-gradient(135deg, #f09433 0%, #dc2743 50%, #bc1888 100%)',
            border: 'none',
            borderRadius: 8,
            cursor: files.length === 0 || loading ? 'not-allowed' : 'pointer',
            marginBottom: '1rem'
          }}
        >
          {loading ? '处理中...' : `💧 批量添加水印 (${files.length} 个文件)`}
        </button>

        {error && (
          <div style={{ padding: '1rem', backgroundColor: '#fff3cd', border: '1px solid #ffecb5', borderRadius: 8, color: '#856404', marginBottom: '1rem' }}>
            ⚠️ {error}
          </div>
        )}

        {results && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ padding: '1.5rem', backgroundColor: '#d1f2eb', border: '1px solid #a3e4d7', borderRadius: 8, marginBottom: '1rem' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0f5132', marginBottom: '1rem' }}>
                ✅ 处理完成！成功 {results.successCount} 个，失败 {results.failCount} 个
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>原始总大小</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#0f5132' }}>{formatBytes(results.totalOriginalSize)}</div>
                </div>
                <div>
                  <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>输出总大小</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#0f5132' }}>{formatBytes(results.totalResultSize)}</div>
                </div>
              </div>
              {results.successCount > 0 && (
                <button
                  onClick={downloadAll}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'white',
                    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer'
                  }}
                >
                  💾 下载全部 (ZIP)
                </button>
              )}
            </div>

            <div style={{ border: '1px solid #dee2e6', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={tdHead}>文件名</th>
                    <th style={tdHead}>原始</th>
                    <th style={tdHead}>输出</th>
                    <th style={tdHead}>状态</th>
                    <th style={tdHead}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f0f0f0' }}>
                      <td style={td}>{r.originalName}</td>
                      <td style={td}>{formatBytes(r.originalSize)}</td>
                      <td style={td}>{r.resultSize ? formatBytes(r.resultSize) : '-'}</td>
                      <td style={td}>
                        {r.success ? (
                          <span style={{ color: '#0f5132', fontWeight: 600 }}>✓ 成功</span>
                        ) : (
                          <span style={{ color: '#dc3545' }} title={r.error}>✗ {r.error}</span>
                        )}
                      </td>
                      <td style={td}>
                        {r.success && (
                          <button onClick={() => downloadSingle(r)} style={{ padding: '0.25rem 0.75rem', border: '1px solid #11998e', borderRadius: 4, color: '#11998e', background: 'white', cursor: 'pointer', fontSize: '0.85rem' }}>下载</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#495057' }
const smallLabelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: 600, color: '#495057' }
const sectionStyle: React.CSSProperties = { marginBottom: '1.5rem' }
const textInputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #dee2e6', borderRadius: 6, fontSize: '0.95rem', marginTop: '0.25rem', boxSizing: 'border-box' }
const dropZoneStyle: React.CSSProperties = { border: '2px dashed #dee2e6', borderRadius: 8, padding: '2rem', textAlign: 'center', marginBottom: '1.5rem', backgroundColor: '#f8f9fa', cursor: 'pointer', transition: 'all 0.3s ease' }
const smallDropZone: React.CSSProperties = { border: '2px dashed #dee2e6', borderRadius: 8, padding: '1rem', textAlign: 'center', backgroundColor: '#f8f9fa', cursor: 'pointer' }
const td: React.CSSProperties = { padding: '0.6rem 0.75rem', fontSize: '0.875rem', color: '#495057' }
const tdHead: React.CSSProperties = { ...td, textAlign: 'left', fontWeight: 600, color: '#6c757d', background: '#f8f9fa' }

function navLinkStyle(gradient: string): React.CSSProperties {
  return { padding: '0.5rem 1rem', background: gradient, color: 'white', textDecoration: 'none', borderRadius: 6, fontSize: '0.9rem', fontWeight: 600, alignSelf: 'center' }
}
