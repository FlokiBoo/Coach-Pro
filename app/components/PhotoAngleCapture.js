'use client'

import { useState, useRef, forwardRef, useImperativeHandle } from 'react'

function angleBetween(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y }
  const v2 = { x: c.x - b.x, y: c.y - b.y }
  const dot = v1.x * v2.x + v1.y * v2.y
  const mag1 = Math.hypot(v1.x, v1.y)
  const mag2 = Math.hypot(v2.x, v2.y)
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)))
  return (Math.acos(cos) * 180) / Math.PI
}

function isCCW(a1, a2) {
  let diff = a2 - a1
  while (diff < -Math.PI) diff += 2 * Math.PI
  while (diff > Math.PI) diff -= 2 * Math.PI
  return diff < 0
}

// Place 3 points sur une photo (origine → sommet → extrémité) et calcule l'angle au sommet.
// Composant partagé entre GoniometerView (test articulaire suivi) et QuickAngleModal (mesure
// ponctuelle sans sauvegarde).
const PhotoAngleCapture = forwardRef(function PhotoAngleCapture({ onAngleChange }, ref) {
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const fileInputRef = useRef(null)
  const imgRef = useRef(null)
  const pointsRef = useRef([])
  const dragIndexRef = useRef(-1)
  const [hasImage, setHasImage] = useState(false)
  const [pointCount, setPointCount] = useState(0)
  const [angle, setAngle] = useState(null)

  useImperativeHandle(ref, () => ({
    getSnapshot() {
      if (angle == null || !canvasRef.current) return null
      return new Promise(resolve => {
        canvasRef.current.toBlob(blob => resolve({ angle, blob }), 'image/jpeg', 0.85)
      })
    },
    reset() {
      pointsRef.current = []
      setPointCount(0)
      setAngle(null)
      onAngleChange(null)
      draw()
    },
  }))

  function draw() {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const points = pointsRef.current
    if (points.length >= 2) {
      ctx.strokeStyle = '#3FC1B0'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      ctx.lineTo(points[1].x, points[1].y)
      ctx.stroke()
    }
    if (points.length === 3) {
      ctx.beginPath()
      ctx.moveTo(points[1].x, points[1].y)
      ctx.lineTo(points[2].x, points[2].y)
      ctx.stroke()

      const angA = Math.atan2(points[0].y - points[1].y, points[0].x - points[1].x)
      const angC = Math.atan2(points[2].y - points[1].y, points[2].x - points[1].x)
      ctx.beginPath()
      ctx.strokeStyle = '#F2A93B'
      ctx.lineWidth = 2
      ctx.arc(points[1].x, points[1].y, 34, angA, angC, isCCW(angA, angC))
      ctx.stroke()
    }

    const labels = ['A', 'B', 'C']
    points.forEach((p, i) => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2)
      ctx.fillStyle = i === 1 ? '#F2A93B' : '#EDEFF2'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#0D1117'
      ctx.stroke()
      ctx.font = '600 13px "IBM Plex Mono", monospace'
      ctx.fillStyle = '#EDEFF2'
      ctx.textAlign = 'center'
      ctx.fillText(labels[i], p.x, p.y - 16)
    })
  }

  function setupCanvas() {
    const canvas = canvasRef.current
    const stage = stageRef.current
    const img = imgRef.current
    const maxW = stage.clientWidth - 2
    const maxH = stage.clientHeight - 2
    const ratio = Math.min(maxW / img.width, maxH / img.height, 1) || 1
    canvas.width = img.width * ratio
    canvas.height = img.height * ratio
    pointsRef.current = []
    setPointCount(0)
    setAngle(null)
    onAngleChange(null)
    setHasImage(true)
    draw()
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => { imgRef.current = img; setupCanvas() }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  function getPos(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function hitTestPoint(pos) {
    const points = pointsRef.current
    for (let i = 0; i < points.length; i++) {
      if (Math.hypot(points[i].x - pos.x, points[i].y - pos.y) < 22) return i
    }
    return -1
  }

  function computeAngle() {
    const points = pointsRef.current
    const a = angleBetween(points[0], points[1], points[2])
    setAngle(a)
    onAngleChange(a)
  }

  function onPointerDown(e) {
    if (!imgRef.current) return
    const pos = getPos(e)
    const hit = hitTestPoint(pos)
    if (hit !== -1) {
      dragIndexRef.current = hit
    } else if (pointsRef.current.length < 3) {
      pointsRef.current = [...pointsRef.current, pos]
      setPointCount(pointsRef.current.length)
      draw()
      if (pointsRef.current.length === 3) computeAngle()
    }
  }

  function onPointerMove(e) {
    if (dragIndexRef.current === -1) return
    const pos = getPos(e)
    pointsRef.current[dragIndexRef.current] = pos
    draw()
    if (pointsRef.current.length === 3) computeAngle()
  }

  function onPointerUp() { dragIndexRef.current = -1 }

  function undoPoint() {
    pointsRef.current = pointsRef.current.slice(0, -1)
    setPointCount(pointsRef.current.length)
    setAngle(null)
    onAngleChange(null)
    draw()
  }

  const hints = [
    "Place le point A (origine du segment)",
    "Place le point B (sommet — c'est ici que l'angle se calcule)",
    "Place le point C (extrémité du deuxième segment)",
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '0 20px' }}>
      <div ref={stageRef} style={{
        flex: 1, position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#161B22',
        border: '1px solid #2A3140', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240,
      }}>
        {!hasImage ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 30, textAlign: 'center' }}>
            <div style={{ fontSize: 34 }}>📷</div>
            <p style={{ color: '#7C8493', fontSize: 13, margin: 0, maxWidth: 220, lineHeight: 1.5 }}>
              Charge une photo, place 3 points : origine → sommet → extrémité. L'angle se calcule au sommet.
            </p>
            <button onClick={() => fileInputRef.current?.click()} style={{ background: '#F2A93B', color: '#1a1400', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Charger une photo
            </button>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            style={{ maxWidth: '100%', maxHeight: '100%', touchAction: 'none', display: 'block' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
        )}
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
      </div>

      {hasImage && (
        <>
          <div style={{ textAlign: 'center', color: '#7C8493', fontSize: 11, padding: '8px 0 0' }}>
            {pointCount < 3 ? hints[pointCount] : "Glisse les points pour ajuster · angle recalculé en direct"}
          </div>
          {angle != null && (
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 40, fontWeight: 600 }}>{angle.toFixed(1)}</span>
              <sup style={{ fontSize: 18, color: '#7C8493' }}>°</sup>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, padding: '10px 0 0' }}>
            <button onClick={undoPoint} disabled={pointCount === 0} style={{ flex: 1, padding: '11px 10px', borderRadius: 10, border: '1px solid #2A3140', background: 'transparent', color: '#7C8493', fontSize: 12, fontWeight: 600, cursor: pointCount === 0 ? 'default' : 'pointer', opacity: pointCount === 0 ? 0.4 : 1, fontFamily: 'inherit' }}>
              Annuler point
            </button>
            <button onClick={() => fileInputRef.current?.click()} style={{ flex: 1, padding: '11px 10px', borderRadius: 10, border: '1px solid #3FC1B0', background: 'transparent', color: '#3FC1B0', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Nouvelle photo
            </button>
          </div>
        </>
      )}
    </div>
  )
})

export default PhotoAngleCapture
