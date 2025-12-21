'use client'

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  Trash2, 
  RotateCcw, 
  RotateCw,
  Square,
  Circle,
  MousePointer,
  Pencil,
  Edit3,
  X,
  Spline,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Move,
  Play,
  ArrowLeft,
  Plus,
  LogOut,
  Home,
  Eye,
  EyeOff,
  GitBranch,
  Save
} from 'lucide-react'
import type { Story, Scene, Panel, Choice } from '@/types/database'

// ============================================================================
// TYPES
// ============================================================================

type DrawingTool = 'select' | 'rectangle' | 'ellipse' | 'freeform' | 'brush' | 'pan'
type ReadingDirection = 'ltr' | 'rtl'
type PanelShape = 'rectangle' | 'polygon' | 'ellipse' | 'brush'

interface Point {
  x: number
  y: number
}

interface BrushPoint extends Point {
  size: number
}

interface LocalPanel {
  id: string
  sceneId: string
  index: number
  shape: PanelShape
  x: number
  y: number
  w: number
  h: number
  points?: Point[]
  brushStrokes?: BrushPoint[]
  center?: Point
  rx?: number
  ry?: number
  dbId?: string
}

interface StoryWithScenes extends Story {
  scenes: (Scene & { panels: Panel[] })[]
}

interface PanelDashboardProps {
  initialStories: StoryWithScenes[]
  initialChoices: Choice[]
  userId: string
}

interface HistoryEntry {
  panels: LocalPanel[]
  action: string
  timestamp: number
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const generateId = (): string => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

const getPolygonBounds = (points: Point[]): { x: number; y: number; w: number; h: number } => {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY }
}

const getBrushBounds = (strokes: BrushPoint[]): { x: number; y: number; w: number; h: number } => {
  if (strokes.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  strokes.forEach(s => {
    const r = s.size / 2
    minX = Math.min(minX, s.x - r)
    minY = Math.min(minY, s.y - r)
    maxX = Math.max(maxX, s.x + r)
    maxY = Math.max(maxY, s.y + r)
  })
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

const sortPanelsByReadingOrder = (panels: LocalPanel[], direction: ReadingDirection): LocalPanel[] => {
  const sorted = [...panels].sort((a, b) => {
    const tolerance = 50
    const aCY = a.y + a.h / 2
    const bCY = b.y + b.h / 2
    const aCX = a.x + a.w / 2
    const bCX = b.x + b.w / 2
    if (Math.abs(aCY - bCY) < tolerance) {
      return direction === 'ltr' ? aCX - bCX : bCX - aCX
    }
    return aCY - bCY
  })
  return sorted.map((p, i) => ({ ...p, index: i }))
}

// ============================================================================
// READER DIALOG - Improved smooth transitions, no header info
// ============================================================================

interface ReaderDialogProps {
  isOpen: boolean
  onClose: () => void
  scene: Scene | null
  panels: LocalPanel[]
}

const ReaderDialog: React.FC<ReaderDialogProps> = ({ isOpen, onClose, scene, panels }) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [viewSize, setViewSize] = useState({ w: 800, h: 600 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const viewRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const sortedPanels = useMemo(() => {
    return [...panels].sort((a, b) => a.index - b.index)
  }, [panels])

  const panel = sortedPanels[currentIndex]

  useEffect(() => {
    if (isOpen && sortedPanels.length > 0) {
      setCurrentIndex(0)
      setTimeout(() => {
        if (containerRef.current && document.fullscreenEnabled) {
          containerRef.current.requestFullscreen().catch(() => {})
        }
      }, 100)
    }
  }, [isOpen, sortedPanels.length])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const handleClose = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().finally(onClose)
    } else {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (!isOpen || !viewRef.current) return
    const measure = () => {
      if (viewRef.current) {
        setViewSize({ w: viewRef.current.clientWidth, h: viewRef.current.clientHeight })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [isOpen, isFullscreen])

  const goNext = useCallback(() => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setCurrentIndex(i => Math.min(i + 1, sortedPanels.length - 1))
    setTimeout(() => setIsTransitioning(false), 600)
  }, [isTransitioning, sortedPanels.length])

  const goPrev = useCallback(() => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setCurrentIndex(i => Math.max(i - 1, 0))
    setTimeout(() => setIsTransitioning(false), 600)
  }, [isTransitioning])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); handleClose() }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, handleClose, goNext, goPrev])

  if (!isOpen || !panel || !scene) return null

  const pad = 40
  const scaleX = (viewSize.w - pad * 2) / panel.w
  const scaleY = (viewSize.h - pad * 2) / panel.h
  const scale = Math.min(scaleX, scaleY, 3)

  const panelCX = panel.x + panel.w / 2
  const panelCY = panel.y + panel.h / 2
  const tx = viewSize.w / 2 - panelCX * scale
  const ty = viewSize.h / 2 - panelCY * scale

  let clipPath = ''
  if (panel.shape === 'polygon' && panel.points && panel.points.length >= 3) {
    clipPath = `polygon(${panel.points.map(p => `${p.x}px ${p.y}px`).join(', ')})`
  } else if (panel.shape === 'ellipse' && panel.center && panel.rx && panel.ry) {
    clipPath = `ellipse(${panel.rx}px ${panel.ry}px at ${panel.center.x}px ${panel.center.y}px)`
  } else if (panel.shape === 'brush' && panel.brushStrokes && panel.brushStrokes.length >= 2) {
    const strokes = panel.brushStrokes
    const halfSize = strokes[0].size / 2
    const topPoints: string[] = []
    const bottomPoints: string[] = []
    for (let i = 0; i < strokes.length; i++) {
      const s = strokes[i]
      const prev = strokes[i - 1] || s
      const next = strokes[i + 1] || s
      const dx = next.x - prev.x
      const dy = next.y - prev.y
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const nx = -dy / len * halfSize
      const ny = dx / len * halfSize
      topPoints.push(`${s.x + nx}px ${s.y + ny}px`)
      bottomPoints.unshift(`${s.x - nx}px ${s.y - ny}px`)
    }
    clipPath = `polygon(${[...topPoints, ...bottomPoints].join(', ')})`
  } else {
    clipPath = `inset(${panel.y}px ${(scene.image_width || 800) - panel.x - panel.w}px ${(scene.image_height || 600) - panel.y - panel.h}px ${panel.x}px)`
  }

  return (
    <div ref={containerRef} className="fixed inset-0 z-[9999] bg-black flex flex-col">
      {/* Close button - minimal */}
      <button 
        onClick={handleClose} 
        className="absolute top-4 right-4 z-50 p-2 text-white/40 hover:text-white/80 transition-colors"
      >
        <X size={24} />
      </button>

      {/* Viewport */}
      <div ref={viewRef} className="flex-1 relative overflow-hidden cursor-pointer" onClick={goNext}>
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transformOrigin: '0 0',
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          {/* Dimmed background image */}
          <img 
            src={scene.image_url || ''} 
            alt="" 
            style={{ 
              display: 'block', 
              width: scene.image_width || 800, 
              height: scene.image_height || 600, 
              opacity: 0.1,
              filter: 'blur(1px)'
            }} 
            draggable={false} 
          />
          {/* Highlighted panel with smooth clip transition */}
          <img 
            src={scene.image_url || ''} 
            alt="" 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              display: 'block',
              width: scene.image_width || 800,
              height: scene.image_height || 600,
              clipPath,
              transition: 'clip-path 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
            }} 
            draggable={false} 
          />
        </div>
      </div>

      {/* Minimal bottom nav */}
      <div className="h-14 flex items-center justify-center gap-8 bg-gradient-to-t from-black/80 to-transparent">
        <button 
          onClick={(e) => { e.stopPropagation(); goPrev() }} 
          disabled={currentIndex === 0} 
          className="text-white/50 hover:text-white disabled:opacity-20 transition-all"
        >
          <ChevronLeft size={28} />
        </button>
        <div className="flex items-center gap-2">
          {sortedPanels.map((_, idx) => (
            <div 
              key={idx} 
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'bg-white w-6' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); goNext() }} 
          disabled={currentIndex === sortedPanels.length - 1} 
          className="text-white/50 hover:text-white disabled:opacity-20 transition-all"
        >
          <ChevronRight size={28} />
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// SCENE EDITOR
// ============================================================================

