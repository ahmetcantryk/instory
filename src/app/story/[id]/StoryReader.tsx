'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { X, Maximize, Minimize, Home, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import type { Story, Scene, Panel, Choice } from '@/types/database'

interface StoryWithScenes extends Story {
  scenes: (Scene & { panels: Panel[] })[]
}

interface StoryReaderProps {
  story: StoryWithScenes
  choices: Choice[]
}

type ReadingMode = 'focus' | 'panel-to-panel'

// Preload images utility
const preloadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Focus Mode Icon (zoom/spotlight style)
const FocusModeIcon = ({ active }: { active: boolean }) => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={active ? '#f97316' : 'currentColor'}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 6.01A.01.01 0 0 1 5.01 6h6.977a.01.01 0 0 1 .01.012l-.995 3.98a.01.01 0 0 1-.01.008H5.01A.01.01 0 0 1 5 9.99V6.01Z" fill={active ? '#f97316' : 'currentColor'} stroke="none" />
    <path d="M15.998 6.008a.01.01 0 0 1 .01-.008h2.982a.01.01 0 0 1 .01.01v11.98a.01.01 0 0 1-.01.01h-5.977a.01.01 0 0 1-.01-.012l2.995-11.98Z" fill={active ? '#f97316' : 'currentColor'} stroke="none" />
    <path d="M5 14.01a.01.01 0 0 1 .01-.01h4.977a.01.01 0 0 1 .01.012l-.995 3.98a.01.01 0 0 1-.01.008H5.01a.01.01 0 0 1-.01-.01v-3.98Z" fill={active ? '#f97316' : 'currentColor'} stroke="none" />
  </svg>
)

// Panel-to-Panel Icon (grid reveal style)
const PanelToPanelIcon = ({ active }: { active: boolean }) => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={active ? '#f97316' : 'currentColor'}
    strokeWidth="1.5"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" fill={active ? '#f97316' : 'none'} />
    <rect x="14" y="3" width="7" height="7" rx="1" opacity="0.4" />
    <rect x="3" y="14" width="7" height="7" rx="1" opacity="0.4" />
    <rect x="14" y="14" width="7" height="7" rx="1" opacity="0.4" />
  </svg>
)

interface HistoryEntry {
  sceneId: string
  panelIndex: number
  revealedPanels: Set<number>
}

