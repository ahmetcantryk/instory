'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { X, Maximize, Minimize, Home, ChevronLeft, ChevronRight, Loader2, Globe, Settings, Volume2, VolumeX } from 'lucide-react'
import type { Story, Scene, Panel, Choice, PanelText, SupportedLanguage, StoryAudio } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

interface StoryWithScenes extends Story {
  scenes: (Scene & { 
    panels: (Panel & { texts?: PanelText[] })[] 
  })[]
  languages?: { language: SupportedLanguage; is_primary: boolean }[]
}

interface StoryReaderProps {
  story: StoryWithScenes
  choices: Choice[]
  audios: StoryAudio[]
}

// Audio player için yardımcı arayüz
interface ActiveAudio {
  audio: StoryAudio
  element: HTMLAudioElement
  isFadingOut: boolean
}

type ReadingMode = 'focus' | 'panel-to-panel'

// Dil isimleri
const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  tr: 'Türkçe',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  ru: 'Русский',
  ar: 'العربية',
  he: 'עברית'
}

// ============================================================================
// GOOGLE FONTS LOADER - Mobil ve web için fontları dinamik yükler
// ============================================================================

// Font mapping - fontFamily değerinden Google Font ismini çıkar
const GOOGLE_FONT_MAP: Record<string, string> = {
  '"Bangers", Impact, cursive': 'Bangers',
  '"Permanent Marker", cursive': 'Permanent+Marker',
  '"Comic Neue", "Comic Sans MS", cursive': 'Comic+Neue:wght@400;700',
  '"Luckiest Guy", Impact, cursive': 'Luckiest+Guy',
  '"Fredoka", sans-serif': 'Fredoka:wght@400;600;700',
  '"Bubblegum Sans", cursive': 'Bubblegum+Sans',
  '"Roboto", sans-serif': 'Roboto:wght@400;500;700',
  '"Open Sans", sans-serif': 'Open+Sans:wght@400;600;700',
  '"Poppins", sans-serif': 'Poppins:wght@400;600;700',
  '"Nunito", sans-serif': 'Nunito:wght@400;600;700',
  '"Oswald", sans-serif': 'Oswald:wght@400;600;700',
  '"Russo One", sans-serif': 'Russo+One',
  '"Anton", sans-serif': 'Anton',
  '"Creepster", cursive': 'Creepster',
  '"Noto Sans JP", sans-serif': 'Noto+Sans+JP:wght@400;700',
  '"Kosugi Maru", sans-serif': 'Kosugi+Maru',
}

// Yüklenmiş fontları takip et
const loadedFonts = new Set<string>()

// Google Font'u yükle
const loadGoogleFont = (fontFamily: string): void => {
  const googleFontName = GOOGLE_FONT_MAP[fontFamily]
  if (!googleFontName || loadedFonts.has(googleFontName)) return
  
  loadedFonts.add(googleFontName)
  
  // Link elementi oluştur
  const link = document.createElement('link')
  link.href = `https://fonts.googleapis.com/css2?family=${googleFontName}&display=swap`
  link.rel = 'stylesheet'
  link.setAttribute('data-font', googleFontName)
  
  // Head'e ekle
  document.head.appendChild(link)
}

// Tüm text overlay fontlarını preload et
const preloadTextFonts = (texts: PanelText[]): void => {
  const fontFamilies = new Set<string>()
  
  texts.forEach(text => {
    // Ana stil
    if (text.style?.fontFamily) {
      fontFamilies.add(text.style.fontFamily)
    }
    // Override stiller
    text.contents?.forEach(content => {
      const override = content.style_override as Record<string, unknown> | null
      if (override?.fontFamily && typeof override.fontFamily === 'string') {
        fontFamilies.add(override.fontFamily)
      }
    })
  })
  
  fontFamilies.forEach(fontFamily => loadGoogleFont(fontFamily))
}

