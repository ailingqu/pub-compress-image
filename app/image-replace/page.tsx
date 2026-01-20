'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface ReplaceResponse {
  success: boolean;
  originalSize?: number;
  resultSize?: number;
  width?: number;
  height?: number;
  data?: string;
  error?: string;
}

export default function ImageReplacePage() {
  // 图片状态
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [replacementFile, setReplacementFile] = useState<File | null>(null)
  const [originalPreview, setOriginalPreview] = useState<string | null>(null)
  const [replacementPreview, setReplacementPreview] = useState<string | null>(null)

  // 画笔状态
  const [brushSize, setBrushSize] = useState(20)
  const [isDrawing, setIsDrawing] = useState(false)
  const [history, setHistory] = useState<ImageData[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  // 处理状态
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ReplaceResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 滑动对比状态
  const [sliderPosition, setSliderPosition] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const compareContainerRef = useRef<HTMLDivElement>(null)

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
  }

  // 处理原图上传
  const handleOriginalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setOriginalFile(file)
      setError(null)
      setResult(null)
      const reader = new FileReader()
      reader.onload = (e) => setOriginalPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  // 处理替换图上传
  const handleReplacementChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setReplacementFile(file)
      setError(null)
      setResult(null)
      const reader = new FileReader()
      reader.onload = (e) => {
        setReplacementPreview(e.target?.result as string)
        // 加载图片获取尺寸
        const img = new Image()
        img.onload = () => {
          setCanvasSize({ width: img.width, height: img.height })
          // 清除画布
          const canvas = canvasRef.current
          if (canvas) {
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext('2d')
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height)
            }
          }
          setHistory([])
        }
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    }
  }

  // 初始化 Canvas
  useEffect(() => {
    if (canvasSize.width > 0 && canvasSize.height > 0 && canvasRef.current) {
      const canvas = canvasRef.current
      canvas.width = canvasSize.width
      canvas.height = canvasSize.height
    }
  }, [canvasSize])

  // 获取鼠标/触摸位置
  const getPosition = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number

    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    const x = (clientX - rect.left) * (canvas.width / rect.width)
    const y = (clientY - rect.top) * (canvas.height / rect.height)
    return { x, y }
  }

  // 开始绘制
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    // 保存当前状态用于撤销
    setHistory(prev => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)])

    setIsDrawing(true)
    draw(e)
  }

  // 绘制
  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    const { x, y } = getPosition(e)

    ctx.beginPath()
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'
    ctx.fill()
  }, [isDrawing, brushSize])

  // 停止绘制
  const stopDrawing = () => {
    setIsDrawing(false)
  }

  // 撤销
  const handleUndo = () => {
    if (history.length === 0) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    const lastState = history[history.length - 1]
    ctx.putImageData(lastState, 0, 0)
    setHistory(prev => prev.slice(0, -1))
  }

  // 清除
  const handleClear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    // 保存当前状态
    setHistory(prev => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)])
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  // 导出遮罩
  const exportMask = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx || !canvas) {
        resolve(null)
        return
      }

      // 创建临时 canvas 生成黑白遮罩
      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = canvas.width
      maskCanvas.height = canvas.height
      const maskCtx = maskCanvas.getContext('2d')
      if (!maskCtx) {
        resolve(null)
        return
      }

      // 填充黑色背景
      maskCtx.fillStyle = 'black'
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)

      // 获取原 canvas 数据
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)

      // 将有颜色的区域变为白色
      for (let i = 0; i < imageData.data.length; i += 4) {
        if (imageData.data[i + 3] > 0) {
          maskData.data[i] = 255
          maskData.data[i + 1] = 255
          maskData.data[i + 2] = 255
          maskData.data[i + 3] = 255
        }
      }

      maskCtx.putImageData(maskData, 0, 0)

      maskCanvas.toBlob((blob) => {
        resolve(blob)
      }, 'image/png')
    })
  }

  // 合成图片
  const handleComposite = async () => {
    if (!originalFile || !replacementFile) {
      setError('请先上传原图和替换图')
      return
    }

    // 检查是否有涂抹
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) {
      setError('画布未初始化')
      return
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let hasDrawing = false
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i + 3] > 0) {
        hasDrawing = true
        break
      }
    }

    if (!hasDrawing) {
      setError('请先在替换图上涂抹要替换的区域')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const maskBlob = await exportMask()
      if (!maskBlob) {
        throw new Error('无法生成遮罩图')
      }

      const formData = new FormData()
      formData.append('original', originalFile)
      formData.append('replacement', replacementFile)
      formData.append('mask', maskBlob, 'mask.png')

      const response = await fetch('/api/image-replace', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `处理失败 (${response.status})`)
      }

      setResult(data)
      setSliderPosition(50) // 重置滑块位置
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理失败')
    } finally {
      setLoading(false)
    }
  }

  // 滑动对比：开始拖动
  const handleSliderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  // 滑动对比：触摸开始
  const handleSliderTouchStart = () => {
    setIsDragging(true)
  }

  // 滑动对比：移动
  const handleSliderMove = useCallback((clientX: number) => {
    if (!isDragging || !compareContainerRef.current) return
    const rect = compareContainerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSliderPosition(percentage)
  }, [isDragging])

  // 滑动对比：鼠标移动
  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleSliderMove(e.clientX)
  }, [handleSliderMove])

  // 滑动对比：触摸移动
  const handleTouchMove = useCallback((e: TouchEvent) => {
    handleSliderMove(e.touches[0].clientX)
  }, [handleSliderMove])

  // 滑动对比：停止拖动
  const handleSliderEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // 添加/移除全局事件监听
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleSliderEnd)
      window.addEventListener('touchmove', handleTouchMove)
      window.addEventListener('touchend', handleSliderEnd)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleSliderEnd)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleSliderEnd)
    }
  }, [isDragging, handleMouseMove, handleSliderEnd, handleTouchMove])

  // 下载结果
  const handleDownload = () => {
    if (!result || !result.success || !result.data) return

    const byteCharacters = atob(result.data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'image/png' })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const baseName = originalFile?.name.replace(/\.[^.]+$/, '') || 'image'
    a.download = `${baseName}_replaced.png`
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h1 style={{
            fontSize: '2rem',
            margin: 0,
            background: 'linear-gradient(135deg, #9b59b6 0%, #3498db 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            🎨 图片区域替换
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
          在替换图上涂抹标记区域，将该区域的内容替换到原图的相同位置
        </p>

        {/* 图片上传区域 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* 原图上传 */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#495057' }}>
              原图（要被替换的图片）
            </label>
            <div
              style={{
                border: '2px dashed #dee2e6',
                borderRadius: '8px',
                padding: '1rem',
                textAlign: 'center',
                backgroundColor: '#f8f9fa',
                cursor: 'pointer',
                minHeight: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleOriginalChange}
                style={{ display: 'none' }}
                id="original-upload"
              />
              <label htmlFor="original-upload" style={{ cursor: 'pointer', width: '100%' }}>
                {originalPreview ? (
                  <img
                    src={originalPreview}
                    alt="原图"
                    style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '4px' }}
                  />
                ) : (
                  <div>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🖼️</div>
                    <div style={{ color: '#6c757d' }}>点击上传原图</div>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* 替换图上传 + 涂抹区域 */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#495057' }}>
              替换图（在此涂抹标记区域）
            </label>
            <div
              style={{
                border: '2px dashed #dee2e6',
                borderRadius: '8px',
                padding: '1rem',
                textAlign: 'center',
                backgroundColor: '#f8f9fa',
                minHeight: '200px',
                position: 'relative'
              }}
            >
              {!replacementPreview ? (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReplacementChange}
                    style={{ display: 'none' }}
                    id="replacement-upload"
                  />
                  <label htmlFor="replacement-upload" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
                    <div>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎭</div>
                      <div style={{ color: '#6c757d' }}>点击上传替换图</div>
                    </div>
                  </label>
                </>
              ) : (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src={replacementPreview}
                    alt="替换图"
                    style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '4px', display: 'block' }}
                  />
                  <canvas
                    ref={canvasRef}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      cursor: 'crosshair',
                      touchAction: 'none'
                    }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
              )}
            </div>
            {replacementPreview && (
              <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleReplacementChange}
                  style={{ display: 'none' }}
                  id="replacement-reupload"
                />
                <label
                  htmlFor="replacement-reupload"
                  style={{ color: '#667eea', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  重新上传替换图
                </label>
              </div>
            )}
          </div>
        </div>

        {/* 画笔工具 */}
        {replacementPreview && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontWeight: '600', color: '#495057' }}>画笔大小:</label>
              <input
                type="range"
                min="5"
                max="100"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                style={{ width: '120px' }}
              />
              <span style={{ color: '#6c757d', minWidth: '40px' }}>{brushSize}px</span>
            </div>
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: history.length === 0 ? '#e9ecef' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: history.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              ↩️ 撤销
            </button>
            <button
              onClick={handleClear}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              🗑️ 清除
            </button>
            <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>
              提示: 在替换图上涂抹红色区域，该区域将被替换到原图
            </div>
          </div>
        )}

        {/* 合成按钮 */}
        <button
          onClick={handleComposite}
          disabled={!originalFile || !replacementFile || loading}
          style={{
            width: '100%',
            padding: '1rem 2rem',
            fontSize: '1.125rem',
            fontWeight: '600',
            color: 'white',
            background: !originalFile || !replacementFile || loading
              ? '#adb5bd'
              : 'linear-gradient(135deg, #9b59b6 0%, #3498db 100%)',
            border: 'none',
            borderRadius: '8px',
            cursor: !originalFile || !replacementFile || loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: !originalFile || !replacementFile || loading ? 'none' : '0 4px 12px rgba(155, 89, 182, 0.4)',
            marginBottom: '1rem'
          }}
        >
          {loading ? '处理中...' : '🔄 合成预览'}
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

        {/* 结果展示 - 滑动对比 */}
        {result && result.success && result.data && originalPreview && (
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
              ✅ 合成完成！拖动滑块对比效果
            </div>

            {/* 滑动对比容器 */}
            <div
              ref={compareContainerRef}
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '800px',
                margin: '0 auto 1rem',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                cursor: isDragging ? 'ew-resize' : 'default',
                userSelect: 'none'
              }}
            >
              {/* 合成后图片（底层） */}
              <img
                src={`data:image/png;base64,${result.data}`}
                alt="合成结果"
                style={{
                  display: 'block',
                  width: '100%',
                  height: 'auto'
                }}
                draggable={false}
              />

              {/* 原图（上层，通过 clip 裁剪） */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  overflow: 'hidden',
                  clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`
                }}
              >
                <img
                  src={originalPreview}
                  alt="原图"
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                  draggable={false}
                />
              </div>

              {/* 滑块分割线 */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${sliderPosition}%`,
                  width: '3px',
                  backgroundColor: 'white',
                  transform: 'translateX(-50%)',
                  boxShadow: '0 0 8px rgba(0,0,0,0.5)',
                  zIndex: 10
                }}
              />

              {/* 滑块手柄 */}
              <div
                onMouseDown={handleSliderMouseDown}
                onTouchStart={handleSliderTouchStart}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: `${sliderPosition}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '44px',
                  height: '44px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'ew-resize',
                  zIndex: 20,
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#495057'
                }}
              >
                ⟨⟩
              </div>

              {/* 标签 */}
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  zIndex: 5
                }}
              >
                原图
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  zIndex: 5
                }}
              >
                合成后
              </div>
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
                  {formatBytes(result.originalSize || 0)}
                </div>
              </div>
              <div>
                <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>结果大小</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f5132' }}>
                  {formatBytes(result.resultSize || 0)}
                </div>
              </div>
              <div>
                <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>尺寸</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f5132' }}>
                  {result.width} × {result.height}
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
                cursor: 'pointer'
              }}
            >
              💾 下载合成图片
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
              POST /api/image-replace
            </code>

            <h3>请求参数</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#e9ecef' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #dee2e6' }}>参数</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #dee2e6' }}>类型</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #dee2e6' }}>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>original</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>File</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>原图（要被替换的图片）</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>replacement</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>File</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>替换图（提供替换内容的图片）</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>mask</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>File</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>遮罩图（白色区域表示替换区域）</td>
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
              fontSize: '0.875rem'
            }}>
{`curl -X POST \\
  -F "original=@original.png" \\
  -F "replacement=@replacement.png" \\
  -F "mask=@mask.png" \\
  "https://your-domain/api/image-replace"`}
            </pre>

            <h3>遮罩图规范</h3>
            <ul style={{ color: '#495057' }}>
              <li>白色(255) = 替换区域（显示替换图内容）</li>
              <li>黑色(0) = 保留区域（显示原图内容）</li>
              <li>尺寸应与原图和替换图相同（API 会自动调整）</li>
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
