'use client'

import { useState, useCallback } from 'react'

type WatermarkMode = 'text' | 'image'
type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'tile'
type OutputFormat = 'webp' | 'jpeg' | 'png'

const POSITIONS: { value: Position; label: string }[] = [
  { value: 'top-left', label: '↖ 左上' },
  { value: 'top-right', label: '↗ 右上' },
  { value: 'bottom-left', label: '↙ 左下' },
  { value: 'bottom-right', label: '↘ 右下' },
  { value: 'center', label: '⊙ 居中' },
  { value: 'tile', label: '✣ 平铺' },
]

export default function WatermarkPage() {
  const [mode, setMode] = useState<WatermarkMode>('text')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
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
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [resultPreview, setResultPreview] = useState<string | null>(null)
  const [resultSize, setResultSize] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
  }

  const handleMainFileChange = (file: File | null) => {
    setImageFile(file)
    setResultBlob(null)
    setResultPreview(null)
    setError(null)
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => setImagePreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setImagePreview(null)
    }
  }

  const handleWatermarkFileChange = (file: File | null) => {
    setWatermarkFile(file)
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => setWatermarkPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setWatermarkPreview(null)
    }
  }

  const handleDropMain = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleMainFileChange(f)
  }, [])

  const handleSubmit = async () => {
    if (!imageFile) {
      setError('请先选择要加水印的图片')
      return
    }
    if (mode === 'text' && !text.trim()) {
      setError('请输入水印文字')
      return
    }
    if (mode === 'image' && !watermarkFile) {
      setError('请上传水印图片')
      return
    }

    setLoading(true)
    setError(null)
    setResultBlob(null)
    setResultPreview(null)

    try {
      const fd = new FormData()
      fd.append('image', imageFile)
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

      const res = await fetch('/api/watermark', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `处理失败 (${res.status})` }))
        throw new Error(data.error || `处理失败 (${res.status})`)
      }
      const blob = await res.blob()
      setResultBlob(blob)
      setResultSize(blob.size)
      setResultPreview(URL.createObjectURL(blob))
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!resultBlob) return
    const url = URL.createObjectURL(resultBlob)
    const a = document.createElement('a')
    a.href = url
    const baseName = (imageFile?.name || 'image').replace(/\.[^.]+$/, '')
    a.download = `${baseName}-watermarked.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <main style={{
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '1100px',
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
            background: 'linear-gradient(135deg, #f09433 0%, #dc2743 50%, #bc1888 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            💧 图片水印
          </h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <a href="/batch-watermark" style={navLinkStyle('linear-gradient(135deg, #f09433 0%, #bc1888 100%)')}>🖼️ 批量水印</a>
            <a href="/" style={{ color: '#667eea', textDecoration: 'none', fontSize: '0.9rem', alignSelf: 'center' }}>← 返回首页</a>
          </div>
        </div>
        <p style={{ color: '#6c757d', marginBottom: '2rem' }}>
          给图片添加文字或 Logo 水印，支持六种位置、透明度与格式转换
        </p>

        {/* 模式切换 */}
        <div style={{ marginBottom: '1.5rem' }}>
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
                  borderRadius: '8px',
                  background: mode === m ? '#fff0f3' : 'white',
                  color: mode === m ? '#bc1888' : '#495057',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {m === 'text' ? '🔤 文字水印' : '🖼️ 图片水印'}
              </button>
            ))}
          </div>
        </div>

        {/* 主图上传 */}
        <div
          style={dropZoneStyle}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#dc2743'; e.currentTarget.style.backgroundColor = '#fff0f3' }}
          onDragLeave={(e) => { e.currentTarget.style.borderColor = '#dee2e6'; e.currentTarget.style.backgroundColor = '#f8f9fa' }}
          onDrop={handleDropMain}
        >
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleMainFileChange(e.target.files?.[0] || null)}
            style={{ display: 'none' }}
            id="main-upload"
          />
          <label htmlFor="main-upload" style={{ cursor: 'pointer', display: 'block' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📁</div>
            <div style={{ color: '#495057', marginBottom: '0.25rem', fontWeight: 600 }}>
              {imageFile ? imageFile.name : '点击选择或拖拽主图到此处'}
            </div>
            <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>
              支持 JPG、PNG、GIF、WebP 等格式，最大 100MB
            </div>
          </label>
        </div>

        {imagePreview && (
          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <img src={imagePreview} alt="预览" style={previewImgStyle} />
            <div style={{ color: '#6c757d', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              原始大小: {formatBytes(imageFile?.size || 0)}
            </div>
          </div>
        )}

        {/* 文字水印配置 */}
        {mode === 'text' && (
          <div style={sectionStyle}>
            <div style={labelStyle}>文字水印：</div>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="请输入水印文字"
              style={textInputStyle}
            />
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
                <input
                  type="number"
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                  placeholder="自适应"
                  min={8}
                  max={512}
                  style={{ ...textInputStyle, marginTop: 0 }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 图片水印上传 */}
        {mode === 'image' && (
          <div style={sectionStyle}>
            <div style={labelStyle}>水印图片（建议带透明通道的 PNG）：</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleWatermarkFileChange(e.target.files?.[0] || null)}
              style={{ display: 'none' }}
              id="wm-upload"
            />
            <label htmlFor="wm-upload" style={{ ...smallDropZone, display: 'block' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🎨</div>
              <div style={{ color: '#495057', fontSize: '0.9rem' }}>
                {watermarkFile ? watermarkFile.name : '点击选择水印图'}
              </div>
            </label>
            {watermarkPreview && (
              <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                <img src={watermarkPreview} alt="水印预览" style={{ maxWidth: 160, maxHeight: 80, border: '1px solid #dee2e6', borderRadius: 6, background: '#f8f9fa' }} />
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
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 滑条控制 */}
        <div style={sectionStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <SliderRow label={`透明度 ${(opacity * 100).toFixed(0)}%`} min={0} max={1} step={0.05} value={opacity} onChange={setOpacity} />
            {mode === 'image' && (
              <SliderRow label={`水印相对大小 ${(scale * 100).toFixed(0)}%`} min={0.05} max={1} step={0.01} value={scale} onChange={setScale} />
            )}
            <SliderRow label={`边距 ${margin}px`} min={0} max={200} step={1} value={margin} onChange={(v) => setMargin(Math.round(v))} />
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
                <input
                  type="range"
                  min={1}
                  max={100}
                  step={1}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* 提交 */}
        <button
          onClick={handleSubmit}
          disabled={!imageFile || loading}
          style={{
            width: '100%',
            padding: '1rem 2rem',
            fontSize: '1.125rem',
            fontWeight: 600,
            color: 'white',
            background: !imageFile || loading ? '#adb5bd' : 'linear-gradient(135deg, #f09433 0%, #dc2743 50%, #bc1888 100%)',
            border: 'none',
            borderRadius: 8,
            cursor: !imageFile || loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            marginBottom: '1rem'
          }}
        >
          {loading ? '处理中...' : '💧 添加水印'}
        </button>

        {error && (
          <div style={{ padding: '1rem', backgroundColor: '#fff3cd', border: '1px solid #ffecb5', borderRadius: 8, color: '#856404', marginBottom: '1rem' }}>
            ⚠️ {error}
          </div>
        )}

        {resultPreview && resultBlob && (
          <div style={{ padding: '1.5rem', backgroundColor: '#d1f2eb', border: '1px solid #a3e4d7', borderRadius: 8 }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0f5132', marginBottom: '1rem' }}>
              ✅ 处理完成
            </div>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <img src={resultPreview} alt="结果" style={{ ...previewImgStyle, maxHeight: 400 }} />
              <div style={{ color: '#0f5132', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                输出大小：{formatBytes(resultSize)}
              </div>
            </div>
            <button
              onClick={handleDownload}
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
              💾 下载图片
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

function SliderRow({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label style={smallLabelStyle}>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#495057' }
const smallLabelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: 600, color: '#495057' }
const sectionStyle: React.CSSProperties = { marginBottom: '1.5rem' }
const textInputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #dee2e6', borderRadius: 6, fontSize: '0.95rem', marginTop: '0.25rem', boxSizing: 'border-box' }
const dropZoneStyle: React.CSSProperties = { border: '2px dashed #dee2e6', borderRadius: 8, padding: '2rem', textAlign: 'center', marginBottom: '1.5rem', backgroundColor: '#f8f9fa', cursor: 'pointer', transition: 'all 0.3s ease' }
const smallDropZone: React.CSSProperties = { border: '2px dashed #dee2e6', borderRadius: 8, padding: '1rem', textAlign: 'center', backgroundColor: '#f8f9fa', cursor: 'pointer' }
const previewImgStyle: React.CSSProperties = { maxWidth: '100%', maxHeight: 300, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }

function navLinkStyle(gradient: string): React.CSSProperties {
  return {
    padding: '0.5rem 1rem',
    background: gradient,
    color: 'white',
    textDecoration: 'none',
    borderRadius: 6,
    fontSize: '0.9rem',
    fontWeight: 600,
    alignSelf: 'center'
  }
}