// Preload images utility
const preloadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Hex rengi RGBA'ya çevir
const hexToRgba = (hex: string, opacity: number): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return `rgba(255, 255, 255, ${opacity})`
  return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`
}

// Arkaplan stilini hesapla
const getBackgroundStyle = (style: { backgroundColor?: string; backgroundOpacity?: number }, bubbleType?: string): string => {
  if (bubbleType === 'sfx' || bubbleType === 'none') return 'transparent'
  const opacity = style.backgroundOpacity ?? 1
  if (opacity === 0) return 'transparent'
  const bgColor = style.backgroundColor || '#FFFFFF'
  return hexToRgba(bgColor, opacity)
}

// Focus Mode Icon (zoom/spotlight style)
const FocusModeIcon = ({ active, size = 20 }: { active: boolean; size?: number }) => (
  <svg 
    width={size} 
    height={size} 
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
const PanelToPanelIcon = ({ active, size = 20 }: { active: boolean; size?: number }) => (
  <svg 
    width={size} 
    height={size} 
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

// Text Overlay Component
interface TextOverlayRendererProps {
  texts: PanelText[]
  language: SupportedLanguage
  scale: number
  imageWidth: number
  imageHeight: number
}

// Extended style override interface for per-language customization
interface ContentStyleOverride {
  __position_x?: number
  __position_y?: number
  __width?: number
  __bubble_type?: string
  [key: string]: unknown
}

function TextOverlayRenderer({ texts, language, scale, imageWidth, imageHeight }: TextOverlayRendererProps) {
  if (!texts || texts.length === 0) return null

  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{ 
        width: imageWidth * scale, 
        height: imageHeight * scale,
        zIndex: 50 
      }}
    >
      {texts.filter(t => t.visible !== false).map((textOverlay) => {
        // Dil içeriğini bul
        const content = textOverlay.contents?.find(c => c.language === language)
        const fallbackContent = textOverlay.contents?.[0]
        const text = content?.text || fallbackContent?.text || ''
        
        if (!text) return null

        // Get style override with position/size overrides
        const styleOverride = (content?.style_override || {}) as ContentStyleOverride
        
        // Stil - merge base style with override (excluding __ prefixed keys)
        const style = textOverlay.style || {}
        const cleanOverride = Object.fromEntries(
          Object.entries(styleOverride).filter(([key]) => !key.startsWith('__'))
        )
        const mergedStyle = { ...style, ...cleanOverride }

        // Padding hesaplama
        const paddingX = (mergedStyle.paddingX ?? mergedStyle.padding ?? 12) * scale
        const paddingY = (mergedStyle.paddingY ?? mergedStyle.padding ?? 12) * scale

        // Position - use override if available, otherwise use base
        const posX = (styleOverride.__position_x ?? Number(textOverlay.position_x)) * scale
        const posY = (styleOverride.__position_y ?? Number(textOverlay.position_y)) * scale
        
        // Width - use override if available
        const width = styleOverride.__width ?? textOverlay.width

        // Bubble type - use override if available
        const bubbleType = (styleOverride.__bubble_type as string) || textOverlay.bubble_type

        // Arkaplan hesapla
        const bgStyle = getBackgroundStyle(mergedStyle, bubbleType)

        return (
          <div
            key={textOverlay.id}
            className="absolute pointer-events-none select-none"
            style={{
              left: posX,
              top: posY,
              width: width ? Number(width) * scale : 'auto',
              height: textOverlay.height ? Number(textOverlay.height) * scale : 'auto',
              transform: textOverlay.rotation ? `rotate(${Number(textOverlay.rotation)}deg)` : undefined,
              zIndex: (textOverlay.z_index || 0) + 100,
              
              // Smooth transition for language change
              transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
              
              // Font stili
              fontFamily: mergedStyle.fontFamily || 'Comic Sans MS, cursive, sans-serif',
              fontSize: (mergedStyle.fontSize || 16) * scale,
              fontWeight: mergedStyle.fontWeight || 'bold',
              fontStyle: mergedStyle.fontStyle || 'normal',
              color: mergedStyle.color || '#000000',
              backgroundColor: bgStyle,
              textAlign: mergedStyle.textAlign as React.CSSProperties['textAlign'] || 'center',
              lineHeight: mergedStyle.lineHeight || 1.3,
              letterSpacing: mergedStyle.letterSpacing ? mergedStyle.letterSpacing * scale : undefined,
              
              // Kutu stili
              padding: `${paddingY}px ${paddingX}px`,
              borderRadius: bubbleType === 'thought' ? 9999 : (mergedStyle.borderRadius || 20) * scale,
              borderColor: mergedStyle.borderColor,
              borderWidth: mergedStyle.borderWidth ? mergedStyle.borderWidth * scale : undefined,
              borderStyle: mergedStyle.borderWidth ? 'solid' : undefined,
              
              // Efektler
              opacity: mergedStyle.opacity ?? 1,
              direction: (mergedStyle.direction === 'ltr' || mergedStyle.direction === 'rtl') ? mergedStyle.direction : 'ltr',
              writingMode: mergedStyle.isVertical ? 'vertical-rl' : undefined,
              
              // Stroke/outline - SFX için text shadow
              WebkitTextStroke: mergedStyle.strokeColor && mergedStyle.strokeWidth 
                ? `${mergedStyle.strokeWidth * scale}px ${mergedStyle.strokeColor}` 
                : undefined,
              
              // Gölge - SFX için outline efekti
              textShadow: bubbleType === 'sfx' 
                ? `2px 2px 0 ${mergedStyle.backgroundColor || '#FFFFFF'}, -2px -2px 0 ${mergedStyle.backgroundColor || '#FFFFFF'}, 2px -2px 0 ${mergedStyle.backgroundColor || '#FFFFFF'}, -2px 2px 0 ${mergedStyle.backgroundColor || '#FFFFFF'}`
                : mergedStyle.shadow 
                  ? `${mergedStyle.shadow.offsetX * scale}px ${mergedStyle.shadow.offsetY * scale}px ${mergedStyle.shadow.blur * scale}px ${mergedStyle.shadow.color}`
                  : undefined,
            }}
          >
            {/* Text content with fade transition */}
            <div 
              key={`${textOverlay.id}-${language}`}
              className="animate-fadeIn"
            >
              {text.split('\n').map((line, i) => (
                <div key={i}>
                  {bubbleType === 'shout' ? line.toLocaleUpperCase('tr-TR') : line}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function StoryReader({ story, choices, audios }: StoryReaderProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  
  // Responsive breakpoints
  const [screenSize, setScreenSize] = useState<'xs' | 'sm' | 'md' | 'lg'>('lg')
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  
  // Computed helpers
  const isMobile = screenSize === 'xs' || screenSize === 'sm'
  const isTablet = screenSize === 'md'
  
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
  const [isSceneTransitioning, setIsSceneTransitioning] = useState(false)
  
  // Audio state
  const [isMuted, setIsMuted] = useState(false)
  const [masterVolume, setMasterVolume] = useState(1)
  const activeAudiosRef = useRef<Map<string, ActiveAudio>>(new Map())
  
  // Dil seçimi - metinlerden mevcut dilleri çek
  const availableLanguages = useMemo(() => {
    const langSet = new Set<SupportedLanguage>()
    
    // story.languages varsa ekle
    story.languages?.forEach(l => langSet.add(l.language))
    
    // Metinlerdeki dillerden de çek
    story.scenes?.forEach(scene => {
      scene.panels?.forEach(panel => {
        panel.texts?.forEach(text => {
          text.contents?.forEach(content => {
            if (content.language) {
              langSet.add(content.language)
            }
          })
        })
      })
    })
    
    // En az TR ve EN olsun
    if (langSet.size === 0) {
      langSet.add('tr')
      langSet.add('en')
    }
    
    return Array.from(langSet)
  }, [story.languages, story.scenes])
  
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(
    story.languages?.find(l => l.is_primary)?.language || 'tr'
  )
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Screen size and touch detection
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      
      // Determine screen size
      if (width < 480) setScreenSize('xs')
      else if (width < 768) setScreenSize('sm')
      else if (width < 1024) setScreenSize('md')
      else setScreenSize('lg')
      
      // Check orientation
      setOrientation(height > width ? 'portrait' : 'landscape')
      
      // Touch detection
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0)
    }
    
    checkDevice()
    window.addEventListener('resize', checkDevice)
    window.addEventListener('orientationchange', checkDevice)
    
    return () => {
      window.removeEventListener('resize', checkDevice)
      window.removeEventListener('orientationchange', checkDevice)
    }
  }, [])
  
  // Font preloading - tüm text overlay fontlarını önceden yükle
  useEffect(() => {
    const allTexts: PanelText[] = []
    story.scenes?.forEach(scene => {
      scene.panels?.forEach(panel => {
        if (panel.texts) {
          allTexts.push(...panel.texts)
        }
      })
    })
    
    if (allTexts.length > 0) {
      preloadTextFonts(allTexts)
    }
  }, [story.scenes])

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

  // Geri gitme devre dışı - sadece ileri gitme var

  // Auto fullscreen on mount (only for non-mobile devices)
  useEffect(() => {
    if (isMobile || isTablet) return // Don't auto-fullscreen on mobile/tablet
    
    const enterFullscreen = async () => {
      try {
        if (containerRef.current && document.fullscreenEnabled && !document.fullscreenElement) {
          await containerRef.current.requestFullscreen()
        }
      } catch (err) {
        console.log('Auto fullscreen failed:', err)
      }
    }
    const timer = setTimeout(enterFullscreen, 100)
    return () => clearTimeout(timer)
  }, [isMobile, isTablet])

  // Reset revealed panels when scene changes
  useEffect(() => {
    setRevealedPanels(new Set([0]))
  }, [currentSceneId])

  // Sync revealed panels when switching to panel-to-panel mode
  // Focus mode'dan geçerken, mevcut panel'e kadar tüm panelleri revealed yap
  useEffect(() => {
    if (readingMode === 'panel-to-panel') {
      setRevealedPanels(prev => {
        const newSet = new Set(prev)
        for (let i = 0; i <= currentPanelIndex; i++) {
          newSet.add(i)
        }
        return newSet
      })
    }
  }, [readingMode, currentPanelIndex])

  // ==================== AUDIO MANAGEMENT ====================

  // Volume hesaplama - 0-1 arasında clamp yapar
  // audioVolume: 0-2 (0-200%), masterVolume: 0-1, isMuted: boolean
  const calculateVolume = useCallback((audioVolume: number, muted: boolean, master: number): number => {
    if (muted) return 0
    // audioVolume 0-2 aralığında, HTML5 Audio 0-1 kabul ediyor
    // Eğer audioVolume > 1 ise, max 1'e clamp yapıyoruz
    const calculatedVolume = audioVolume * master
    return Math.max(0, Math.min(1, calculatedVolume))
  }, [])

  // Audio fade utility
  const fadeAudio = useCallback((element: HTMLAudioElement, targetVolume: number, duration: number, onComplete?: () => void) => {
    // targetVolume'u clamp et
    const clampedTarget = Math.max(0, Math.min(1, targetVolume))
    
    if (duration <= 0) {
      element.volume = clampedTarget
      onComplete?.()
      return
    }
    
    const steps = 20
    const stepDuration = duration / steps
    const currentVolume = element.volume
    const volumeDiff = clampedTarget - currentVolume
    const volumeStep = volumeDiff / steps
    let currentStep = 0
    
    const fade = () => {
      currentStep++
      element.volume = Math.max(0, Math.min(1, currentVolume + volumeStep * currentStep))
      if (currentStep < steps) {
        setTimeout(fade, stepDuration)
      } else {
        onComplete?.()
      }
    }
    fade()
  }, [])

  // Start playing an audio
  const startAudio = useCallback((audioData: StoryAudio) => {
    if (activeAudiosRef.current.has(audioData.id)) return // Already playing
    
    const element = new Audio(audioData.audio_url)
    element.loop = audioData.loop
    
    // Kayıtlı volume değerini clamp ederek uygula
    const initialVolume = calculateVolume(audioData.volume, isMuted, masterVolume)
    element.volume = initialVolume
    
    console.log(`[StoryReader] Starting: ${audioData.audio_name}, saved: ${audioData.volume} (${Math.round(audioData.volume * 100)}%), masterVolume: ${masterVolume}, applied: ${initialVolume}`)
    
    const activeAudio: ActiveAudio = {
      audio: audioData,
      element,
      isFadingOut: false
    }
    
    activeAudiosRef.current.set(audioData.id, activeAudio)
    
    // Start with delay if specified
    const startDelay = audioData.start_delay_ms || 0
    
    setTimeout(() => {
      if (audioData.fade_in_ms > 0) {
        element.volume = 0
        element.play().catch(console.warn)
        const fadeTarget = calculateVolume(audioData.volume, isMuted, masterVolume)
        fadeAudio(element, fadeTarget, audioData.fade_in_ms)
      } else {
        element.play().catch(console.warn)
      }
    }, startDelay)
    
    // Handle audio end (for non-looping)
    element.addEventListener('ended', () => {
      activeAudiosRef.current.delete(audioData.id)
    })
  }, [fadeAudio, isMuted, masterVolume, calculateVolume])

  // Stop an audio with optional fade
  const stopAudio = useCallback((audioId: string, fadeOut: boolean = true) => {
    const activeAudio = activeAudiosRef.current.get(audioId)
    if (!activeAudio || activeAudio.isFadingOut) return
    
    const fadeOutMs = activeAudio.audio.fade_out_ms || 0
    
    if (fadeOut && fadeOutMs > 0) {
      activeAudio.isFadingOut = true
      fadeAudio(activeAudio.element, 0, fadeOutMs, () => {
        activeAudio.element.pause()
        activeAudio.element.src = ''
        activeAudiosRef.current.delete(audioId)
      })
    } else {
      activeAudio.element.pause()
      activeAudio.element.src = ''
      activeAudiosRef.current.delete(audioId)
    }
  }, [fadeAudio])

  // Stop all audios
  const stopAllAudios = useCallback(() => {
    activeAudiosRef.current.forEach((_, audioId) => {
      stopAudio(audioId, false)
    })
  }, [stopAudio])

  // Update volume on all active audios when muted or volume changes
  useEffect(() => {
    activeAudiosRef.current.forEach(activeAudio => {
      if (!activeAudio.isFadingOut) {
        // Kayıtlı volume değerini clamp ederek uygula
        const newVolume = calculateVolume(activeAudio.audio.volume, isMuted, masterVolume)
        activeAudio.element.volume = newVolume
      }
    })
  }, [isMuted, masterVolume, calculateVolume])

  // Manage audio playback based on current scene/panel
  useEffect(() => {
    if (!audios || audios.length === 0) return

    // Get audios that should be playing now
    const storyAudios = audios.filter(a => !a.scene_id && !a.panel_id && a.autoplay)
    const sceneAudios = audios.filter(a => a.scene_id === currentSceneId && !a.panel_id && a.autoplay)
    const panelAudios = currentPanel 
      ? audios.filter(a => a.panel_id === currentPanel.id && a.autoplay)
      : []
    
    const shouldBePlaying = new Set([
      ...storyAudios.map(a => a.id),
      ...sceneAudios.map(a => a.id),
      ...panelAudios.map(a => a.id)
    ])
    
    // Stop audios that shouldn't be playing anymore (except story-level which loop)
    activeAudiosRef.current.forEach((activeAudio, audioId) => {
      // Keep story-level audios if they're looping
      if (!activeAudio.audio.scene_id && !activeAudio.audio.panel_id && activeAudio.audio.loop) {
        return
      }
      // Stop scene-level audios when scene changes
      if (activeAudio.audio.scene_id && activeAudio.audio.scene_id !== currentSceneId) {
        stopAudio(audioId, true)
        return
      }
      // Stop panel-level audios when panel changes
      if (activeAudio.audio.panel_id && (!currentPanel || activeAudio.audio.panel_id !== currentPanel.id)) {
        stopAudio(audioId, true)
        return
      }
    })
    
    // Start audios that should be playing
    shouldBePlaying.forEach(audioId => {
      const audioData = audios.find(a => a.id === audioId)
      if (audioData && !activeAudiosRef.current.has(audioId)) {
        startAudio(audioData)
      }
    })
  }, [audios, currentSceneId, currentPanel, startAudio, stopAudio])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeAudiosRef.current.forEach(activeAudio => {
        activeAudio.element.pause()
        activeAudio.element.src = ''
      })
      activeAudiosRef.current.clear()
    }
  }, [])

  // Measure viewport - with ResizeObserver for accurate sizing
  useEffect(() => {
    const measure = () => {
      if (viewRef.current) {
        const rect = viewRef.current.getBoundingClientRect()
        setViewSize({ w: rect.width, h: rect.height })
      }
    }
    
    const timer = setTimeout(measure, 50)
    
    let resizeObserver: ResizeObserver | null = null
    if (viewRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(measure)
      resizeObserver.observe(viewRef.current)
    }
    
    window.addEventListener('resize', measure)
    
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', measure)
      resizeObserver?.disconnect()
    }
  }, [isFullscreen, isLoading])

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

  // Auto-hide controls on mobile/tablet
  const resetControlsTimer = useCallback(() => {
    if (!isMobile && !isTablet) return
    
    setShowControls(true)
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    
    controlsTimeoutRef.current = setTimeout(() => {
      if (!showChoices && !storyEnded && !showLanguageMenu) {
        setShowControls(false)
      }
    }, 3000)
  }, [isMobile, isTablet, showChoices, storyEnded, showLanguageMenu])

  useEffect(() => {
    resetControlsTimer()
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [currentPanelIndex, currentSceneId, resetControlsTimer])

  // Smooth scene change helper
  const changeSceneSmoothly = useCallback((
    newSceneId: string, 
    newPanelIndex: number, 
    newRevealedPanels?: Set<number>
  ) => {
    setIsSceneTransitioning(true)
    
    // Wait for fade out, then change scene
    setTimeout(() => {
      setCurrentSceneId(newSceneId)
      setCurrentPanelIndex(newPanelIndex)
      if (newRevealedPanels) {
        setRevealedPanels(newRevealedPanels)
      } else {
        setRevealedPanels(new Set([0]))
      }
      
      // Wait a frame then fade in
      requestAnimationFrame(() => {
        setIsSceneTransitioning(false)
      })
    }, 150)
  }, [])

  // Navigation - Go Next
  const goNext = useCallback(() => {
    if (showChoices || storyEnded || isSceneTransitioning) return
    
    resetControlsTimer()
    
    if (isAtDecisionPoint) {
      setShowChoices(true)
      return
    }
    
    // Aynı sahne içinde sonraki panel
    if (currentPanelIndex < sortedPanels.length - 1) {
      const nextIndex = currentPanelIndex + 1
      setCurrentPanelIndex(nextIndex)
      // Panel-to-panel modda revealed panelleri güncelle
      setRevealedPanels(prev => new Set([...prev, nextIndex]))
      return
    }
    
    // Son paneldeyiz
    if (isAtLastPanel) {
      if (isEndingScene) {
        setStoryEnded(true)
        return
      }
      
      // Sonraki sahneye geç
      if (normalFlowConnection) {
        setHistory(prev => [...prev, { 
          sceneId: currentSceneId, 
          panelIndex: currentPanelIndex,
          revealedPanels: new Set(revealedPanels)
        }])
        
        changeSceneSmoothly(normalFlowConnection.to_scene_id, 0)
        return
      }
    }
  }, [currentPanelIndex, sortedPanels.length, isAtDecisionPoint, isAtLastPanel, isEndingScene, normalFlowConnection, showChoices, storyEnded, currentSceneId, revealedPanels, resetControlsTimer, isSceneTransitioning, changeSceneSmoothly])

  const handleChoice = useCallback((choice: Choice) => {
    setHistory(prev => [...prev, { 
      sceneId: currentSceneId, 
      panelIndex: currentPanelIndex,
      revealedPanels: new Set(revealedPanels)
    }])
    setShowChoices(false)
    setStoryEnded(false)
    
    changeSceneSmoothly(choice.to_scene_id, 0)
  }, [currentSceneId, currentPanelIndex, revealedPanels, changeSceneSmoothly])

  // Mouse move handler (desktop only)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isTouchDevice || showChoices || storyEnded) {
      setHoverSide(null)
      return
    }
    
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const relX = x / rect.width
    
    setMousePos({ x: e.clientX, y: e.clientY })
    
    // Sadece sağ taraf için hover göster (ileri git)
    if (relX > 0.7) {
      setHoverSide('right')
    } else {
      setHoverSide(null)
    }
  }, [showChoices, storyEnded, isTouchDevice])

  // Click handler
  const handleViewClick = useCallback((e: React.MouseEvent) => {
    // Dokunma olayı zaten işlendi, click'i atla (mobilde çift tetiklemeyi önle)
    if (touchHandled.current) {
      touchHandled.current = false
      return
    }
    
    if (showChoices || storyEnded) return
    if (showLanguageMenu) {
      setShowLanguageMenu(false)
      return
    }
    
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const relX = x / rect.width
    
    if (relX > 0.7) {
      goNext()
    } else if (relX > 0.3) {
      // Orta alan - mobilde kontrolleri aç/kapa, masaüstünde ileri git
      if (isMobile || isTablet) {
        setShowControls(prev => !prev)
        resetControlsTimer()
      } else {
        goNext()
      }
    } else {
      // Sol alan - sadece kontrolleri aç/kapa
      setShowControls(prev => !prev)
      resetControlsTimer()
    }
  }, [showChoices, storyEnded, showLanguageMenu, goNext, isMobile, isTablet, resetControlsTimer])

  // Touch handlers for mobile
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const touchHandled = useRef<boolean>(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    touchHandled.current = false
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    if (showChoices || storyEnded) return
    
    const touchEndX = e.changedTouches[0].clientX
    const touchEndY = e.changedTouches[0].clientY
    const deltaX = touchEndX - touchStartX.current
    const deltaY = touchEndY - touchStartY.current
    
    // Minimum swipe distance - adjusted for screen size
    const minSwipeDistance = isMobile ? 40 : 60
    
    // Horizontal swipe check - sadece sola kaydırma (ileri git)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      touchHandled.current = true
      if (deltaX < 0) {
        // Swipe left - go next
        goNext()
      }
      // Sağa kaydırma (geri) devre dışı
    } else if (Math.abs(deltaX) < 15 && Math.abs(deltaY) < 15) {
      // Tap - determine action based on tap position
      touchHandled.current = true
      const rect = e.currentTarget.getBoundingClientRect()
      const tapX = touchEndX - rect.left
      const relX = tapX / rect.width
      
      if (relX > 0.75) {
        goNext()
      } else {
        // Sol ve orta alan - kontrolleri aç/kapa
        setShowControls(prev => !prev)
        resetControlsTimer()
      }
    }
    
    touchStartX.current = null
    touchStartY.current = null
  }, [showChoices, storyEnded, goNext, isMobile, resetControlsTimer])

  // Keyboard navigation - sadece ileri (geri devre dışı)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        if (!showChoices && !storyEnded) goNext()
      }
      // ArrowLeft (geri) devre dışı
      if (e.key === 'Escape') {
        if (showLanguageMenu) {
          setShowLanguageMenu(false)
        } else if (showChoices) {
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
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        setReadingMode(prev => prev === 'focus' ? 'panel-to-panel' : 'focus')
      }
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        setShowLanguageMenu(prev => !prev)
      }
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        setIsMuted(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, showChoices, storyEnded, toggleFullscreen, router, showLanguageMenu])

  // Loading screen
  if (isLoading || !isCurrentImageLoaded) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center safe-area-top safe-area-bottom">
        <Loader2 size={isMobile ? 40 : 48} className="text-white/60 animate-spin mb-4" />
        <p className="text-white/60 text-sm px-4 text-center">Hikaye yükleniyor...</p>
        <div className="mt-4 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-orange-500 transition-all duration-300"
            style={{ width: `${(loadedImages.size / allImageUrls.length) * 100}%` }}
          />
        </div>
        <p className="text-white/30 text-xs mt-2">
          {loadedImages.size} / {allImageUrls.length} görsel
        </p>
      </div>
    )
  }

  if (!currentScene || !currentPanel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4 safe-area-top safe-area-bottom">
        <div className="text-center max-w-sm">
          <p className="mb-4">Bu hikayede henüz sahne yok.</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-white text-gray-900 rounded-xl font-medium hover:bg-gray-100 active:scale-95 transition-all"
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
    return `inset(${panel.y}px ${currentScene.image_width - panel.x - panel.width}px ${currentScene.image_height - panel.y - panel.height}px ${panel.x}px)`
  }

  // Responsive padding based on screen size
  const getPadding = () => {
    if (screenSize === 'xs') return 12
    if (screenSize === 'sm') return 20
    if (screenSize === 'md') return 40
    return 60
  }
  
  const padding = getPadding()
  
  // Split screen hesaplaması - karar sahnesi için (minimal)
  const choiceButtonHeight = isMobile ? 44 : 48 // Her butonun yüksekliği (kompakt)
  const choiceSpacing = isMobile ? 6 : 8 // Butonlar arası boşluk (minimal)
  const choicePadding = isMobile ? 8 : 12 // Üst/alt padding (minimal)
  const choiceCount = sceneChoices.length
  const choiceAreaHeight = showChoices && choiceCount > 0 
    ? (choiceButtonHeight * choiceCount) + (choiceSpacing * (choiceCount - 1)) + (choicePadding * 2)
    : 0
  
  // Görsel için kullanılabilir alan - viewSize zaten viewport'un ölçülmüş boyutu
  // bottom offset uygulandığında ResizeObserver yeni boyutu ölçecek
  const effectiveViewHeight = viewSize.h
  
  // Calculate transform for focus mode
  const scaleX = (viewSize.w - padding * 2) / currentPanel.width
  const scaleY = (effectiveViewHeight - padding * 2) / currentPanel.height
  const maxScale = isMobile ? 5 : isTablet ? 4 : 3
  const focusScale = Math.min(scaleX, scaleY, maxScale)
  const panelCenterX = currentPanel.x + currentPanel.width / 2
  const panelCenterY = currentPanel.y + currentPanel.height / 2
  const focusTranslateX = viewSize.w / 2 - panelCenterX * focusScale
  const focusTranslateY = effectiveViewHeight / 2 - panelCenterY * focusScale

  // Calculate transform for panel-to-panel mode
  // Panel-to-panel: TÜM SAYFA SABİT - sadece overlay animasyonu
  const p2pPadding = isMobile ? 8 : isTablet ? 16 : 24
  const p2pScaleX = (viewSize.w - p2pPadding * 2) / currentScene.image_width
  const p2pScaleY = (effectiveViewHeight - p2pPadding * 2) / currentScene.image_height
  const p2pScale = Math.min(p2pScaleX, p2pScaleY, 1) // Max 1x, tüm görüntüyü sığdır
  
  // Görüntüyü merkeze al (SABİT - panele göre değişmez)
  const p2pTranslateX = (viewSize.w - currentScene.image_width * p2pScale) / 2
  const p2pTranslateY = (effectiveViewHeight - currentScene.image_height * p2pScale) / 2

  const currentClipPath = generateClipPath(currentPanel)

  // Panel text overlay'leri
  const currentPanelTexts = currentPanel.texts || []

  // Icon sizes based on screen
  const iconSize = isMobile ? 18 : 20
  const smallIconSize = isMobile ? 14 : 16

  return (
    <div 
      ref={containerRef}
      className="reader-container flex flex-col"
    >
      {/* Top left - Mode toggle buttons */}
      <div 
        className={`absolute z-50 flex items-center gap-1 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
        style={{
          top: isMobile ? 12 : 16,
          left: isMobile ? 12 : 16,
        }}
      >
        <button 
          onClick={() => setReadingMode('focus')}
          className={`p-2 sm:p-2.5 rounded-full transition-all active:scale-90 ${
            readingMode === 'focus' 
              ? 'bg-orange-500/20 text-orange-500' 
              : 'glass-dark text-white/60 hover:text-white'
          }`}
          title="Focus Mode (M)"
        >
          <FocusModeIcon active={readingMode === 'focus'} size={iconSize} />
        </button>
        <button 
          onClick={() => setReadingMode('panel-to-panel')}
          className={`p-2 sm:p-2.5 rounded-full transition-all active:scale-90 ${
            readingMode === 'panel-to-panel' 
              ? 'bg-orange-500/20 text-orange-500' 
              : 'glass-dark text-white/60 hover:text-white'
          }`}
          title="Panel-to-Panel Mode (M)"
        >
          <PanelToPanelIcon active={readingMode === 'panel-to-panel'} size={iconSize} />
        </button>
      </div>

      {/* Top right controls */}
      <div 
        className={`absolute z-50 flex items-center gap-1 sm:gap-2 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
        style={{
          top: isMobile ? 12 : 16,
          right: isMobile ? 12 : 16,
        }}
      >
        {/* Language Button - with dropdown - always visible */}
        {availableLanguages.length >= 1 && (
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowLanguageMenu(!showLanguageMenu) }}
              className={`p-2 sm:p-2.5 ${showLanguageMenu ? 'text-orange-400' : 'text-white/60'} hover:text-white glass-dark rounded-full active:scale-90 transition-all flex items-center gap-1`}
              title="Dil değiştir (L)"
            >
              <Globe size={iconSize} />
              <span className="text-[10px] font-bold">{currentLanguage.toLocaleUpperCase('tr-TR')}</span>
            </button>
            
            {showLanguageMenu && (
              <div 
                className="absolute right-0 top-full mt-2 glass-dark rounded-xl overflow-hidden min-w-[140px] z-50"
                onClick={(e) => e.stopPropagation()}
              >
                {availableLanguages.map(lang => (
                  <button
                    key={lang}
                    onClick={() => { setCurrentLanguage(lang); setShowLanguageMenu(false) }}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-colors ${
                      currentLanguage === lang 
                        ? 'bg-orange-500/30 text-orange-400' 
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <span>{LANGUAGE_NAMES[lang] || lang}</span>
                    {currentLanguage === lang && <span className="text-orange-400">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audio Controls - Vertical Volume Slider */}
        {audios && audios.length > 0 && (
          <div className="relative group">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2 sm:p-2.5 ${isMuted ? 'text-red-400' : 'text-white/60'} hover:text-white glass-dark rounded-full active:scale-90 transition-all`}
              title={isMuted ? 'Sesi aç (S)' : 'Sesi kapat (S)'}
            >
              {isMuted ? <VolumeX size={iconSize} /> : <Volume2 size={iconSize} />}
            </button>
            
            {/* Vertical Volume Slider */}
            <div 
              className="absolute right-1/2 translate-x-1/2 top-full mt-2 glass-dark rounded-xl p-2.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center gap-1.5">
                <Volume2 size={12} className="text-gray-400" />
                
                {/* Vertical slider track */}
                <div 
                  className="relative h-24 w-1.5 bg-gray-700 rounded-full cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const y = e.clientY - rect.top
                    const percentage = 1 - (y / rect.height)
                    const newVolume = Math.max(0, Math.min(1, percentage))
                    setMasterVolume(newVolume)
                    if (newVolume > 0) setIsMuted(false)
                  }}
                >
                  {/* Fill */}
                  <div 
                    className="absolute bottom-0 left-0 right-0 bg-orange-500 rounded-full transition-all duration-100"
                    style={{ height: `${isMuted ? 0 : masterVolume * 100}%` }}
                  />
                  {/* Thumb */}
                  <div 
                    className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-md transition-all duration-100"
                    style={{ bottom: `calc(${isMuted ? 0 : masterVolume * 100}% - 6px)` }}
                  />
                </div>
                
                <VolumeX size={12} className="text-gray-400" />
                <div className="text-[10px] text-gray-400 font-medium">
                  {isMuted ? 'Sessiz' : `${Math.round(masterVolume * 100)}%`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fullscreen button - only on supported devices */}
        {document.fullscreenEnabled && !isMobile && (
          <button 
            onClick={toggleFullscreen}
            className="p-2 sm:p-2.5 text-white/60 hover:text-white glass-dark rounded-full active:scale-90 transition-all"
            title={isFullscreen ? 'Tam ekrandan çık (F)' : 'Tam ekran (F)'}
          >
            {isFullscreen ? <Minimize size={iconSize} /> : <Maximize size={iconSize} />}
          </button>
        )}
        
        <button 
          onClick={() => router.push('/')}
          className="p-2 sm:p-2.5 text-white/60 hover:text-white glass-dark rounded-full active:scale-90 transition-all"
          title="Çıkış"
        >
          <X size={iconSize} />
        </button>
      </div>

      {/* Viewport - Split screen when choices shown */}
      <div 
        ref={viewRef}
        className="absolute inset-0 overflow-hidden transition-all duration-300 ease-out"
        style={{ 
          bottom: showChoices && sceneChoices.length > 0 ? choiceAreaHeight : 0,
          cursor: hoverSide && !isTouchDevice ? 'none' : 'default' 
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverSide(null)}
        onClick={handleViewClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
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
              transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-out',
              willChange: 'transform, opacity',
              opacity: isSceneTransitioning ? 0 : 1
            }}
          >
            {/* Dimmed background image */}
            <img
              src={currentScene.image_url}
              alt=""
              loading="eager"
              decoding="async"
              className="reader-image"
              style={{ 
                width: currentScene.image_width, 
                height: currentScene.image_height, 
                opacity: 0.12,
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
              className="reader-image animate-fadeIn"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: currentScene.image_width,
                height: currentScene.image_height,
                clipPath: currentClipPath,
              }}
              draggable={false}
            />
            
            {/* Text Overlays - key includes language for smooth transition */}
            <TextOverlayRenderer 
              key={`texts-focus-${currentLanguage}`}
              texts={currentPanelTexts}
              language={currentLanguage}
              scale={1}
              imageWidth={currentScene.image_width}
              imageHeight={currentScene.image_height}
            />
          </div>
        )}

        {/* PANEL-TO-PANEL MODE - Tüm sayfa sabit, sadece overlay animasyonu */}
        {readingMode === 'panel-to-panel' && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: `translate(${p2pTranslateX}px, ${p2pTranslateY}px) scale(${p2pScale})`,
              transformOrigin: '0 0',
              transition: 'opacity 0.2s ease-out', // Sadece sahne geçişi için opacity
              opacity: isSceneTransitioning ? 0 : 1
            }}
          >
            {/* Full image */}
            <img
              src={currentScene.image_url}
              alt=""
              loading="eager"
              decoding="async"
              className="reader-image"
              style={{ 
                width: currentScene.image_width, 
                height: currentScene.image_height,
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
                    transition: 'opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
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
                transition: 'clip-path 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            />
            
            {/* Text Overlays for revealed panels */}
            {sortedPanels.map((panel, index) => {
              if (!revealedPanels.has(index)) return null
              const panelTexts = panel.texts || []
              
              return (
                <TextOverlayRenderer 
                  key={`texts-${panel.id}-${currentLanguage}`}
                  texts={panelTexts}
                  language={currentLanguage}
                  scale={1}
                  imageWidth={currentScene.image_width}
                  imageHeight={currentScene.image_height}
                />
              )
            })}
          </div>
        )}

        {/* Custom cursor - Navigation buttons (desktop only) */}
        {hoverSide && !showChoices && !storyEnded && !isTouchDevice && (
          <div
            className="pointer-events-none fixed z-[100]"
            style={{
              left: mousePos.x,
              top: mousePos.y,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div 
              className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg transition-all opacity-100"
            >
              <ChevronRight size={24} className="text-gray-800" />
            </div>
          </div>
        )}

        {/* Mobile/Tablet navigation buttons */}
      </div>

      {/* Choice buttons area - Fixed bottom section */}
      {showChoices && sceneChoices.length > 0 && (
        <div 
          className="absolute left-0 right-0 bottom-0 z-40 bg-black animate-slideInFromBottom"
          style={{ height: choiceAreaHeight }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Subtle top border */}
          <div className="absolute top-0 left-0 right-0 h-px bg-white/10" />
          
          <div 
            className="h-full flex flex-col justify-center"
          >
            <div 
              className="mx-auto" 
              style={{ 
                gap: isMobile ? 6 : 8, 
                display: 'flex', 
                flexDirection: 'column',
                width: currentScene.image_width * p2pScale,
                maxWidth: 'calc(100% - 16px)'
              }}
            >
              {sceneChoices.map((choice, index) => {
                const colors = [
                  { bg: '#ee5454', border: '#c43c3c', text: '#fff' },
                  { bg: '#4c69f6', border: '#3a54d4', text: '#fff' },
                  { bg: '#f6db35', border: '#d4bc20', text: '#1a1a1a' },
                  { bg: '#22c55e', border: '#1a9d4a', text: '#fff' },
                  { bg: '#a855f7', border: '#8b3fd4', text: '#fff' },
                ]
                const colorSet = colors[index % colors.length]
                
                return (
                  <button
                    key={choice.id}
                    onClick={(e) => { e.stopPropagation(); handleChoice(choice) }}
                    className="w-full text-left cursor-pointer animate-fadeInUp transition-all duration-150 hover:scale-[1.015] hover:brightness-110 active:scale-[0.985]"
                    style={{ 
                      animationDelay: `${index * 60}ms`,
                      animationFillMode: 'backwards',
                      backgroundColor: colorSet.bg,
                      border: `2px solid ${colorSet.border}`,
                      borderRadius: '8px',
                      height: isMobile ? 44 : 48
                    }}
                  >
                    <div className="flex items-center gap-2.5 px-3 sm:px-4 h-full">
                      {/* Number badge */}
                      <div 
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-black/20 rounded-full"
                      >
                        <span 
                          className="font-black text-xs"
                          style={{ 
                            fontFamily: "'Bangers', cursive",
                            color: colorSet.text
                          }}
                        >
                          {index + 1}
                        </span>
                      </div>
                      
                      {/* Choice text - Türkçe uyumlu */}
                      <span 
                        className="font-semibold text-sm tracking-wide flex-1 line-clamp-1"
                        style={{ 
                          color: colorSet.text,
                          fontFamily: "'Comic Neue', 'Comic Sans MS', cursive"
                        }}
                      >
                        {choice.choice_text?.toLocaleUpperCase('tr-TR')}
                      </span>
                      
                      {/* Arrow */}
                      <div 
                        className="flex-shrink-0"
                        style={{ color: colorSet.text }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Story ended overlay - Comic Style */}
      {storyEnded && (
        <div 
          className="absolute inset-0 flex flex-col justify-center items-center animate-fadeIn overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
            {/* Comic halftone background */}
            <div 
              className="absolute inset-0 bg-black/90"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
                backgroundSize: '8px 8px'
              }}
            />
            
            {/* Celebration burst */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute h-[150%] w-1.5 bg-gradient-to-t from-transparent via-yellow-400/15 to-transparent"
                  style={{
                    transform: `rotate(${i * 30}deg)`,
                    animation: 'pulse 2.5s ease-in-out infinite',
                    animationDelay: `${i * 0.15}s`
                  }}
                />
              ))}
            </div>
            
            <div className="relative z-10 max-w-lg mx-auto px-4 text-center">
              {/* Comic sound effect title */}
              <div className="mb-6 sm:mb-8 animate-bounceIn">
                <span 
                  className="inline-block text-5xl sm:text-7xl font-black italic tracking-tight select-none"
                  style={{ 
                    fontFamily: "'Bangers', 'Comic Sans MS', cursive",
                    color: '#f6db35',
                    WebkitTextStroke: '2px black',
                    textShadow: '4px 4px 0px #000, 6px 6px 0px rgba(0,0,0,0.3)',
                    transform: 'rotate(-2deg)'
                  }}
                >
                  THE END!
                </span>
              </div>
              
              <p 
                className="text-white/80 text-lg sm:text-xl mb-8 animate-fadeInUp"
                style={{ 
                  fontFamily: "'Comic Neue', cursive",
                  animationDelay: '200ms'
                }}
              >
                Bu hikayenin sonuna ulaştın! 🎉
              </p>
              
              {/* Action buttons - Enhanced Comic style */}
              <div className="flex flex-col sm:flex-row gap-5 justify-center animate-fadeInUp" style={{ animationDelay: '400ms' }}>
                <button
                  onClick={(e) => { 
                    e.stopPropagation()
                    setStoryEnded(false)
                    setHistory([])
                    changeSceneSmoothly(startScene?.id || '', 0, new Set([0]))
                  }}
                  className="group relative cursor-pointer"
                  style={{ transform: 'rotate(-1deg)' }}
                >
                  {/* Multiple shadow layers */}
                  <div className="absolute inset-0 bg-black/40 translate-x-3 translate-y-3 blur-[2px]" />
                  <div className="absolute inset-0 bg-black translate-x-2 translate-y-2 transition-transform duration-150 group-hover:translate-x-1 group-hover:translate-y-1 group-active:translate-x-0 group-active:translate-y-0" />
                  
                  <div 
                    className="relative px-8 py-4 overflow-hidden transition-transform duration-150 group-hover:scale-[1.03] group-active:scale-[0.97]"
                    style={{ 
                      backgroundColor: '#4c69f6',
                      border: '4px solid #2a4ad4',
                      boxShadow: 'inset 0 -4px 0 #2a4ad4, inset 0 4px 0 #7b92ff'
                    }}
                  >
                    {/* Inner glow */}
                    <div 
                      className="absolute inset-0 opacity-30"
                      style={{ background: 'linear-gradient(135deg, #7b92ff 0%, transparent 50%)' }}
                    />
                    <span 
                      className="relative text-white font-black text-lg sm:text-xl tracking-wider"
                      style={{ 
                        fontFamily: "'Bangers', cursive",
                        textShadow: '2px 2px 0px rgba(0,0,0,0.4)'
                      }}
                    >
                      🔄 BAŞTAN OKU
                    </span>
                    {/* Corner fold */}
                    <div className="absolute bottom-0 right-0 w-6 h-6" style={{ background: 'linear-gradient(135deg, transparent 50%, #2a4ad4 50%)' }} />
                  </div>
                </button>
                
                <button
                  onClick={(e) => { e.stopPropagation(); router.push('/') }}
                  className="group relative cursor-pointer"
                  style={{ transform: 'rotate(1deg)' }}
                >
                  {/* Multiple shadow layers */}
                  <div className="absolute inset-0 bg-black/40 translate-x-3 translate-y-3 blur-[2px]" />
                  <div className="absolute inset-0 bg-black translate-x-2 translate-y-2 transition-transform duration-150 group-hover:translate-x-1 group-hover:translate-y-1 group-active:translate-x-0 group-active:translate-y-0" />
                  
                  <div 
                    className="relative px-8 py-4 bg-white overflow-hidden transition-transform duration-150 group-hover:scale-[1.03] group-active:scale-[0.97]"
                    style={{ 
                      border: '4px solid #1a1a1a',
                      boxShadow: 'inset 0 -4px 0 #d4d4d4, inset 0 4px 0 #ffffff'
                    }}
                  >
                    {/* Inner glow */}
                    <div 
                      className="absolute inset-0 opacity-30"
                      style={{ background: 'linear-gradient(135deg, #fff 0%, transparent 50%)' }}
                    />
                    <span 
                      className="relative text-black font-black text-lg sm:text-xl tracking-wider"
                      style={{ 
                        fontFamily: "'Bangers', cursive",
                        textShadow: '1px 1px 0px rgba(255,255,255,0.5)'
                      }}
                    >
                      🏠 ANA SAYFA
                    </span>
                    {/* Corner fold */}
                    <div className="absolute bottom-0 right-0 w-6 h-6" style={{ background: 'linear-gradient(135deg, transparent 50%, #1a1a1a 50%)' }} />
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Home button */}
      <button 
        onClick={(e) => { e.stopPropagation(); router.push('/') }}
        className={`absolute z-40 p-2 text-white/30 hover:text-white/60 transition-all ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={{
          bottom: isMobile ? 16 : 24,
          left: isMobile ? 16 : 24,
        }}
        title="Ana Sayfa"
      >
        <Home size={smallIconSize} />
      </button>

    </div>
  )
}