export default function StoryReader({ story, choices }: StoryReaderProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  
  // Find start scene
  const startScene = story.scenes?.find(s => s.is_start_scene) || story.scenes?.[0]
  
  const [currentSceneId, setCurrentSceneId] = useState<string>(startScene?.id || '')
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [viewSize, setViewSize] = useState({ w: 800, h: 600 })
  const [showChoices, setShowChoices] = useState(false)
  const [storyEnded, setStoryEnded] = useState(false)
  const [readingMode, setReadingMode] = useState<ReadingMode>('focus')
  const [revealedPanels, setRevealedPanels] = useState<Set<number>>(new Set([0]))
  const [hoverSide, setHoverSide] = useState<'left' | 'right' | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  // Get all unique image URLs for preloading
  const allImageUrls = useMemo(() => {
    return [...new Set(story.scenes?.map(s => s.image_url).filter(Boolean) || [])]
  }, [story.scenes])

  // Preload all images on mount
  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    
    const preloadAll = async () => {
      const promises = allImageUrls.map(async (url) => {
        try {
          await preloadImage(url)
          if (isMounted) {
            setLoadedImages(prev => new Set([...prev, url]))
          }
        } catch (err) {
          console.warn('Failed to preload:', url)
        }
      })
      
      await Promise.all(promises)
      if (isMounted) {
        setIsLoading(false)
      }
    }
    
    preloadAll()
    
    return () => { isMounted = false }
  }, [allImageUrls])

  // Check if current scene image is loaded
  const isCurrentImageLoaded = useMemo(() => {
    const currentUrl = story.scenes?.find(s => s.id === currentSceneId)?.image_url
    return currentUrl ? loadedImages.has(currentUrl) : false
  }, [currentSceneId, loadedImages, story.scenes])

  // Get current scene and its panels
  const currentScene = story.scenes?.find(s => s.id === currentSceneId)
  const sortedPanels = useMemo(() => 
    currentScene?.panels?.sort((a, b) => a.order_index - b.order_index) || []
  , [currentScene])
  const currentPanel = sortedPanels[currentPanelIndex]
  
  // Get choices for current scene (only real choices with text, not normal flows)
  const sceneChoices = choices.filter(c => 
    c.from_scene_id === currentSceneId && 
    c.choice_text && c.choice_text.trim() !== ''
  )
  
  // Get normal flow connection (choice without text)
  const normalFlowConnection = choices.find(c => 
    c.from_scene_id === currentSceneId && 
    (!c.choice_text || c.choice_text.trim() === '')
  )
  
  // Check if current scene is an ending (no outgoing connections)
  const isEndingScene = !choices.some(c => c.from_scene_id === currentSceneId)
  
  // Check if we're at the last panel
  const isAtLastPanel = currentPanelIndex === sortedPanels.length - 1
  
  // Check if we're at a decision point (last panel with multiple choices)
  const isAtDecisionPoint = isAtLastPanel && sceneChoices.length > 0

  // Can go back?
  const canGoBack = currentPanelIndex > 0 || history.length > 0

  // Auto fullscreen on mount
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (containerRef.current && document.fullscreenEnabled && !document.fullscreenElement) {
          await containerRef.current.requestFullscreen()
        }
      } catch (err) {
        console.log('Auto fullscreen failed:', err)
      }
    }
    // Small delay to ensure component is mounted
    const timer = setTimeout(enterFullscreen, 100)
    return () => clearTimeout(timer)
  }, [])

  // Reset revealed panels when scene changes
  useEffect(() => {
    setRevealedPanels(new Set([0]))
  }, [currentSceneId])

  // Measure viewport
  useEffect(() => {
    const measure = () => {
      if (viewRef.current) {
        setViewSize({ w: viewRef.current.clientWidth, h: viewRef.current.clientHeight })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [isFullscreen])

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else if (containerRef.current) {
        await containerRef.current.requestFullscreen()
      }
    } catch (err) {
      console.log('Fullscreen error:', err)
    }
  }, [])

  // Navigation - Go Next
  const goNext = useCallback(() => {
    if (showChoices || storyEnded) return
    
    // If at decision point, show choices
    if (isAtDecisionPoint) {
      setShowChoices(true)
      return
    }
    
    // If not at last panel, go to next panel
    if (currentPanelIndex < sortedPanels.length - 1) {
      const nextIndex = currentPanelIndex + 1
      setCurrentPanelIndex(nextIndex)
      // Reveal the next panel
      setRevealedPanels(prev => new Set([...prev, nextIndex]))
      return
    }
    
    // At last panel - check what to do next
    if (isAtLastPanel) {
      // If this is an ending scene, show end screen
      if (isEndingScene) {
        setStoryEnded(true)
        return
      }
      
      // If there's a normal flow connection, follow it
      if (normalFlowConnection) {
        // Save to history
        setHistory(prev => [...prev, { 
          sceneId: currentSceneId, 
          panelIndex: currentPanelIndex,
          revealedPanels: new Set(revealedPanels)
        }])
        setCurrentSceneId(normalFlowConnection.to_scene_id)
        setCurrentPanelIndex(0)
        return
      }
    }
  }, [currentPanelIndex, sortedPanels.length, isAtDecisionPoint, isAtLastPanel, isEndingScene, normalFlowConnection, showChoices, storyEnded, currentSceneId, revealedPanels])

  // Navigation - Go Previous
  const goPrev = useCallback(() => {
    if (showChoices) {
      setShowChoices(false)
      return
    }
    if (storyEnded) {
      setStoryEnded(false)
      return
    }
    
    if (currentPanelIndex > 0) {
      setCurrentPanelIndex(prev => prev - 1)
    } else if (history.length > 0) {
      // Go back to previous scene
      const lastEntry = history[history.length - 1]
      setHistory(prev => prev.slice(0, -1))
      setCurrentSceneId(lastEntry.sceneId)
      setCurrentPanelIndex(lastEntry.panelIndex)
      setRevealedPanels(lastEntry.revealedPanels)
    }
  }, [currentPanelIndex, history, showChoices, storyEnded])

  const handleChoice = useCallback((choice: Choice) => {
    // Save to history
    setHistory(prev => [...prev, { 
      sceneId: currentSceneId, 
      panelIndex: currentPanelIndex,
      revealedPanels: new Set(revealedPanels)
    }])
    setCurrentSceneId(choice.to_scene_id)
    setCurrentPanelIndex(0)
    setShowChoices(false)
    setStoryEnded(false)
  }, [currentSceneId, currentPanelIndex, revealedPanels])

  // Mouse move handler
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (showChoices || storyEnded) {
      setHoverSide(null)
      return
    }
    
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const relX = x / rect.width
    
    setMousePos({ x: e.clientX, y: e.clientY })
    
    // Left 30% of screen
    if (relX < 0.3) {
      setHoverSide('left')
    }
    // Right 30% of screen
    else if (relX > 0.7) {
      setHoverSide('right')
    }
    else {
      setHoverSide(null)
    }
  }, [showChoices, storyEnded])

  // Click handler
  const handleViewClick = useCallback((e: React.MouseEvent) => {
    if (showChoices || storyEnded) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const relX = x / rect.width
    
    if (relX < 0.3 && canGoBack) {
      goPrev()
    } else if (relX > 0.7) {
      goNext()
    } else {
      // Middle click - also go next
      goNext()
    }
  }, [showChoices, storyEnded, canGoBack, goPrev, goNext])

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        if (!showChoices && !storyEnded) goNext()
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      }
      if (e.key === 'Escape') {
        if (showChoices) {
          setShowChoices(false)
        } else if (storyEnded) {
          setStoryEnded(false)
        } else if (document.fullscreenElement) {
          document.exitFullscreen()
        } else {
          router.push('/')
        }
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        toggleFullscreen()
      }
      // Toggle reading mode with 'm' key
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        setReadingMode(prev => prev === 'focus' ? 'panel-to-panel' : 'focus')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, goPrev, showChoices, storyEnded, toggleFullscreen, router])

  // Loading screen
  if (isLoading || !isCurrentImageLoaded) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
        <Loader2 size={48} className="text-white/60 animate-spin mb-4" />
        <p className="text-white/60 text-sm">Hikaye yükleniyor...</p>
        <p className="text-white/30 text-xs mt-2">
          {loadedImages.size} / {allImageUrls.length} görsel
        </p>
      </div>
    )
  }

  if (!currentScene || !currentPanel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="mb-4">Bu hikayede henüz sahne yok.</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-white text-gray-900 rounded hover:bg-gray-100"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    )
  }

  // Generate clip path for a panel
  const generateClipPath = (panel: Panel) => {
    if (panel.shape === 'polygon' && panel.points) {
      const points = panel.points as { x: number; y: number }[]
      return `polygon(${points.map(p => `${p.x}px ${p.y}px`).join(', ')})`
    } else if (panel.shape === 'ellipse' && panel.ellipse_data) {
      const e = panel.ellipse_data as { centerX: number; centerY: number; rx: number; ry: number }
      return `ellipse(${e.rx}px ${e.ry}px at ${e.centerX}px ${e.centerY}px)`
    } else if (panel.shape === 'brush' && panel.brush_strokes) {
      const strokes = panel.brush_strokes as { x: number; y: number; size: number }[]
      if (strokes.length >= 2) {
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
        
        return `polygon(${[...topPoints, ...bottomPoints].join(', ')})`
      }
    }
    // Rectangle
    return `inset(${panel.y}px ${currentScene.image_width - panel.x - panel.width}px ${currentScene.image_height - panel.y - panel.height}px ${panel.x}px)`
  }

  // Calculate transform for focus mode
  const padding = 60
  const scaleX = (viewSize.w - padding * 2) / currentPanel.width
  const scaleY = (viewSize.h - padding * 2) / currentPanel.height
  const focusScale = Math.min(scaleX, scaleY, 3)
  const panelCenterX = currentPanel.x + currentPanel.width / 2
  const panelCenterY = currentPanel.y + currentPanel.height / 2
  const focusTranslateX = viewSize.w / 2 - panelCenterX * focusScale
  const focusTranslateY = viewSize.h / 2 - panelCenterY * focusScale

  // Calculate transform for panel-to-panel mode (fit whole image)
  const p2pPadding = 40
  const p2pScaleX = (viewSize.w - p2pPadding * 2) / currentScene.image_width
  const p2pScaleY = (viewSize.h - p2pPadding * 2) / currentScene.image_height
  const p2pScale = Math.min(p2pScaleX, p2pScaleY, 1)
  const p2pTranslateX = (viewSize.w - currentScene.image_width * p2pScale) / 2
  const p2pTranslateY = (viewSize.h - currentScene.image_height * p2pScale) / 2

  const currentClipPath = generateClipPath(currentPanel)

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Top left - Mode toggle buttons */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-1">
        <button 
          onClick={() => setReadingMode('focus')}
          className={`p-2 rounded-full transition-all ${
            readingMode === 'focus' 
              ? 'bg-orange-500/20 text-orange-500' 
              : 'bg-black/50 text-white/60 hover:text-white'
          }`}
          title="Focus Mode (M)"
        >
          <FocusModeIcon active={readingMode === 'focus'} />
        </button>
        <button 
          onClick={() => setReadingMode('panel-to-panel')}
          className={`p-2 rounded-full transition-all ${
            readingMode === 'panel-to-panel' 
              ? 'bg-orange-500/20 text-orange-500' 
              : 'bg-black/50 text-white/60 hover:text-white'
          }`}
          title="Panel-to-Panel Mode (M)"
        >
          <PanelToPanelIcon active={readingMode === 'panel-to-panel'} />
        </button>
      </div>

      {/* Top right controls */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <button 
          onClick={toggleFullscreen}
          className="p-2 text-white/60 hover:text-white bg-black/50 rounded-full"
          title={isFullscreen ? 'Tam ekrandan çık (F)' : 'Tam ekran (F)'}
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
        <button 
          onClick={() => router.push('/')}
          className="p-2 text-white/60 hover:text-white bg-black/50 rounded-full"
          title="Çıkış"
        >
          <X size={20} />
        </button>
      </div>

      {/* Viewport */}
      <div 
        ref={viewRef}
        className="flex-1 relative overflow-hidden"
        style={{ cursor: hoverSide ? 'none' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverSide(null)}
        onClick={handleViewClick}
      >
        {/* FOCUS MODE */}
        {readingMode === 'focus' && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: `translate(${focusTranslateX}px, ${focusTranslateY}px) scale(${focusScale})`,
              transformOrigin: '0 0',
              transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              willChange: 'transform'
            }}
          >
            {/* Dimmed background image */}
            <img
              src={currentScene.image_url}
              alt=""
              loading="eager"
              decoding="async"
              style={{ 
                display: 'block', 
                width: currentScene.image_width, 
                height: currentScene.image_height, 
                opacity: 0.12,
                willChange: 'opacity'
              }}
              draggable={false}
            />
            {/* Current panel - fade in */}
            <img
              key={`focus-${currentSceneId}-${currentPanelIndex}`}
              src={currentScene.image_url}
              alt=""
              loading="eager"
              decoding="async"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                display: 'block',
                width: currentScene.image_width,
                height: currentScene.image_height,
                clipPath: currentClipPath,
                animation: 'fadeIn 0.3s ease-out',
                willChange: 'clip-path, opacity'
              }}
              draggable={false}
            />
          </div>
        )}

        {/* PANEL-TO-PANEL MODE */}
        {readingMode === 'panel-to-panel' && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: `translate(${p2pTranslateX}px, ${p2pTranslateY}px) scale(${p2pScale})`,
              transformOrigin: '0 0',
              willChange: 'transform'
            }}
          >
            {/* Full image */}
            <img
              src={currentScene.image_url}
              alt=""
              loading="eager"
              decoding="async"
              style={{ 
                display: 'block', 
                width: currentScene.image_width, 
                height: currentScene.image_height,
                willChange: 'auto'
              }}
              draggable={false}
            />
            
            {/* Black overlay for each panel - revealed panels are transparent */}
            {sortedPanels.map((panel, index) => {
              const isRevealed = revealedPanels.has(index)
              const panelClipPath = generateClipPath(panel)
              
              return (
                <div
                  key={`overlay-${panel.id}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: currentScene.image_width,
                    height: currentScene.image_height,
                    backgroundColor: 'black',
                    clipPath: panelClipPath,
                    opacity: isRevealed ? 0 : 0.92,
                    transition: 'opacity 0.5s ease-out',
                    pointerEvents: 'none'
                  }}
                />
              )
            })}

            {/* Highlight current panel with subtle glow */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: currentScene.image_width,
                height: currentScene.image_height,
                clipPath: currentClipPath,
                boxShadow: 'inset 0 0 0 3px rgba(249, 115, 22, 0.5)',
                pointerEvents: 'none',
                transition: 'clip-path 0.3s ease-out'
              }}
            />
          </div>
        )}

        {/* Custom cursor - Navigation buttons */}
        {hoverSide && !showChoices && !storyEnded && (
          <div
            className="pointer-events-none fixed z-[100]"
            style={{
              left: mousePos.x,
              top: mousePos.y,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div 
              className={`w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg transition-transform ${
                hoverSide === 'left' && !canGoBack ? 'opacity-30' : 'opacity-100'
              }`}
            >
              {hoverSide === 'left' ? (
                <ChevronLeft size={24} className="text-gray-800" />
              ) : (
                <ChevronRight size={24} className="text-gray-800" />
              )}
            </div>
          </div>
        )}

        {/* Choice overlay - positioned at bottom of image area */}
        {showChoices && sceneChoices.length > 0 && (
          <div 
            className="absolute inset-0 flex flex-col justify-end pb-12"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-20 pb-6">
              <div className="max-w-md mx-auto px-6 space-y-3">
                {sceneChoices.map((choice, index) => (
                  <button
                    key={choice.id}
                    onClick={(e) => { e.stopPropagation(); handleChoice(choice) }}
                    className="w-full px-5 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 hover:border-white/40 rounded-lg text-white text-left transition-all cursor-pointer"
                  >
                    <span className="text-white/50 font-medium mr-3">{index + 1}</span>
                    {choice.choice_text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Story ended overlay */}
        {storyEnded && (
          <div 
            className="absolute inset-0 flex flex-col justify-end pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-t from-black via-black/90 to-transparent pt-32 pb-4">
              <div className="max-w-lg mx-auto px-4 text-center">
                <h2 className="text-3xl font-bold text-white mb-4">🎉 Hikaye Bitti!</h2>
                <p className="text-white/70 mb-8">Bu hikayenin sonuna ulaştın.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={(e) => { 
                      e.stopPropagation()
                      setCurrentSceneId(startScene?.id || '')
                      setCurrentPanelIndex(0)
                      setStoryEnded(false)
                      setRevealedPanels(new Set([0]))
                      setHistory([])
                    }}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors cursor-pointer"
                  >
                    🔄 Baştan Oku
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push('/') }}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors cursor-pointer"
                  >
                    🏠 Ana Sayfaya Dön
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Home button */}
      <button 
        onClick={(e) => { e.stopPropagation(); router.push('/') }}
        className="absolute bottom-6 left-6 p-2 text-white/30 hover:text-white/60 transition-all z-40"
        title="Ana Sayfa"
      >
        <Home size={18} />
      </button>

      {/* CSS for fade animation */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