interface SceneEditorProps {
  scene: Scene & { panels: Panel[] }
  onPanelsChange: (panels: Panel[]) => void
  onBack: () => void
}

function SceneEditor({ scene, onPanelsChange, onBack }: SceneEditorProps) {
  const supabase = createClient()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const animationRef = useRef<number>()

  const [localPanels, setLocalPanels] = useState<LocalPanel[]>(() => {
    return (scene.panels || []).map((p) => ({
      id: generateId(),
      sceneId: scene.id,
      index: p.order_index,
      shape: p.shape as PanelShape,
      x: p.x,
      y: p.y,
      w: p.width,
      h: p.height,
      points: p.points as Point[] | undefined,
      brushStrokes: p.brush_strokes as BrushPoint[] | undefined,
      center: p.ellipse_data ? { x: (p.ellipse_data as { centerX: number }).centerX, y: (p.ellipse_data as { centerY: number }).centerY } : undefined,
      rx: p.ellipse_data ? (p.ellipse_data as { rx: number }).rx : undefined,
      ry: p.ellipse_data ? (p.ellipse_data as { ry: number }).ry : undefined,
      dbId: p.id
    }))
  })

  const [tool, setTool] = useState<DrawingTool>('select')
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  const [brushSize, setBrushSize] = useState(40)
  const [readingDirection, setReadingDirection] = useState<ReadingDirection>('ltr')

  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<Point | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<Point | null>(null)
  const [freeformPoints, setFreeformPoints] = useState<Point[]>([])
  const [brushStrokes, setBrushStrokes] = useState<BrushPoint[]>([])
  const [lastPanPoint, setLastPanPoint] = useState<Point | null>(null)

  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const [isReaderOpen, setIsReaderOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageRef.current = img
      resetView()
    }
    img.src = scene.image_url || ''
  }, [scene.image_url])

  const resetView = useCallback(() => {
    if (!containerRef.current || !imageRef.current) return
    const container = containerRef.current
    const img = imageRef.current
    const scaleX = (container.clientWidth - 40) / img.naturalWidth
    const scaleY = (container.clientHeight - 40) / img.naturalHeight
    const newZoom = Math.min(scaleX, scaleY, 1)
    setZoom(newZoom)
    setPan({
      x: (container.clientWidth - img.naturalWidth * newZoom) / 2,
      y: (container.clientHeight - img.naturalHeight * newZoom) / 2
    })
  }, [])

  const pushHistory = useCallback((action: string) => {
    const entry: HistoryEntry = {
      panels: JSON.parse(JSON.stringify(localPanels)),
      action,
      timestamp: Date.now()
    }
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(entry)
      return newHistory.slice(-50)
    })
    setHistoryIndex(prev => Math.min(prev + 1, 49))
  }, [localPanels, historyIndex])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const entry = history[historyIndex - 1]
      setLocalPanels(JSON.parse(JSON.stringify(entry.panels)))
      setHistoryIndex(historyIndex - 1)
    }
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const entry = history[historyIndex + 1]
      setLocalPanels(JSON.parse(JSON.stringify(entry.panels)))
      setHistoryIndex(historyIndex + 1)
    }
  }, [history, historyIndex])

  const addPanel = useCallback((panel: Omit<LocalPanel, 'id' | 'index'>) => {
    const panelIndex = localPanels.length
    const newPanel: LocalPanel = { ...panel, id: generateId(), index: panelIndex }
    setLocalPanels(prev => [...prev, newPanel])
    pushHistory(`Added ${panel.shape} panel`)
    setSelectedPanelId(newPanel.id)
  }, [localPanels.length, pushHistory])

  const deletePanel = useCallback((id: string) => {
    setLocalPanels(prev => {
      const filtered = prev.filter(p => p.id !== id)
      return filtered.map((p, i) => ({ ...p, index: i }))
    })
    pushHistory('Deleted panel')
    setSelectedPanelId(null)
  }, [pushHistory])

  const sortPanels = useCallback(() => {
    setLocalPanels(prev => sortPanelsByReadingOrder(prev, readingDirection))
    pushHistory(`Sorted panels (${readingDirection.toUpperCase()})`)
  }, [readingDirection, pushHistory])

  const savePanels = useCallback(async () => {
    setSaving(true)
    try {
      await supabase.from('panels').delete().eq('scene_id', scene.id)
      const panelsToInsert = localPanels.map(p => ({
        scene_id: scene.id,
        shape: p.shape,
        x: Math.round(p.x),
        y: Math.round(p.y),
        width: Math.round(p.w),
        height: Math.round(p.h),
        points: p.points || null,
        brush_strokes: p.brushStrokes || null,
        ellipse_data: p.center ? { centerX: p.center.x, centerY: p.center.y, rx: p.rx, ry: p.ry } : null,
        order_index: p.index
      }))
      if (panelsToInsert.length > 0) {
        const { data, error } = await supabase.from('panels').insert(panelsToInsert).select()
        if (error) throw error
        onPanelsChange(data || [])
      } else {
        onPanelsChange([])
      }
    } catch (err) {
      console.error('Save error:', err)
      alert('Kaydetme hatası!')
    } finally {
      setSaving(false)
    }
  }, [localPanels, scene.id, supabase, onPanelsChange])

  // Render canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const image = imageRef.current
    if (!canvas || !ctx) return

    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const size = 20
    for (let x = 0; x < canvas.width; x += size) {
      for (let y = 0; y < canvas.height; y += size) {
        ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#2a2a2a' : '#1f1f1f'
        ctx.fillRect(x, y, size, size)
      }
    }

    if (image) {
      ctx.save()
      ctx.translate(pan.x, pan.y)
      ctx.scale(zoom, zoom)
      ctx.drawImage(image, 0, 0)
      ctx.restore()
    }

    localPanels.forEach(panel => {
      const isSelected = panel.id === selectedPanelId
      ctx.save()
      ctx.translate(pan.x, pan.y)
      ctx.scale(zoom, zoom)

      if (panel.brushStrokes && panel.brushStrokes.length >= 2) {
        const strokes = panel.brushStrokes
        const strokeSize = strokes[0].size
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(strokes[0].x, strokes[0].y)
        for (let i = 1; i < strokes.length - 1; i++) {
          const xc = (strokes[i].x + strokes[i + 1].x) / 2
          const yc = (strokes[i].y + strokes[i + 1].y) / 2
          ctx.quadraticCurveTo(strokes[i].x, strokes[i].y, xc, yc)
        }
        if (strokes.length > 1) {
          const last = strokes[strokes.length - 1]
          ctx.lineTo(last.x, last.y)
        }
        ctx.lineWidth = strokeSize
        ctx.strokeStyle = isSelected ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.3)'
        ctx.stroke()
      } else if (panel.points && panel.points.length >= 3) {
        ctx.beginPath()
        ctx.moveTo(panel.points[0].x, panel.points[0].y)
        panel.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
        ctx.closePath()
        ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.15)'
        ctx.fill()
        ctx.strokeStyle = isSelected ? '#3b82f6' : 'rgba(59, 130, 246, 0.7)'
        ctx.lineWidth = (isSelected ? 3 : 2) / zoom
        ctx.stroke()
      } else if (panel.shape === 'ellipse' && panel.center && panel.rx && panel.ry) {
        ctx.beginPath()
        ctx.ellipse(panel.center.x, panel.center.y, panel.rx, panel.ry, 0, 0, Math.PI * 2)
        ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.15)'
        ctx.fill()
        ctx.strokeStyle = isSelected ? '#3b82f6' : 'rgba(59, 130, 246, 0.7)'
        ctx.lineWidth = (isSelected ? 3 : 2) / zoom
        ctx.stroke()
      } else {
        ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.15)'
        ctx.fillRect(panel.x, panel.y, panel.w, panel.h)
        ctx.strokeStyle = isSelected ? '#3b82f6' : 'rgba(59, 130, 246, 0.7)'
        ctx.lineWidth = (isSelected ? 3 : 2) / zoom
        ctx.strokeRect(panel.x, panel.y, panel.w, panel.h)
      }

      const cx = panel.x + panel.w / 2
      const cy = panel.y + panel.h / 2
      ctx.font = `bold ${16 / zoom}px system-ui`
      ctx.fillStyle = isSelected ? '#3b82f6' : 'rgba(59, 130, 246, 0.9)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${panel.index + 1}`, cx, cy)

      ctx.restore()
    })

    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)

    if (isDrawing && drawStart && drawCurrent && (tool === 'rectangle' || tool === 'ellipse')) {
      ctx.setLineDash([5 / zoom, 5 / zoom])
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 2 / zoom
      if (tool === 'rectangle') {
        const x = Math.min(drawStart.x, drawCurrent.x)
        const y = Math.min(drawStart.y, drawCurrent.y)
        const w = Math.abs(drawCurrent.x - drawStart.x)
        const h = Math.abs(drawCurrent.y - drawStart.y)
        ctx.fillStyle = 'rgba(245, 158, 11, 0.2)'
        ctx.fillRect(x, y, w, h)
        ctx.strokeRect(x, y, w, h)
      } else {
        const rx = Math.abs(drawCurrent.x - drawStart.x)
        const ry = Math.abs(drawCurrent.y - drawStart.y)
        ctx.beginPath()
        ctx.ellipse(drawStart.x, drawStart.y, rx, ry, 0, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(245, 158, 11, 0.2)'
        ctx.fill()
        ctx.stroke()
      }
    }

    if (freeformPoints.length > 0) {
      ctx.setLineDash([5 / zoom, 5 / zoom])
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 2 / zoom
      ctx.beginPath()
      ctx.moveTo(freeformPoints[0].x, freeformPoints[0].y)
      freeformPoints.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
      if (drawCurrent) ctx.lineTo(drawCurrent.x, drawCurrent.y)
      ctx.stroke()
      freeformPoints.forEach((p, i) => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 5 / zoom, 0, Math.PI * 2)
        ctx.fillStyle = i === 0 ? '#22c55e' : '#f59e0b'
        ctx.fill()
      })
    }

    if (brushStrokes.length >= 2) {
      const strokeSize = brushStrokes[0].size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(brushStrokes[0].x, brushStrokes[0].y)
      for (let i = 1; i < brushStrokes.length - 1; i++) {
        const xc = (brushStrokes[i].x + brushStrokes[i + 1].x) / 2
        const yc = (brushStrokes[i].y + brushStrokes[i + 1].y) / 2
        ctx.quadraticCurveTo(brushStrokes[i].x, brushStrokes[i].y, xc, yc)
      }
      if (brushStrokes.length > 1) {
        const last = brushStrokes[brushStrokes.length - 1]
        ctx.lineTo(last.x, last.y)
      }
      ctx.lineWidth = strokeSize
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.stroke()
    }

    ctx.restore()
    animationRef.current = requestAnimationFrame(render)
  }, [pan, zoom, localPanels, selectedPanelId, isDrawing, drawStart, drawCurrent, tool, freeformPoints, brushStrokes])

  useEffect(() => {
    const updateSize = () => {
      if (canvasRef.current && containerRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth
        canvasRef.current.height = containerRef.current.clientHeight
      }
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    animationRef.current = requestAnimationFrame(render)
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [render])

  const getImagePoint = useCallback((e: React.MouseEvent): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    return {
      x: ((e.clientX - rect.left) * scaleX - pan.x) / zoom,
      y: ((e.clientY - rect.top) * scaleY - pan.y) / zoom
    }
  }, [pan, zoom])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pt = getImagePoint(e)

    if (tool === 'select') {
      const clicked = [...localPanels].reverse().find(p => 
        pt.x >= p.x && pt.x <= p.x + p.w && pt.y >= p.y && pt.y <= p.y + p.h
      )
      setSelectedPanelId(clicked?.id || null)
    } else if (tool === 'pan') {
      setIsDrawing(true)
      setLastPanPoint({ x: e.clientX, y: e.clientY })
    } else if (tool === 'freeform') {
      setFreeformPoints(prev => [...prev, pt])
    } else if (tool === 'brush') {
      setIsDrawing(true)
      setBrushStrokes([{ ...pt, size: brushSize }])
    } else {
      setIsDrawing(true)
      setDrawStart(pt)
      setDrawCurrent(pt)
    }
  }, [tool, localPanels, getImagePoint, brushSize])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pt = getImagePoint(e)
    setDrawCurrent(pt)

    if (tool === 'pan' && isDrawing && lastPanPoint) {
      const dx = e.clientX - lastPanPoint.x
      const dy = e.clientY - lastPanPoint.y
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }))
      setLastPanPoint({ x: e.clientX, y: e.clientY })
    } else if (tool === 'brush' && isDrawing) {
      setBrushStrokes(prev => [...prev, { ...pt, size: brushSize }])
    }
  }, [tool, isDrawing, lastPanPoint, getImagePoint, brushSize])

  const handleMouseUp = useCallback(() => {
    if (tool === 'pan') {
      setIsDrawing(false)
      setLastPanPoint(null)
      return
    }

    if (tool === 'brush' && brushStrokes.length >= 2) {
      const bounds = getBrushBounds(brushStrokes)
      if (bounds.w > 5 && bounds.h > 5) {
        addPanel({
          sceneId: scene.id,
          shape: 'brush',
          x: bounds.x,
          y: bounds.y,
          w: bounds.w,
          h: bounds.h,
          brushStrokes: [...brushStrokes]
        })
      }
      setBrushStrokes([])
      setIsDrawing(false)
      return
    }

    if (isDrawing && drawStart && drawCurrent) {
      if (tool === 'rectangle') {
        const x = Math.min(drawStart.x, drawCurrent.x)
        const y = Math.min(drawStart.y, drawCurrent.y)
        const w = Math.abs(drawCurrent.x - drawStart.x)
        const h = Math.abs(drawCurrent.y - drawStart.y)
        if (w > 10 && h > 10) {
          addPanel({ sceneId: scene.id, shape: 'rectangle', x, y, w, h })
        }
      } else if (tool === 'ellipse') {
        const rx = Math.abs(drawCurrent.x - drawStart.x)
        const ry = Math.abs(drawCurrent.y - drawStart.y)
        if (rx > 10 && ry > 10) {
          addPanel({
            sceneId: scene.id,
            shape: 'ellipse',
            x: drawStart.x - rx,
            y: drawStart.y - ry,
            w: rx * 2,
            h: ry * 2,
            center: { ...drawStart },
            rx,
            ry
          })
        }
      }
    }

    setIsDrawing(false)
    setDrawStart(null)
    setDrawCurrent(null)
  }, [tool, isDrawing, drawStart, drawCurrent, brushStrokes, scene.id, addPanel])

  const handleDoubleClick = useCallback(() => {
    if (tool === 'freeform' && freeformPoints.length >= 3) {
      const bounds = getPolygonBounds(freeformPoints)
      addPanel({
        sceneId: scene.id,
        shape: 'polygon',
        x: bounds.x,
        y: bounds.y,
        w: bounds.w,
        h: bounds.h,
        points: [...freeformPoints]
      })
      setFreeformPoints([])
    }
  }, [tool, freeformPoints, scene.id, addPanel])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.min(Math.max(zoom * delta, 0.1), 5)
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const newPanX = mx - (mx - pan.x) * (newZoom / zoom)
      const newPanY = my - (my - pan.y) * (newZoom / zoom)
      setPan({ x: newPanX, y: newPanY })
    }
    setZoom(newZoom)
  }, [zoom, pan])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && freeformPoints.length > 0) {
        setFreeformPoints([])
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [freeformPoints])

  const brushCursorDataUrl = useMemo(() => {
    const actualSize = brushSize * zoom
    const cursorSize = Math.max(16, Math.min(actualSize, 128))
    const half = cursorSize / 2
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cursorSize}" height="${cursorSize}" viewBox="0 0 ${cursorSize} ${cursorSize}">
      <circle cx="${half}" cy="${half}" r="${half - 1}" fill="rgba(0,0,0,0.25)" stroke="rgba(0,0,0,0.7)" stroke-width="1.5"/>
      <line x1="${half - 4}" y1="${half}" x2="${half + 4}" y2="${half}" stroke="rgba(0,0,0,0.8)" stroke-width="1"/>
      <line x1="${half}" y1="${half - 4}" x2="${half}" y2="${half + 4}" stroke="rgba(0,0,0,0.8)" stroke-width="1"/>
    </svg>`
    return `url('data:image/svg+xml;base64,${btoa(svg)}') ${half} ${half}, crosshair`
  }, [brushSize, zoom])

  const getCursor = () => {
    if (tool === 'pan') return isDrawing ? 'grabbing' : 'grab'
    if (tool === 'select') return 'default'
    if (tool === 'brush') return brushCursorDataUrl
    return 'crosshair'
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 h-12 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Geri</span>
          </button>
          <div className="w-px h-6 bg-gray-700" />
          <h1 className="text-white font-bold text-sm">{scene.title}</h1>
          {scene.is_decision_scene && (
            <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded">Karar Sahnesi</span>
          )}
          <span className="text-gray-500 text-xs">{localPanels.length} panel</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={savePanels}
            disabled={saving}
            className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-500 disabled:opacity-50 flex items-center gap-1"
          >
            <Save size={14} />
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          <button 
            onClick={() => setIsReaderOpen(true)} 
            disabled={localPanels.length === 0}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-500 disabled:opacity-50 flex items-center gap-1"
          >
            <Play size={14} /> Önizle
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Tools */}
        <div className="w-14 flex-shrink-0 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-2 gap-1">
          {[
            { id: 'select', icon: MousePointer, label: 'Select' },
            { id: 'pan', icon: Move, label: 'Pan' },
            { id: 'rectangle', icon: Square, label: 'Rectangle' },
            { id: 'ellipse', icon: Circle, label: 'Ellipse' },
            { id: 'freeform', icon: Spline, label: 'Freeform' },
            { id: 'brush', icon: Pencil, label: 'Brush' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => { setTool(t.id as DrawingTool); setFreeformPoints([]); setBrushStrokes([]) }}
              className={`w-10 h-10 rounded flex items-center justify-center transition-colors ${
                tool === t.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
              title={t.label}
            >
              <t.icon size={18} />
            </button>
          ))}

          <div className="flex-1" />

          <button onClick={() => setZoom(z => Math.min(z * 1.2, 5))} className="w-10 h-10 rounded flex items-center justify-center text-gray-400 hover:bg-gray-700 hover:text-white" title="Zoom In">
            <ZoomIn size={18} />
          </button>
          <div className="text-gray-500 text-xs">{Math.round(zoom * 100)}%</div>
          <button onClick={() => setZoom(z => Math.max(z / 1.2, 0.1))} className="w-10 h-10 rounded flex items-center justify-center text-gray-400 hover:bg-gray-700 hover:text-white" title="Zoom Out">
            <ZoomOut size={18} />
          </button>
          <button onClick={resetView} className="w-10 h-10 rounded flex items-center justify-center text-gray-400 hover:bg-gray-700 hover:text-white text-xs font-bold" title="Fit">
            Fit
          </button>

          <div className="h-px bg-gray-700 w-8 my-2" />

          <button onClick={undo} disabled={historyIndex <= 0} className="w-10 h-10 rounded flex items-center justify-center text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30" title="Undo">
            <RotateCcw size={18} />
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} className="w-10 h-10 rounded flex items-center justify-center text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30" title="Redo">
            <RotateCw size={18} />
          </button>
        </div>

        {/* Canvas area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div ref={containerRef} className="flex-1 relative overflow-hidden">
            <canvas
              ref={canvasRef}
              style={{ cursor: getCursor() }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => { setIsDrawing(false); setLastPanPoint(null) }}
              onDoubleClick={handleDoubleClick}
              onWheel={handleWheel}
              className="absolute inset-0"
            />

            {tool === 'freeform' && (
              <div className="absolute top-2 left-2 bg-gray-800/90 text-white text-xs px-2 py-1 rounded">
                {freeformPoints.length === 0 ? 'Nokta eklemek için tıklayın' : `${freeformPoints.length} nokta - Bitirmek için çift tıklayın`}
              </div>
            )}
            {tool === 'brush' && (
              <div className="absolute top-2 left-2 bg-gray-800/95 text-white text-xs px-3 py-2 rounded-lg flex items-center gap-3 shadow-lg">
                <span className="font-medium">Fırça Boyutu:</span>
                <input type="range" min="30" max="150" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="w-32 h-2 accent-blue-500 cursor-pointer" />
                <span className="bg-gray-700 px-2 py-0.5 rounded min-w-[50px] text-center font-mono">{brushSize}px</span>
              </div>
            )}
            {freeformPoints.length >= 3 && (
              <button onClick={handleDoubleClick} className="absolute top-2 right-2 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-500">
                Tamamla ({freeformPoints.length} nokta)
              </button>
            )}
          </div>

        </div>

        {/* Right sidebar - Panels */}
        <div className="w-64 flex-shrink-0 bg-gray-800 border-l border-gray-700 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white text-xs font-bold uppercase">Panels ({localPanels.length})</h3>
              <div className="flex gap-1">
                <button onClick={() => setReadingDirection(d => d === 'ltr' ? 'rtl' : 'ltr')} className="text-gray-400 hover:text-white text-[10px] px-1.5 py-0.5 bg-gray-700 rounded">
                  {readingDirection.toUpperCase()}
                </button>
                <button onClick={sortPanels} disabled={localPanels.length < 2} className="text-[10px] px-1.5 py-0.5 bg-gray-700 text-gray-400 hover:text-white rounded disabled:opacity-30">
                  Sort
                </button>
              </div>
            </div>

            <div className="space-y-0.5">
              {localPanels.sort((a, b) => a.index - b.index).map(panel => (
                <div
                  key={panel.id}
                  onClick={() => setSelectedPanelId(panel.id)}
                  className={`flex items-center gap-2 p-1.5 rounded text-xs cursor-pointer ${
                    panel.id === selectedPanelId ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  <span className="w-5 h-5 bg-gray-600 rounded flex items-center justify-center text-[10px] font-bold">
                    {panel.index + 1}
                  </span>
                  <span className="flex-1 capitalize">{panel.shape}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deletePanel(panel.id) }}
                    className="p-0.5 hover:bg-red-600 rounded opacity-50 hover:opacity-100"
                    title="Sil"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            {localPanels.length === 0 && (
              <div className="text-gray-500 text-xs text-center mt-4">
                Panel yok.<br />Araçları kullanarak panel çizin.
              </div>
            )}
          </div>
        </div>
      </div>

      <ReaderDialog
        isOpen={isReaderOpen}
        onClose={() => setIsReaderOpen(false)}
        scene={scene}
        panels={localPanels}
      />
    </div>
  )
}

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

export default function PanelDashboard({ initialStories, initialChoices, userId }: PanelDashboardProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [stories, setStories] = useState<StoryWithScenes[]>(initialStories)
  const [choices, setChoices] = useState<Choice[]>(initialChoices)
  const [selectedStory, setSelectedStory] = useState<StoryWithScenes | null>(null)
  const [selectedScene, setSelectedScene] = useState<(Scene & { panels: Panel[] }) | null>(null)
  const [loading, setLoading] = useState(false)
  
  const [showStoryModal, setShowStoryModal] = useState(false)
  const [showSceneModal, setShowSceneModal] = useState(false)
  const [editingStory, setEditingStory] = useState<Story | null>(null)

  const [storyForm, setStoryForm] = useState({ title: '', description: '' })
  const [sceneForm, setSceneForm] = useState({ title: '', is_decision_scene: false, is_start_scene: false })
  const [imageFile, setImageFile] = useState<File | null>(null)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleCreateStory = async () => {
    if (!storyForm.title) return
    setLoading(true)
    const { data, error } = await supabase.from('stories').insert({ title: storyForm.title, description: storyForm.description || null, author_id: userId }).select().single()
    if (!error && data) {
      setStories([{ ...data, scenes: [] }, ...stories])
      setShowStoryModal(false)
      setStoryForm({ title: '', description: '' })
    }
    setLoading(false)
  }

  const handleUpdateStory = async () => {
    if (!editingStory || !storyForm.title) return
    setLoading(true)
    const { error } = await supabase.from('stories').update({ title: storyForm.title, description: storyForm.description || null }).eq('id', editingStory.id)
    if (!error) {
      setStories(stories.map(s => s.id === editingStory.id ? { ...s, title: storyForm.title, description: storyForm.description } : s))
      setShowStoryModal(false)
      setEditingStory(null)
      setStoryForm({ title: '', description: '' })
    }
    setLoading(false)
  }

  const handleDeleteStory = async (storyId: string) => {
    if (!confirm('Bu hikayeyi silmek istediğinize emin misiniz?')) return
    const { error } = await supabase.from('stories').delete().eq('id', storyId)
    if (!error) {
      setStories(stories.filter(s => s.id !== storyId))
      if (selectedStory?.id === storyId) setSelectedStory(null)
    }
  }

  const handleTogglePublish = async (story: StoryWithScenes) => {
    const { error } = await supabase.from('stories').update({ is_published: !story.is_published }).eq('id', story.id)
    if (!error) setStories(stories.map(s => s.id === story.id ? { ...s, is_published: !s.is_published } : s))
  }

  const handleCreateScene = async () => {
    if (!selectedStory || !sceneForm.title || !imageFile) return
    setLoading(true)

    const fileExt = imageFile.name.split('.').pop()
    const fileName = `${userId}/${selectedStory.id}/${Date.now()}.${fileExt}`
    
    const { error: uploadError } = await supabase.storage.from('story-images').upload(fileName, imageFile)
    if (uploadError) {
      alert('Görsel yüklenemedi: ' + uploadError.message)
      setLoading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('story-images').getPublicUrl(fileName)

    const img = new Image()
    img.src = URL.createObjectURL(imageFile)
    await new Promise(resolve => img.onload = resolve)

    const orderIndex = selectedStory.scenes?.length || 0
    const isFirstScene = orderIndex === 0

    const { data, error } = await supabase.from('scenes').insert({
      story_id: selectedStory.id,
      title: sceneForm.title,
      image_url: publicUrl,
      image_width: img.width,
      image_height: img.height,
      order_index: orderIndex,
      is_start_scene: sceneForm.is_start_scene || isFirstScene,
      is_decision_scene: sceneForm.is_decision_scene
    }).select().single()

    if (!error && data) {
      const newScene = { ...data, panels: [] }
      const updatedStory = { ...selectedStory, scenes: [...(selectedStory.scenes || []), newScene] }
      setStories(stories.map(s => s.id === selectedStory.id ? updatedStory : s))
      setSelectedStory(updatedStory)
      setShowSceneModal(false)
      setSceneForm({ title: '', is_decision_scene: false, is_start_scene: false })
      setImageFile(null)
    }
    setLoading(false)
  }

  const handleDeleteScene = async (sceneId: string) => {
    if (!confirm('Bu sahneyi silmek istediğinize emin misiniz?')) return
    const { error } = await supabase.from('scenes').delete().eq('id', sceneId)
    if (!error && selectedStory) {
      const updatedStory = { ...selectedStory, scenes: selectedStory.scenes.filter(s => s.id !== sceneId) }
      setStories(stories.map(s => s.id === selectedStory.id ? updatedStory : s))
      setSelectedStory(updatedStory)
    }
  }

  const handleToggleStartScene = async (scene: Scene) => {
    if (!selectedStory) return
    await supabase.from('scenes').update({ is_start_scene: false }).eq('story_id', selectedStory.id)
    const { error } = await supabase.from('scenes').update({ is_start_scene: true }).eq('id', scene.id)
    if (!error) {
      const updatedStory = { ...selectedStory, scenes: selectedStory.scenes.map(s => ({ ...s, is_start_scene: s.id === scene.id })) }
      setStories(stories.map(s => s.id === selectedStory.id ? updatedStory : s))
      setSelectedStory(updatedStory)
    }
  }

  const handleToggleDecisionScene = async (scene: Scene) => {
    const { error } = await supabase.from('scenes').update({ is_decision_scene: !scene.is_decision_scene }).eq('id', scene.id)
    if (!error && selectedStory) {
      const updatedStory = { ...selectedStory, scenes: selectedStory.scenes.map(s => s.id === scene.id ? { ...s, is_decision_scene: !s.is_decision_scene } : s) }
      setStories(stories.map(s => s.id === selectedStory.id ? updatedStory : s))
      setSelectedStory(updatedStory)
    }
  }

  if (selectedScene && selectedStory) {
    return (
      <SceneEditor
        scene={selectedScene}
        onPanelsChange={(panels) => {
          const updatedScene = { ...selectedScene, panels }
          setSelectedScene(updatedScene)
          const updatedStory = { ...selectedStory, scenes: selectedStory.scenes.map(s => s.id === selectedScene.id ? updatedScene : s) }
          setStories(stories.map(s => s.id === selectedStory.id ? updatedStory : s))
          setSelectedStory(updatedStory)
        }}
        onBack={() => setSelectedScene(null)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/')} className="text-gray-500 hover:text-gray-700"><Home size={20} /></button>
            <span className="text-gray-300">/</span>
            <button onClick={() => { setSelectedStory(null); setSelectedScene(null) }} className={`font-semibold ${!selectedStory ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              Hikayelerim
            </button>
            {selectedStory && (
              <>
                <ChevronRight size={16} className="text-gray-400" />
                <span className="font-medium text-gray-900">{selectedStory.title}</span>
              </>
            )}
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <LogOut size={18} /> Çıkış
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {!selectedStory && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Hikayelerim</h1>
              <button onClick={() => { setEditingStory(null); setStoryForm({ title: '', description: '' }); setShowStoryModal(true) }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                <Plus size={18} /> Yeni Hikaye
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stories.map(story => (
                <div key={story.id} className="bg-white rounded-lg border overflow-hidden">
                  <div className="p-4 cursor-pointer hover:bg-gray-50" onClick={() => setSelectedStory(story)}>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{story.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded ${story.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {story.is_published ? 'Yayında' : 'Taslak'}
                      </span>
                    </div>
                    {story.description && <p className="text-sm text-gray-500 line-clamp-2">{story.description}</p>}
                    <div className="mt-2 text-xs text-gray-400">{story.scenes?.length || 0} sahne</div>
                  </div>
                  {/* Flow Editor Button */}
                  <div className="px-4 py-2 border-t bg-purple-50">
                    <button 
                      onClick={(e) => { e.stopPropagation(); router.push(`/panel/flow/${story.id}`) }} 
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <GitBranch size={16} />
                      Hikaye Akışını Düzenle
                    </button>
                  </div>
                  <div className="px-4 py-2 border-t bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); setEditingStory(story); setStoryForm({ title: story.title, description: story.description || '' }); setShowStoryModal(true) }} className="p-1 text-gray-400 hover:text-gray-600" title="Düzenle"><Edit3 size={16} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteStory(story.id) }} className="p-1 text-gray-400 hover:text-red-600" title="Sil"><Trash2 size={16} /></button>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleTogglePublish(story) }} className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${story.is_published ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
                      {story.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                      {story.is_published ? 'Yayından Kaldır' : 'Yayınla'}
                    </button>
                  </div>
                </div>
              ))}
              {stories.length === 0 && (
                <div className="col-span-full text-center py-12 bg-white rounded-lg border">
                  <p className="text-gray-500 mb-4">Henüz hikaye oluşturmadınız.</p>
                  <button onClick={() => setShowStoryModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">İlk Hikayeni Oluştur</button>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedStory && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">{selectedStory.title} - Sahneler</h1>
              <button onClick={() => { setSceneForm({ title: '', is_decision_scene: false, is_start_scene: false }); setImageFile(null); setShowSceneModal(true) }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                <Plus size={18} /> Yeni Sahne
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedStory.scenes?.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)).map(scene => {
                const sceneChoicesCount = choices.filter(c => c.from_scene_id === scene.id).length
                return (
                  <div key={scene.id} className="bg-white rounded-lg border overflow-hidden">
                    <div className="cursor-pointer hover:opacity-90 relative" onClick={() => setSelectedScene(scene)}>
                      <img src={scene.image_url || ''} alt={scene.title} className="w-full h-32 object-cover" />
                      {scene.is_decision_scene && sceneChoicesCount > 0 && (
                        <div className="absolute bottom-2 right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                          <GitBranch size={12} /> {sceneChoicesCount}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="font-medium text-gray-900 text-sm">{scene.title}</h3>
                        <div className="flex items-center gap-1">
                          {scene.is_start_scene && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Başlangıç</span>}
                          {scene.is_decision_scene && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Karar</span>}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">{scene.panels?.length || 0} panel</div>
                    </div>
                    <div className="px-3 py-2 border-t bg-gray-50 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); handleToggleStartScene(scene) }} className={`px-2 py-1 rounded ${scene.is_start_scene ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>Başlangıç</button>
                        <button onClick={(e) => { e.stopPropagation(); handleToggleDecisionScene(scene) }} className={`flex items-center gap-1 px-2 py-1 rounded ${scene.is_decision_scene ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-100'}`}>
                          <GitBranch size={12} /> Karar
                        </button>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteScene(scene.id) }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </div>
                )
              })}
              {(!selectedStory.scenes || selectedStory.scenes.length === 0) && (
                <div className="col-span-full text-center py-12 bg-white rounded-lg border">
                  <ImageIcon size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 mb-4">Bu hikayede henüz sahne yok.</p>
                  <button onClick={() => setShowSceneModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">İlk Sahneyi Ekle</button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {showStoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4 text-gray-900">{editingStory ? 'Hikayeyi Düzenle' : 'Yeni Hikaye'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label>
                <input type="text" value={storyForm.title} onChange={(e) => setStoryForm({ ...storyForm, title: e.target.value })} className="w-full px-3 py-2 border rounded text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Hikaye başlığı" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <textarea value={storyForm.description} onChange={(e) => setStoryForm({ ...storyForm, description: e.target.value })} className="w-full px-3 py-2 border rounded text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} placeholder="Kısa açıklama (opsiyonel)" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowStoryModal(false); setEditingStory(null) }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">İptal</button>
              <button onClick={editingStory ? handleUpdateStory : handleCreateStory} disabled={loading || !storyForm.title} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Kaydediliyor...' : editingStory ? 'Güncelle' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSceneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Yeni Sahne</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sahne Adı</label>
                <input type="text" value={sceneForm.title} onChange={(e) => setSceneForm({ ...sceneForm, title: e.target.value })} className="w-full px-3 py-2 border rounded text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Sahne adı" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Görsel</label>
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="w-full px-3 py-2 border rounded text-gray-900 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={sceneForm.is_start_scene} onChange={(e) => setSceneForm({ ...sceneForm, is_start_scene: e.target.checked })} className="rounded" />
                  <span className="text-sm text-gray-700">Başlangıç sahnesi</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={sceneForm.is_decision_scene} onChange={(e) => setSceneForm({ ...sceneForm, is_decision_scene: e.target.checked })} className="rounded" />
                  <span className="text-sm text-gray-700">Karar sahnesi</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowSceneModal(false); setImageFile(null) }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">İptal</button>
              <button onClick={handleCreateScene} disabled={loading || !sceneForm.title || !imageFile} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Yükleniyor...' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
