'use client'

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { 
  X, 
  Trash2,
  Upload,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Repeat,
  Music,
  Mic,
  Wind,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Layers,
  Image as ImageIcon,
  Plus,
  FolderOpen,
  Settings,
  Clock
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { StoryAudio, AudioType, Scene, Panel } from '@/types/database'

// ============================================================================
// TYPES
// ============================================================================

interface LocalAudio extends StoryAudio {
  isNew?: boolean
  isPlaying?: boolean
}

interface AudioManagerProps {
  storyId: string
  scenes: (Scene & { panels: Panel[] })[]
  onClose: () => void
}

type ViewMode = 'story' | 'scene' | 'panel'

// ============================================================================
// CONSTANTS
// ============================================================================

const AUDIO_TYPES: { type: AudioType; icon: React.ElementType; label: string; color: string }[] = [
  { type: 'background', icon: Music, label: 'Müzik', color: 'bg-purple-500' },
  { type: 'sfx', icon: Sparkles, label: 'Efekt', color: 'bg-yellow-500' },
  { type: 'voice', icon: Mic, label: 'Ses', color: 'bg-blue-500' },
  { type: 'ambient', icon: Wind, label: 'Ortam', color: 'bg-green-500' },
]

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

// ============================================================================
// WAVEFORM VOLUME SLIDER COMPONENT
// ============================================================================

interface WaveformVolumeSliderProps {
  value: number // 0-1 arası
  onChange: (value: number) => void
  barCount?: number
  className?: string
  showPercentage?: boolean
  accentColor?: string
}

function WaveformVolumeSlider({ 
  value, 
  onChange, 
  barCount = 24, 
  className = '',
  showPercentage = true,
  accentColor = 'bg-blue-500'
}: WaveformVolumeSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  
  // Tüm barlar eşit yükseklikte
  const barHeights = useMemo(() => {
    return Array(barCount).fill(1)
  }, [barCount])
  
  const calculateValueFromPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return value
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    // Max volume 2.0 (200%)
    return percentage * 2
  }, [value])
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    const newValue = calculateValueFromPosition(e.clientX)
    onChange(newValue)
  }, [calculateValueFromPosition, onChange])
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    
    const newValue = calculateValueFromPosition(e.clientX)
    setHoverValue(newValue)
    
    if (isDragging) {
      onChange(newValue)
    }
  }, [isDragging, calculateValueFromPosition, onChange])
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])
  
  const handleMouseLeave = useCallback(() => {
    setHoverValue(null)
    if (isDragging) {
      setIsDragging(false)
    }
  }, [isDragging])
  
  // Global mouse up listener
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false)
      window.addEventListener('mouseup', handleGlobalMouseUp)
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDragging])
  
  // 100% işareti konumu (0-2 aralığında 1 = 50% pozisyon)
  const hundredPercentPosition = 50 // %
  
  // Aktif bar sayısı (value 0-2 aralığında, görsel 0-100% pozisyon)
  const activePosition = (value / 2) * 100
  const displayValue = hoverValue !== null ? hoverValue : value

  return (
    <div className={`${className}`}>
      {showPercentage && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-400">Ses Seviyesi</span>
          <span className={`text-sm font-bold ${value > 1 ? 'text-orange-400' : 'text-blue-400'}`}>
            {Math.round(displayValue * 100)}%
          </span>
        </div>
      )}
      
      <div 
        ref={containerRef}
        className="relative h-12 flex items-end gap-[2px] cursor-pointer select-none rounded-lg bg-gray-900/50 px-2 py-2"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* 100% işareti - tıklanabilir */}
        <div 
          className="absolute top-0 bottom-0 w-[2px] bg-gray-600 z-10 cursor-pointer hover:bg-blue-500 transition-colors"
          style={{ left: `${hundredPercentPosition}%` }}
          onClick={(e) => { e.stopPropagation(); onChange(1) }}
          title="100% olarak ayarla"
        >
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-gray-400 hover:text-blue-400 cursor-pointer font-medium">100%</span>
        </div>
        
        {/* Barlar */}
        {barHeights.map((heightRatio, index) => {
          const barPosition = ((index + 0.5) / barCount) * 100
          const isActive = barPosition <= activePosition
          const isHovered = hoverValue !== null && barPosition <= (hoverValue / 2) * 100
          const isOverHundred = barPosition > hundredPercentPosition
          
          return (
            <div
              key={index}
              className={`flex-1 rounded-sm transition-all duration-75 ${
                isActive 
                  ? isOverHundred 
                    ? 'bg-orange-500' 
                    : accentColor
                  : isHovered
                    ? 'bg-gray-500'
                    : 'bg-gray-700'
              }`}
              style={{
                height: `${heightRatio * 100}%`,
                opacity: isActive ? 1 : isHovered ? 0.6 : 0.4
              }}
            />
          )
        })}
        
        {/* Hover değer göstergesi */}
        {hoverValue !== null && !isDragging && (
          <div 
            className="absolute -top-6 px-1.5 py-0.5 bg-gray-800 rounded text-[10px] text-white pointer-events-none whitespace-nowrap"
            style={{ left: `${(hoverValue / 2) * 100}%`, transform: 'translateX(-50%)' }}
          >
            {Math.round(hoverValue * 100)}%
          </div>
        )}
      </div>
      
      {/* Quick preset buttons */}
      <div className="flex justify-between items-center mt-2 gap-1">
        <button 
          onClick={() => onChange(0)}
          className={`flex-1 text-[10px] py-1 rounded transition-colors font-medium ${
            value === 0 ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-red-400 hover:bg-gray-800'
          }`}
          title="Sesi kapat"
        >
          0%
        </button>
        <button 
          onClick={() => onChange(0.5)}
          className={`flex-1 text-[10px] py-1 rounded transition-colors font-medium ${
            value === 0.5 ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-blue-400 hover:bg-gray-800'
          }`}
          title="Yarı ses"
        >
          50%
        </button>
        <button 
          onClick={() => onChange(1)}
          className={`flex-1 text-[10px] py-1 rounded transition-colors font-medium ${
            value === 1 ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-blue-400 hover:bg-gray-800'
          }`}
          title="Normal ses"
        >
          100%
        </button>
        <button 
          onClick={() => onChange(1.5)}
          className={`flex-1 text-[10px] py-1 rounded transition-colors font-medium ${
            value === 1.5 ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-orange-400 hover:bg-gray-800'
          }`}
          title="Yüksek ses"
        >
          150%
        </button>
        <button 
          onClick={() => onChange(2)}
          className={`flex-1 text-[10px] py-1 rounded transition-colors font-medium ${
            value === 2 ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-orange-400 hover:bg-gray-800'
          }`}
          title="Maksimum ses"
        >
          200%
        </button>
      </div>
    </div>
  )
}

const generateId = (): string => `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AudioManager({ storyId, scenes, onClose }: AudioManagerProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // All audios (library)
  const [audios, setAudios] = useState<LocalAudio[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // Selected audio for editing
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null)
  
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('scene')
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0)
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0)
  
  // Show library picker
  const [showLibraryPicker, setShowLibraryPicker] = useState(false)
  
  // ========== AUDIO PLAYER SYSTEM (REF-BASED) ==========
  // Audio elements are stored in a ref Map, not in state
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  
  // Sorted scenes
  const sortedScenes = useMemo(() => 
    [...scenes].sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
  , [scenes])
  
  const currentScene = sortedScenes[currentSceneIndex]
  const sortedPanels = useMemo(() => 
    currentScene?.panels?.sort((a, b) => a.order_index - b.order_index) || []
  , [currentScene])
  const currentPanel = sortedPanels[currentPanelIndex]
  
  const selectedAudio = audios.find(a => a.id === selectedAudioId)

  // Load audios from database
  useEffect(() => {
    const loadAudios = async () => {
      try {
        const { data, error } = await supabase
          .from('story_audio')
          .select('*')
          .eq('story_id', storyId)
          .order('order_index')

        if (error) throw error

        if (data) {
          setAudios(data.map(a => ({
            ...a,
            volume: Number(a.volume),
            start_delay_ms: Number(a.start_delay_ms) || 0,
            fade_in_ms: Number(a.fade_in_ms) || 0,
            fade_out_ms: Number(a.fade_out_ms) || 0,
            isNew: false,
            isPlaying: false
          })))
        }
      } catch (err) {
        console.error('Error loading audios:', err)
        setErrorMessage('Sesler yüklenirken hata oluştu')
      } finally {
        setLoading(false)
      }
    }

    loadAudios()
  }, [storyId, supabase])

  // Cleanup audio elements on unmount
  useEffect(() => {
    const elementsMap = audioElementsRef.current
    return () => {
      elementsMap.forEach((el) => {
        el.pause()
        el.src = ''
      })
      elementsMap.clear()
    }
  }, [])

  // Get audios for current context
  const storyLevelAudios = useMemo(() => 
    audios.filter(a => !a.scene_id && !a.panel_id)
  , [audios])
  
  const sceneLevelAudios = useMemo(() => 
    currentScene ? audios.filter(a => a.scene_id === currentScene.id && !a.panel_id) : []
  , [audios, currentScene])
  
  const panelLevelAudios = useMemo(() => 
    currentPanel ? audios.filter(a => a.panel_id === currentPanel.id) : []
  , [audios, currentPanel])

  // All audios visible in current context (for panel view, show story + scene + panel audios)
  const contextAudios = useMemo(() => {
    if (viewMode === 'story') return storyLevelAudios
    if (viewMode === 'scene') return [...storyLevelAudios, ...sceneLevelAudios]
    return [...storyLevelAudios, ...sceneLevelAudios, ...panelLevelAudios]
  }, [viewMode, storyLevelAudios, sceneLevelAudios, panelLevelAudios])

  // Library audios (all unique audios by URL - for reuse)
  const libraryAudios = useMemo(() => {
    const seen = new Set<string>()
    return audios.filter(a => {
      if (seen.has(a.audio_url)) return false
      seen.add(a.audio_url)
      return true
    })
  }, [audios])

  // Get or create audio element from ref
  const getAudioElement = useCallback((audio: LocalAudio): HTMLAudioElement => {
    let el = audioElementsRef.current.get(audio.id)
    if (!el) {
      el = new Audio(audio.audio_url)
      el.loop = audio.loop
      el.volume = Math.max(0, Math.min(1, audio.volume))
      
      el.onended = () => {
        if (!audio.loop) {
          setPlayingAudioId(null)
        }
      }
      
      audioElementsRef.current.set(audio.id, el)
    }
    return el
  }, [])

  // Stop all playing audio
  const stopAllAudio = useCallback(() => {
    audioElementsRef.current.forEach((el) => {
      el.pause()
      el.currentTime = 0
    })
    setPlayingAudioId(null)
  }, [])

  // Toggle play/pause - CLEAN VERSION
  const togglePlay = useCallback((audioId: string) => {
    const audio = audios.find(a => a.id === audioId)
    if (!audio) return

    // If this audio is currently playing, pause it
    if (playingAudioId === audioId) {
      const el = audioElementsRef.current.get(audioId)
      if (el) {
        el.pause()
      }
      setPlayingAudioId(null)
      return
    }

    // Stop any currently playing audio first
    if (playingAudioId) {
      const currentEl = audioElementsRef.current.get(playingAudioId)
      if (currentEl) {
        currentEl.pause()
        currentEl.currentTime = 0
      }
    }

    // Play the new audio
    const el = getAudioElement(audio)
    const appliedVolume = Math.max(0, Math.min(1, audio.volume))
    el.volume = appliedVolume
    el.loop = audio.loop
    el.currentTime = 0
    
    console.log(`[AudioManager] Playing: ${audio.audio_name}, saved: ${audio.volume} (${Math.round(audio.volume * 100)}%), applied: ${appliedVolume}`)
    
    el.play()
      .then(() => {
        setPlayingAudioId(audioId)
      })
      .catch(err => {
        console.warn('Play failed:', err)
        setPlayingAudioId(null)
      })
  }, [audios, playingAudioId, getAudioElement])

  // Update audio properties
  const updateAudio = useCallback((audioId: string, updates: Partial<LocalAudio>) => {
    // Update the audio element properties immediately (from ref)
    const el = audioElementsRef.current.get(audioId)
    if (el) {
      if (updates.volume !== undefined) {
        el.volume = Math.max(0, Math.min(1, updates.volume))
      }
      if (updates.loop !== undefined) {
        el.loop = updates.loop
      }
    }
    
    // Update state
    setAudios(prev => prev.map(audio => 
      audio.id === audioId ? { ...audio, ...updates } : audio
    ))
    setHasChanges(true)
    setSaveStatus('idle')
  }, [])

  // Delete audio
  const deleteAudio = useCallback(async (audioId: string) => {
    const audio = audios.find(a => a.id === audioId)
    if (!audio) return

    if (!confirm('Bu sesi silmek istediğinize emin misiniz?')) return

    // Stop and remove audio element from ref
    const el = audioElementsRef.current.get(audioId)
    if (el) {
      el.pause()
      el.src = ''
      audioElementsRef.current.delete(audioId)
    }
    
    if (playingAudioId === audioId) {
      setPlayingAudioId(null)
    }

    if (!audio.isNew) {
      try {
        const { error } = await supabase
          .from('story_audio')
          .delete()
          .eq('id', audioId)
        
        if (error) throw error
      } catch (err) {
        console.error('Delete error:', err)
        setErrorMessage('Silme hatası')
        return
      }
    }

    setAudios(prev => prev.filter(a => a.id !== audioId))
    if (selectedAudioId === audioId) setSelectedAudioId(null)
    setHasChanges(true)
  }, [audios, selectedAudioId, supabase])

  // Handle file upload to library
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('audio/')) {
      setErrorMessage('Lütfen bir ses dosyası seçin')
      return
    }

    setUploading(true)
    setErrorMessage(null)

    try {
      const audioUrl = URL.createObjectURL(file)
      const audioElement = new Audio(audioUrl)
      
      const duration = await new Promise<number>((resolve, reject) => {
        audioElement.addEventListener('loadedmetadata', () => {
          resolve(Math.round(audioElement.duration * 1000))
        })
        audioElement.addEventListener('error', reject)
      })

      const fileName = `${storyId}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('story-audio')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('story-audio')
        .getPublicUrl(fileName)

      // Determine scope based on current view
      let sceneId: string | null = null
      let panelId: string | null = null
      
      if (viewMode === 'scene' && currentScene) {
        sceneId = currentScene.id
      } else if (viewMode === 'panel' && currentPanel) {
        sceneId = currentScene?.id || null
        panelId = currentPanel.id
      }

      const newAudio: LocalAudio = {
        id: generateId(),
        story_id: storyId,
        scene_id: sceneId,
        panel_id: panelId,
        audio_url: publicUrl,
        audio_name: file.name.replace(/\.[^/.]+$/, ''),
        duration_ms: duration,
        file_size: file.size,
        volume: 1,
        loop: viewMode === 'story',
        autoplay: true,
        start_delay_ms: 0,
        fade_in_ms: 0,
        fade_out_ms: 0,
        audio_type: viewMode === 'story' ? 'background' : 'sfx',
        order_index: audios.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isNew: true,
        isPlaying: false
      }

      setAudios(prev => [...prev, newAudio])
      setSelectedAudioId(newAudio.id)
      setHasChanges(true)
      setSaveStatus('idle')

      URL.revokeObjectURL(audioUrl)
    } catch (err) {
      console.error('Upload error:', err)
      setErrorMessage('Yükleme hatası: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [storyId, supabase, viewMode, currentScene, currentPanel, audios.length])

  // Add audio from library to current context
  const addFromLibrary = useCallback((sourceAudio: LocalAudio) => {
    let sceneId: string | null = null
    let panelId: string | null = null
    
    if (viewMode === 'scene' && currentScene) {
      sceneId = currentScene.id
    } else if (viewMode === 'panel' && currentPanel) {
      sceneId = currentScene?.id || null
      panelId = currentPanel.id
    }

    const newAudio: LocalAudio = {
      ...sourceAudio,
      id: generateId(),
      scene_id: sceneId,
      panel_id: panelId,
      isNew: true,
      isPlaying: false
    }

    setAudios(prev => [...prev, newAudio])
    setSelectedAudioId(newAudio.id)
    setShowLibraryPicker(false)
    setHasChanges(true)
  }, [viewMode, currentScene, currentPanel])

  // Save all audios
  const saveAudios = useCallback(async () => {
    setSaving(true)
    setErrorMessage(null)

    try {
      for (const audio of audios) {
        const audioData = {
          story_id: storyId,
          scene_id: audio.scene_id,
          panel_id: audio.panel_id,
          audio_url: audio.audio_url,
          audio_name: audio.audio_name,
          duration_ms: audio.duration_ms,
          file_size: audio.file_size,
          volume: audio.volume,
          loop: audio.loop,
          autoplay: audio.autoplay,
          start_delay_ms: audio.start_delay_ms,
          fade_in_ms: audio.fade_in_ms,
          fade_out_ms: audio.fade_out_ms,
          audio_type: audio.audio_type,
          order_index: audio.order_index
        }

        if (audio.isNew) {
          const { data, error } = await supabase
            .from('story_audio')
            .insert(audioData)
            .select()
            .single()

          if (error) throw error
          if (data) {
            audio.id = data.id
            audio.isNew = false
          }
        } else {
          const { error } = await supabase
            .from('story_audio')
            .update(audioData)
            .eq('id', audio.id)

          if (error) throw error
        }
      }

      setAudios(prev => prev.map(a => ({ ...a, isNew: false })))
      setHasChanges(false)
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (err) {
      console.error('Save error:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Kaydetme hatası')
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }, [audios, storyId, supabase])

  // Navigation
  const goToPrevPanel = useCallback(() => {
    if (currentPanelIndex > 0) {
      setCurrentPanelIndex(i => i - 1)
      setSelectedAudioId(null)
    } else if (currentSceneIndex > 0) {
      const prevSceneIndex = currentSceneIndex - 1
      const prevScene = sortedScenes[prevSceneIndex]
      const prevPanels = prevScene?.panels?.sort((a, b) => a.order_index - b.order_index) || []
      setCurrentSceneIndex(prevSceneIndex)
      setCurrentPanelIndex(Math.max(0, prevPanels.length - 1))
      setSelectedAudioId(null)
    }
  }, [currentPanelIndex, currentSceneIndex, sortedScenes])

  const goToNextPanel = useCallback(() => {
    if (currentPanelIndex < sortedPanels.length - 1) {
      setCurrentPanelIndex(i => i + 1)
      setSelectedAudioId(null)
    } else if (currentSceneIndex < sortedScenes.length - 1) {
      setCurrentSceneIndex(i => i + 1)
      setCurrentPanelIndex(0)
      setSelectedAudioId(null)
    }
  }, [currentPanelIndex, sortedPanels.length, currentSceneIndex, sortedScenes.length])

  const goToPanel = useCallback((panelIndex: number) => {
    setCurrentPanelIndex(panelIndex)
    setSelectedAudioId(null)
  }, [])

  const goToScene = useCallback((sceneIndex: number) => {
    setCurrentSceneIndex(sceneIndex)
    setCurrentPanelIndex(0)
    setSelectedAudioId(null)
  }, [])

  // Calculate clip path for panel preview
  const getClipPath = useCallback(() => {
    if (!currentPanel || !currentScene) return undefined
    
    const panel = currentPanel
    if (panel.shape === 'polygon' && panel.points) {
      const points = panel.points as { x: number; y: number }[]
      return `polygon(${points.map(p => `${p.x}px ${p.y}px`).join(', ')})`
    } else if (panel.shape === 'ellipse' && panel.ellipse_data) {
      const data = panel.ellipse_data as { centerX: number; centerY: number; rx: number; ry: number }
      return `ellipse(${data.rx}px ${data.ry}px at ${data.centerX}px ${data.centerY}px)`
    } else {
      const imgW = currentScene.image_width || 800
      const imgH = currentScene.image_height || 600
      return `inset(${panel.y}px ${imgW - panel.x - panel.width}px ${imgH - panel.y - panel.height}px ${panel.x}px)`
    }
  }, [currentPanel, currentScene])

  // Get scope label for an audio
  const getScopeLabel = (audio: LocalAudio) => {
    if (!audio.scene_id && !audio.panel_id) return { label: 'Hikaye', color: 'text-purple-400', bg: 'bg-purple-500/20' }
    if (audio.scene_id && !audio.panel_id) return { label: 'Sahne', color: 'text-orange-400', bg: 'bg-orange-500/20' }
    return { label: 'Panel', color: 'text-blue-400', bg: 'bg-blue-500/20' }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-white">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex">
      {/* Left Panel - Audio List & Controls */}
      <div className="w-80 bg-gray-800 flex flex-col border-r border-gray-700">
        {/* Header */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Music size={18} className="text-purple-500" />
            <span className="text-white font-bold text-sm">Ses Yöneticisi</span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Current Context Info */}
        <div className="px-3 py-2 bg-gray-900/50 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Görüntülenen:</span>
            <div className="flex items-center gap-1">
              {viewMode === 'story' && <span className="text-purple-400">🎬 Tüm Hikaye</span>}
              {viewMode === 'scene' && <span className="text-orange-400">🎭 {currentScene?.title}</span>}
              {viewMode === 'panel' && <span className="text-blue-400">🖼️ Panel {currentPanelIndex + 1}</span>}
            </div>
          </div>
        </div>

        {/* Audio List - Grouped by scope */}
        <div className="flex-1 overflow-y-auto">
          {/* Story Level Audios */}
          {storyLevelAudios.length > 0 && (
            <div className="border-b border-gray-700">
              <div className="px-3 py-2 bg-purple-500/10 text-purple-400 text-xs font-medium flex items-center gap-2">
                <Layers size={12} />
                Hikaye Sesleri ({storyLevelAudios.length})
              </div>
              <div className="p-2 space-y-1">
                {storyLevelAudios.map(audio => (
                  <AudioItem
                    key={audio.id}
                    audio={audio}
                    isSelected={selectedAudioId === audio.id}
                    isPlaying={playingAudioId === audio.id}
                    onSelect={() => setSelectedAudioId(audio.id)}
                    onTogglePlay={() => togglePlay(audio.id)}
                    onDelete={() => deleteAudio(audio.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Scene Level Audios */}
          {viewMode !== 'story' && sceneLevelAudios.length > 0 && (
            <div className="border-b border-gray-700">
              <div className="px-3 py-2 bg-orange-500/10 text-orange-400 text-xs font-medium flex items-center gap-2">
                <ImageIcon size={12} />
                Sahne Sesleri ({sceneLevelAudios.length})
              </div>
              <div className="p-2 space-y-1">
                {sceneLevelAudios.map(audio => (
                  <AudioItem
                    key={audio.id}
                    audio={audio}
                    isSelected={selectedAudioId === audio.id}
                    isPlaying={playingAudioId === audio.id}
                    onSelect={() => setSelectedAudioId(audio.id)}
                    onTogglePlay={() => togglePlay(audio.id)}
                    onDelete={() => deleteAudio(audio.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Panel Level Audios */}
          {viewMode === 'panel' && panelLevelAudios.length > 0 && (
            <div className="border-b border-gray-700">
              <div className="px-3 py-2 bg-blue-500/10 text-blue-400 text-xs font-medium flex items-center gap-2">
                <ImageIcon size={12} />
                Panel Sesleri ({panelLevelAudios.length})
              </div>
              <div className="p-2 space-y-1">
                {panelLevelAudios.map(audio => (
                  <AudioItem
                    key={audio.id}
                    audio={audio}
                    isSelected={selectedAudioId === audio.id}
                    isPlaying={playingAudioId === audio.id}
                    onSelect={() => setSelectedAudioId(audio.id)}
                    onTogglePlay={() => togglePlay(audio.id)}
                    onDelete={() => deleteAudio(audio.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {contextAudios.length === 0 && (
            <div className="p-8 text-center">
              <Music size={32} className="mx-auto text-gray-600 mb-2" />
              <p className="text-gray-500 text-sm">Henüz ses yok</p>
            </div>
          )}
        </div>

        {/* Add Audio Buttons */}
        <div className="p-3 border-t border-gray-700 space-y-2 flex-shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Yükleniyor...' : 'Yeni Ses'}
            </button>
            
            {libraryAudios.length > 0 && (
              <button
                onClick={() => setShowLibraryPicker(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-600"
              >
                <FolderOpen size={14} />
                Kütüphane
              </button>
            )}
          </div>
          
          <div className="text-[10px] text-gray-500 text-center">
            Ses eklenecek yer: {viewMode === 'story' ? 'Tüm Hikaye' : viewMode === 'scene' ? currentScene?.title : `Panel ${currentPanelIndex + 1}`}
          </div>
        </div>

        {/* Save Button */}
        <div className="p-3 border-t border-gray-700 flex-shrink-0">
          {errorMessage && (
            <div className="flex items-center gap-2 text-red-400 text-xs mb-2">
              <AlertCircle size={12} />
              {errorMessage}
            </div>
          )}
          {saveStatus === 'success' && (
            <div className="flex items-center gap-2 text-green-400 text-xs mb-2">
              <CheckCircle size={12} />
              Kaydedildi!
            </div>
          )}
          <button
            onClick={saveAudios}
            disabled={saving || !hasChanges}
            className="w-full flex items-center justify-center gap-2 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-500 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Kaydediliyor...' : hasChanges ? 'Kaydet' : 'Kaydedildi'}
          </button>
        </div>
      </div>

      {/* Middle Panel - Preview */}
      <div className="flex-1 bg-black flex flex-col">
        {/* View Mode Tabs */}
        <div className="h-12 flex items-center justify-between px-4 bg-gray-800/80 border-b border-gray-700 flex-shrink-0">
          <div className="flex bg-gray-900 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('story')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === 'story' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Hikaye
            </button>
            <button
              onClick={() => setViewMode('scene')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === 'scene' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Sahne
            </button>
            <button
              onClick={() => setViewMode('panel')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === 'panel' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Panel
            </button>
          </div>
          
          {/* Navigation */}
          {viewMode !== 'story' && (
            <div className="flex items-center gap-2">
              <button onClick={goToPrevPanel} className="p-1 text-gray-400 hover:text-white">
                <ChevronLeft size={20} />
              </button>
              <span className="text-white text-xs">
                {viewMode === 'scene' 
                  ? `Sahne ${currentSceneIndex + 1}/${sortedScenes.length}`
                  : `Panel ${currentPanelIndex + 1}/${sortedPanels.length}`
                }
              </span>
              <button onClick={goToNextPanel} className="p-1 text-gray-400 hover:text-white">
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Preview Area */}
        <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
          {viewMode === 'story' ? (
            <div className="grid grid-cols-4 gap-3 max-w-3xl overflow-y-auto max-h-full p-2">
              {sortedScenes.map((scene, idx) => {
                const sceneAudioCount = audios.filter(a => a.scene_id === scene.id).length
                return (
                  <button
                    key={scene.id}
                    onClick={() => { goToScene(idx); setViewMode('scene') }}
                    className="relative rounded-lg overflow-hidden border-2 border-gray-700 hover:border-gray-500 transition-colors"
                  >
                    <img src={scene.image_url || ''} alt="" className="w-full h-20 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-1 left-1 right-1">
                      <p className="text-white text-[10px] truncate">{scene.title}</p>
                    </div>
                    {sceneAudioCount > 0 && (
                      <div className="absolute top-1 right-1 bg-purple-600 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                        <Music size={8} className="text-white" />
                        <span className="text-white text-[8px]">{sceneAudioCount}</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ) : currentScene ? (
            <div className="relative">
              {viewMode === 'scene' ? (
                <img 
                  src={currentScene.image_url || ''} 
                  alt=""
                  className="max-h-[60vh] object-contain rounded-lg"
                />
              ) : currentPanel ? (
                <div className="relative">
                  <img 
                    src={currentScene.image_url || ''} 
                    alt=""
                    className="max-h-[60vh] object-contain opacity-20 blur-sm"
                  />
                  <img 
                    src={currentScene.image_url || ''} 
                    alt=""
                    className="absolute inset-0 max-h-[60vh] object-contain"
                    style={{ clipPath: getClipPath() }}
                  />
                </div>
              ) : (
                <div className="text-gray-500 text-center">Panel yok</div>
              )}
            </div>
          ) : null}
        </div>

        {/* Scene/Panel Thumbnails */}
        {viewMode !== 'story' && (
          <div className="h-20 bg-gray-800/50 border-t border-gray-700 flex items-center px-4 gap-2 overflow-x-auto flex-shrink-0">
            {viewMode === 'scene' ? (
              sortedScenes.map((scene, idx) => (
                <button
                  key={scene.id}
                  onClick={() => goToScene(idx)}
                  className={`relative flex-shrink-0 w-20 h-14 rounded overflow-hidden border-2 transition-all ${
                    idx === currentSceneIndex ? 'border-orange-500 scale-105' : 'border-gray-600 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={scene.image_url || ''} alt="" className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-0.5">
                    <span className="text-white text-[8px] block text-center truncate px-1">{scene.title}</span>
                  </div>
                </button>
              ))
            ) : (
              sortedPanels.map((panel, idx) => {
                const panelHasAudio = audios.some(a => a.panel_id === panel.id)
                return (
                  <button
                    key={panel.id}
                    onClick={() => goToPanel(idx)}
                    className={`relative flex-shrink-0 w-16 h-14 rounded overflow-hidden border-2 transition-all ${
                      idx === currentPanelIndex ? 'border-blue-500 scale-105' : 'border-gray-600 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={currentScene?.image_url || ''} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <span className="text-white text-xs font-bold">{idx + 1}</span>
                    </div>
                    {panelHasAudio && (
                      <div className="absolute top-0.5 right-0.5">
                        <Music size={10} className="text-blue-400" />
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Right Panel - Audio Settings */}
      {selectedAudio && (
        <div className="w-72 bg-gray-800 border-l border-gray-700 flex flex-col">
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Settings size={16} className="text-gray-400" />
              <span className="text-white text-sm font-medium">Ses Ayarları</span>
            </div>
            <button onClick={() => setSelectedAudioId(null)} className="p-1 text-gray-400 hover:text-white">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Audio Name */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Ses Adı</label>
              <input
                type="text"
                value={selectedAudio.audio_name}
                onChange={(e) => updateAudio(selectedAudio.id, { audio_name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Scope */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Kapsam</label>
              <div className={`px-3 py-2 rounded text-sm ${getScopeLabel(selectedAudio).bg} ${getScopeLabel(selectedAudio).color}`}>
                {getScopeLabel(selectedAudio).label}
                {selectedAudio.scene_id && !selectedAudio.panel_id && ` - ${scenes.find(s => s.id === selectedAudio.scene_id)?.title}`}
                {selectedAudio.panel_id && ` - Panel`}
              </div>
            </div>

            {/* Volume - Modern Waveform Slider */}
            <WaveformVolumeSlider
              value={selectedAudio.volume}
              onChange={(vol) => updateAudio(selectedAudio.id, { volume: vol })}
              barCount={28}
              accentColor="bg-blue-500"
            />

            {/* Timing */}
            <div className="space-y-2">
              <label className="block text-xs text-gray-400 flex items-center gap-1">
                <Clock size={12} />
                Zamanlama
              </label>
              
              <div>
                <label className="text-[10px] text-gray-500">Başlangıç Gecikmesi (ms)</label>
                <input
                  type="number"
                  value={selectedAudio.start_delay_ms}
                  onChange={(e) => updateAudio(selectedAudio.id, { start_delay_ms: Number(e.target.value) })}
                  className="w-full px-2 py-1 bg-gray-700 text-white text-sm rounded border border-gray-600"
                  min={0}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500">Fade In (ms)</label>
                  <input
                    type="number"
                    value={selectedAudio.fade_in_ms}
                    onChange={(e) => updateAudio(selectedAudio.id, { fade_in_ms: Number(e.target.value) })}
                    className="w-full px-2 py-1 bg-gray-700 text-white text-sm rounded border border-gray-600"
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Fade Out (ms)</label>
                  <input
                    type="number"
                    value={selectedAudio.fade_out_ms}
                    onChange={(e) => updateAudio(selectedAudio.id, { fade_out_ms: Number(e.target.value) })}
                    className="w-full px-2 py-1 bg-gray-700 text-white text-sm rounded border border-gray-600"
                    min={0}
                  />
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedAudio.loop}
                  onChange={(e) => updateAudio(selectedAudio.id, { loop: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600"
                />
                <span className="text-sm text-gray-300">Tekrarla (Loop)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedAudio.autoplay}
                  onChange={(e) => updateAudio(selectedAudio.id, { autoplay: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600"
                />
                <span className="text-sm text-gray-300">Otomatik Çal</span>
              </label>
            </div>

            {/* Duration */}
            {selectedAudio.duration_ms && (
              <div className="text-xs text-gray-500 pt-2 border-t border-gray-700">
                Süre: {formatDuration(selectedAudio.duration_ms)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Library Picker Modal */}
      {showLibraryPicker && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center">
          <div className="bg-gray-800 rounded-xl w-96 max-h-[80vh] flex flex-col">
            <div className="h-12 flex items-center justify-between px-4 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <FolderOpen size={18} className="text-purple-500" />
                <span className="text-white font-medium">Ses Kütüphanesi</span>
              </div>
              <button onClick={() => setShowLibraryPicker(false)} className="p-1 text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-2 text-xs text-gray-400 border-b border-gray-700">
              Eklenecek yer: {viewMode === 'story' ? 'Tüm Hikaye' : viewMode === 'scene' ? currentScene?.title : `Panel ${currentPanelIndex + 1}`}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {libraryAudios.map(audio => (
                <button
                  key={audio.id}
                  onClick={() => addFromLibrary(audio)}
                  className="w-full flex items-center gap-3 p-3 bg-gray-700 rounded-lg hover:bg-gray-600 text-left transition-colors"
                >
                  <div className="w-10 h-10 bg-purple-500 rounded flex items-center justify-center">
                    <Music size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{audio.audio_name}</div>
                    <div className="text-gray-400 text-xs">
                      {audio.duration_ms ? formatDuration(audio.duration_ms) : '--:--'}
                    </div>
                  </div>
                  <Plus size={18} className="text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// AUDIO ITEM COMPONENT
// ============================================================================

interface AudioItemProps {
  audio: LocalAudio
  isSelected: boolean
  isPlaying: boolean
  onSelect: () => void
  onTogglePlay: () => void
  onDelete: () => void
}

function AudioItem({ audio, isSelected, isPlaying, onSelect, onTogglePlay, onDelete }: AudioItemProps) {
  const typeInfo = AUDIO_TYPES.find(t => t.type === audio.audio_type) || AUDIO_TYPES[0]

  // Mini waveform bar gösterimi - eşit yükseklik
  const volumePercent = Math.min(audio.volume, 2) / 2 * 100
  const barCount = 8

  return (
    <div 
      onClick={onSelect}
      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors group ${
        isSelected ? 'bg-blue-600/30 border border-blue-500' : 'bg-gray-700/50 hover:bg-gray-700 border border-transparent'
      }`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onTogglePlay() }}
        className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
          isPlaying ? 'bg-green-600 animate-pulse' : typeInfo.color
        }`}
      >
        {isPlaying ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white ml-0.5" />}
      </button>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-white text-xs font-medium truncate">{audio.audio_name}</span>
          {audio.loop && <Repeat size={10} className="text-green-400 flex-shrink-0" />}
          {audio.isNew && <span className="text-[8px] bg-yellow-500 text-black px-1 rounded flex-shrink-0">Yeni</span>}
        </div>
        <div className="text-gray-500 text-[10px]">
          {audio.duration_ms ? formatDuration(audio.duration_ms) : '--:--'} • {Math.round(audio.volume * 100)}%
        </div>
      </div>

      {/* Mini Volume Bar Indicator - Eşit Yükseklik */}
      <div className="flex items-end h-4 gap-[1px] mr-1">
        {Array.from({ length: barCount }).map((_, idx) => {
          const isActive = ((idx + 1) / barCount) * 100 <= volumePercent
          return (
            <div
              key={idx}
              className={`w-[3px] h-full rounded-sm transition-colors ${
                isActive 
                  ? audio.volume > 1 ? 'bg-orange-400' : 'bg-blue-400'
                  : 'bg-gray-600'
              }`}
            />
          )
        })}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
