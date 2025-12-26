'use client'

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { 
  X, 
  Plus,
  Trash2,
  MessageCircle, 
  Cloud, 
  Megaphone, 
  Volume2,
  BookOpen,
  Subtitles,
  Zap,
  Circle,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  GripHorizontal,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Link,
  Unlink
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { 
  BubbleType, 
  TextStyle, 
  SupportedLanguage 
} from '@/types/database'

// ============================================================================
// TYPES
// ============================================================================

// Extended style override that includes position and size
interface ContentStyleOverride extends Partial<TextStyle> {
  // Position and size overrides for per-language customization
  __position_x?: number
  __position_y?: number
  __width?: number
  __bubble_type?: BubbleType
}

interface LocalPanelText {
  id: string
  panel_id: string
  position_x: number
  position_y: number
  width: number | null
  height: number | null
  rotation: number
  anchor: string
  bubble_type: BubbleType
  style: TextStyle
  z_index: number
  visible: boolean
  locked: boolean
  name: string | null
  contents: LocalTextContent[]
  isNew?: boolean
  dbId?: string
}

interface LocalTextContent {
  id: string
  language: SupportedLanguage
  text: string
  style_override: ContentStyleOverride | null
  isNew?: boolean
  dbId?: string
}

interface TextEditorProps {
  panelDbId: string
  panelBounds: { x: number; y: number; w: number; h: number }
  panelImageUrl: string
  imageWidth: number
  imageHeight: number
  onClose: () => void
  onSaved?: () => void
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BUBBLE_TYPES: { type: BubbleType; icon: React.ElementType; label: string }[] = [
  { type: 'speech', icon: MessageCircle, label: 'Konuşma' },
  { type: 'thought', icon: Cloud, label: 'Düşünce' },
  { type: 'shout', icon: Megaphone, label: 'Bağırma' },
  { type: 'whisper', icon: Volume2, label: 'Fısıltı' },
  { type: 'narration', icon: BookOpen, label: 'Anlatı' },
  { type: 'caption', icon: Subtitles, label: 'Altyazı' },
  { type: 'sfx', icon: Zap, label: 'Efekt' },
  { type: 'none', icon: Circle, label: 'Yok' },
]

const LANGUAGES: { code: SupportedLanguage; name: string; flag: string }[] = [
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
]

const DEFAULT_STYLE: TextStyle = {
  fontFamily: 'Comic Sans MS, cursive, sans-serif',
  fontSize: 16,
  fontWeight: 'bold',
  color: '#000000',
  backgroundColor: '#FFFFFF',
  backgroundOpacity: 1,
  textAlign: 'center',
  borderRadius: 20,
  padding: 12
}

// Hex rengi RGBA'ya çevir
const hexToRgba = (hex: string, opacity: number): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return `rgba(255, 255, 255, ${opacity})`
  return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`
}

// Arkaplan stilini hesapla
const getBackgroundStyle = (style: TextStyle, bubbleType: string): string => {
  if (bubbleType === 'sfx' || bubbleType === 'none') return 'transparent'
  const opacity = style.backgroundOpacity ?? 1
  if (opacity === 0) return 'transparent'
  const bgColor = style.backgroundColor || '#FFFFFF'
  return hexToRgba(bgColor, opacity)
}

const FONT_OPTIONS = [
  { value: 'Comic Sans MS, cursive, sans-serif', label: 'Comic Sans' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: '"Segoe UI", sans-serif', label: 'Segoe UI' },
  { value: 'Georgia, serif', label: 'Georgia' },
]

const generateId = (): string => `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// ============================================================================
// TEXT EDITOR COMPONENT
// ============================================================================

export default function TextEditor({
  panelDbId,
  panelBounds,
  panelImageUrl,
  imageWidth,
  imageHeight,
  onClose,
  onSaved
}: TextEditorProps) {
  const supabase = createClient()
  
  const [texts, setTexts] = useState<LocalPanelText[]>([])
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [activeLanguage, setActiveLanguage] = useState<SupportedLanguage>('tr')
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [linkedMode, setLinkedMode] = useState(true) // Tüm diller bağlı mı?
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedText = texts.find(t => t.id === selectedTextId)

  // Get effective values for a specific language (with override support)
  const getEffectiveValues = useCallback((text: LocalPanelText, lang: SupportedLanguage) => {
    const content = text.contents.find(c => c.language === lang)
    const override = content?.style_override as ContentStyleOverride | null
    
    return {
      position_x: override?.__position_x ?? text.position_x,
      position_y: override?.__position_y ?? text.position_y,
      width: override?.__width ?? text.width ?? 150,
      bubble_type: override?.__bubble_type ?? text.bubble_type,
      style: {
        ...text.style,
        ...(override ? Object.fromEntries(
          Object.entries(override).filter(([key]) => !key.startsWith('__'))
        ) : {})
      } as TextStyle
    }
  }, [])

  // Calculate view scale
  const viewScale = useMemo(() => {
    return Math.min(
      (window.innerWidth - 400) / panelBounds.w,
      (window.innerHeight - 100) / panelBounds.h,
      2
    ) * 0.8
  }, [panelBounds.w, panelBounds.h])

  // Load texts from database
  useEffect(() => {
    const loadTexts = async () => {
      if (!panelDbId) {
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('panel_texts')
          .select('*, panel_text_contents(*)')
          .eq('panel_id', panelDbId)

        if (error) throw error

        if (data) {
          const loadedTexts: LocalPanelText[] = data.map((t) => ({
            id: `text_${t.id}`,
            panel_id: panelDbId,
            position_x: Number(t.position_x),
            position_y: Number(t.position_y),
            width: t.width ? Number(t.width) : 150,
            height: t.height ? Number(t.height) : null,
            rotation: Number(t.rotation) || 0,
            anchor: t.anchor || 'top-left',
            bubble_type: t.bubble_type as BubbleType || 'speech',
            style: (t.style as TextStyle) || { ...DEFAULT_STYLE },
            z_index: t.z_index || 0,
            visible: t.visible !== false,
            locked: t.locked || false,
            name: t.name,
            contents: (t.panel_text_contents || []).map((c: { id: string; language: SupportedLanguage; text: string; style_override: ContentStyleOverride | null }) => ({
              id: `content_${c.id}`,
              language: c.language,
              text: c.text,
              style_override: c.style_override,
              dbId: c.id
            })),
            dbId: t.id
          }))
          setTexts(loadedTexts)
        }
      } catch (err) {
        console.error('Error loading texts:', err)
        setErrorMessage('Metinler yüklenirken hata oluştu')
      } finally {
        setLoading(false)
      }
    }

    loadTexts()
  }, [panelDbId, supabase])

  // Add new text
  const addText = useCallback(() => {
    if (!panelDbId) return

    const newText: LocalPanelText = {
      id: generateId(),
      panel_id: panelDbId,
      position_x: panelBounds.x + 20,
      position_y: panelBounds.y + 20,
      width: 150,
      height: null,
      rotation: 0,
      anchor: 'top-left',
      bubble_type: 'speech',
      style: { ...DEFAULT_STYLE },
      z_index: texts.length,
      visible: true,
      locked: false,
      name: `Metin ${texts.length + 1}`,
      contents: [
        { id: generateId(), language: 'tr', text: 'Metin girin...', style_override: null, isNew: true },
        { id: generateId(), language: 'en', text: 'Enter text...', style_override: null, isNew: true }
      ],
      isNew: true
    }
    
    setTexts(prev => [...prev, newText])
    setSelectedTextId(newText.id)
    setHasChanges(true)
    setSaveStatus('idle')
  }, [panelDbId, panelBounds, texts.length])

  // Delete text
  const deleteText = useCallback(async (textId: string) => {
    const text = texts.find(t => t.id === textId)
    
    if (text?.dbId) {
      try {
        await supabase.from('panel_text_contents').delete().eq('panel_text_id', text.dbId)
        const { error } = await supabase.from('panel_texts').delete().eq('id', text.dbId)
        if (error) throw error
      } catch (err) {
        console.error('Error deleting text:', err)
        setErrorMessage('Silme hatası: ' + (err instanceof Error ? err.message : String(err)))
        return
      }
    }
    
    setTexts(prev => prev.filter(t => t.id !== textId))
    if (selectedTextId === textId) setSelectedTextId(null)
    setHasChanges(true)
    setSaveStatus('idle')
  }, [texts, selectedTextId, supabase])

  // Update text base properties (affects all languages when linked)
  const updateTextBase = useCallback((textId: string, updates: Partial<LocalPanelText>) => {
    setTexts(prev => prev.map(t => t.id === textId ? { ...t, ...updates } : t))
    setHasChanges(true)
    setSaveStatus('idle')
  }, [])

  // Update text properties for specific language (creates override)
  const updateTextForLanguage = useCallback((textId: string, lang: SupportedLanguage, updates: {
    position_x?: number
    position_y?: number
    width?: number
    bubble_type?: BubbleType
    style?: Partial<TextStyle>
  }) => {
    setTexts(prev => prev.map(t => {
      if (t.id !== textId) return t
      
      // If linked mode, update base properties
      if (linkedMode) {
        const baseUpdates: Partial<LocalPanelText> = {}
        if (updates.position_x !== undefined) baseUpdates.position_x = updates.position_x
        if (updates.position_y !== undefined) baseUpdates.position_y = updates.position_y
        if (updates.width !== undefined) baseUpdates.width = updates.width
        if (updates.bubble_type !== undefined) baseUpdates.bubble_type = updates.bubble_type
        if (updates.style) baseUpdates.style = { ...t.style, ...updates.style }
        return { ...t, ...baseUpdates }
      }
      
      // Unlinked mode - create/update override for specific language
      const updatedContents = t.contents.map(c => {
        if (c.language !== lang) return c
        
        const existingOverride = (c.style_override || {}) as ContentStyleOverride
        const newOverride: ContentStyleOverride = { ...existingOverride }
        
        if (updates.position_x !== undefined) newOverride.__position_x = updates.position_x
        if (updates.position_y !== undefined) newOverride.__position_y = updates.position_y
        if (updates.width !== undefined) newOverride.__width = updates.width
        if (updates.bubble_type !== undefined) newOverride.__bubble_type = updates.bubble_type
        if (updates.style) {
          Object.entries(updates.style).forEach(([key, value]) => {
            (newOverride as Record<string, unknown>)[key] = value
          })
        }
        
        return { ...c, style_override: newOverride }
      })
      
      return { ...t, contents: updatedContents }
    }))
    setHasChanges(true)
    setSaveStatus('idle')
  }, [linkedMode])

  // Update text content for specific language
  const updateTextContent = useCallback((textId: string, lang: SupportedLanguage, newContent: string) => {
    setTexts(prev => prev.map(t => {
      if (t.id !== textId) return t
      
      const existingContent = t.contents.find(c => c.language === lang)
      if (existingContent) {
        return {
          ...t,
          contents: t.contents.map(c => c.language === lang ? { ...c, text: newContent } : c)
        }
      } else {
        return {
          ...t,
          contents: [...t.contents, { id: generateId(), language: lang, text: newContent, style_override: null, isNew: true }]
        }
      }
    }))
    setHasChanges(true)
    setSaveStatus('idle')
  }, [])

  // Save all texts to database
  const saveTexts = useCallback(async () => {
    if (!panelDbId) {
      setErrorMessage('Panel ID bulunamadı!')
      setSaveStatus('error')
      return
    }
    
    setSaving(true)
    setErrorMessage(null)
    setSaveStatus('idle')
    
    try {
      for (const text of texts) {
        if (text.isNew) {
          const { data: newText, error: insertError } = await supabase
            .from('panel_texts')
            .insert({
              panel_id: panelDbId,
              position_x: text.position_x,
              position_y: text.position_y,
              width: text.width,
              height: text.height,
              rotation: text.rotation,
              anchor: text.anchor,
              bubble_type: text.bubble_type,
              style: text.style,
              z_index: text.z_index,
              visible: text.visible,
              locked: text.locked,
              name: text.name
            })
            .select()
            .single()

          if (insertError) throw new Error(`Metin eklenemedi: ${insertError.message}`)

          if (newText) {
            for (const content of text.contents) {
              const { error: contentError } = await supabase.from('panel_text_contents').insert({
                panel_text_id: newText.id,
                language: content.language,
                text: content.text,
                style_override: content.style_override
              })
              
              if (contentError) throw new Error(`İçerik eklenemedi: ${contentError.message}`)
            }
            
            text.dbId = newText.id
            text.isNew = false
          }
        } else if (text.dbId) {
          const { error: updateError } = await supabase
            .from('panel_texts')
            .update({
              position_x: text.position_x,
              position_y: text.position_y,
              width: text.width,
              height: text.height,
              rotation: text.rotation,
              anchor: text.anchor,
              bubble_type: text.bubble_type,
              style: text.style,
              z_index: text.z_index,
              visible: text.visible,
              locked: text.locked,
              name: text.name
            })
            .eq('id', text.dbId)

          if (updateError) throw new Error(`Metin güncellenemedi: ${updateError.message}`)

          for (const content of text.contents) {
            if (content.dbId) {
              const { error: contentUpdateError } = await supabase
                .from('panel_text_contents')
                .update({ text: content.text, style_override: content.style_override })
                .eq('id', content.dbId)
              
              if (contentUpdateError) throw new Error(`İçerik güncellenemedi: ${contentUpdateError.message}`)
            } else {
              const { data: newContent, error: contentInsertError } = await supabase
                .from('panel_text_contents')
                .insert({
                  panel_text_id: text.dbId,
                  language: content.language,
                  text: content.text,
                  style_override: content.style_override
                })
                .select()
                .single()
              
              if (contentInsertError) throw new Error(`İçerik eklenemedi: ${contentInsertError.message}`)
              
              if (newContent) {
                content.dbId = newContent.id
                content.isNew = false
              }
            }
          }
        }
      }
      
      setTexts(prev => prev.map(t => ({
        ...t,
        isNew: false,
        contents: t.contents.map(c => ({ ...c, isNew: false }))
      })))
      
      setHasChanges(false)
      setSaveStatus('success')
      onSaved?.()
      
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (err) {
      console.error('Error saving texts:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Bilinmeyen hata')
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }, [texts, panelDbId, supabase, onSaved])

  // Get text content for language
  const getTextContent = (text: LocalPanelText, lang: SupportedLanguage): string => {
    const content = text.contents.find(c => c.language === lang)
    return content?.text || ''
  }

  // Check if language has overrides
  const hasOverride = (text: LocalPanelText, lang: SupportedLanguage): boolean => {
    const content = text.contents.find(c => c.language === lang)
    const override = content?.style_override as ContentStyleOverride | null
    return !!(override && (
      override.__position_x !== undefined ||
      override.__position_y !== undefined ||
      override.__width !== undefined ||
      override.__bubble_type !== undefined ||
      Object.keys(override).some(k => !k.startsWith('__'))
    ))
  }

  // Clear overrides for a language
  const clearOverrides = useCallback((textId: string, lang: SupportedLanguage) => {
    setTexts(prev => prev.map(t => {
      if (t.id !== textId) return t
      return {
        ...t,
        contents: t.contents.map(c => 
          c.language === lang ? { ...c, style_override: null } : c
        )
      }
    }))
    setHasChanges(true)
    setSaveStatus('idle')
  }, [])

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent, textId: string) => {
    e.stopPropagation()
    const text = texts.find(t => t.id === textId)
    if (!text || text.locked) return

    setSelectedTextId(textId)
    setIsDragging(true)
    
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const effectiveValues = getEffectiveValues(text, activeLanguage)
      const x = (e.clientX - rect.left) / viewScale + panelBounds.x
      const y = (e.clientY - rect.top) / viewScale + panelBounds.y
      setDragOffset({ x: x - effectiveValues.position_x, y: y - effectiveValues.position_y })
    }
  }, [texts, viewScale, panelBounds, activeLanguage, getEffectiveValues])

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent, textId: string) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedTextId(textId)
    setIsResizing(true)
  }, [])

  // Handle mouse move
  useEffect(() => {
    if (!isDragging && !isResizing) return
    if (!selectedTextId) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = (e.clientX - rect.left) / viewScale + panelBounds.x
      const y = (e.clientY - rect.top) / viewScale + panelBounds.y

      if (isDragging) {
        updateTextForLanguage(selectedTextId, activeLanguage, {
          position_x: Math.max(panelBounds.x, Math.min(x - dragOffset.x, panelBounds.x + panelBounds.w - 50)),
          position_y: Math.max(panelBounds.y, Math.min(y - dragOffset.y, panelBounds.y + panelBounds.h - 30))
        })
      } else if (isResizing) {
        const text = texts.find(t => t.id === selectedTextId)
        if (text) {
          const effectiveValues = getEffectiveValues(text, activeLanguage)
          const newWidth = Math.max(80, x - effectiveValues.position_x)
          updateTextForLanguage(selectedTextId, activeLanguage, { width: newWidth })
        }
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, selectedTextId, viewScale, panelBounds, dragOffset, updateTextForLanguage, texts, activeLanguage, getEffectiveValues])

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-white">Metinler yükleniyor...</p>
        </div>
      </div>
    )
  }

  // Get effective values for selected text
  const selectedEffective = selectedText ? getEffectiveValues(selectedText, activeLanguage) : null

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex">
      {/* Sol: Panel görsel alanı */}
      <div className="flex-1 flex flex-col">
        {/* Üst bar */}
        <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <span className="text-white font-bold">Panel Metin Düzenleyici</span>
            {hasChanges && <span className="text-yellow-400 text-sm flex items-center gap-1"><AlertCircle size={14} /> Kaydedilmemiş</span>}
            {saveStatus === 'success' && <span className="text-green-400 text-sm flex items-center gap-1"><CheckCircle size={14} /> Kaydedildi!</span>}
            {saveStatus === 'error' && errorMessage && <span className="text-red-400 text-sm flex items-center gap-1"><AlertCircle size={14} /> {errorMessage}</span>}
          </div>
          <div className="flex items-center gap-2">
            {/* Link/Unlink toggle */}
            <button
              onClick={() => setLinkedMode(!linkedMode)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                linkedMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-purple-600 text-white'
              }`}
              title={linkedMode ? 'Tüm diller bağlı - değişiklikler hepsini etkiler' : 'Diller bağımsız - değişiklikler sadece aktif dili etkiler'}
            >
              {linkedMode ? <Link size={16} /> : <Unlink size={16} />}
              {linkedMode ? 'Bağlı' : 'Bağımsız'}
            </button>
            
            <button
              onClick={saveTexts}
              disabled={saving || !hasChanges}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Panel görüntüsü */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
          <div 
            ref={containerRef}
            className="text-editor-panel relative bg-gray-900 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700"
            style={{
              width: panelBounds.w * viewScale,
              height: panelBounds.h * viewScale,
            }}
          >
            {/* Panel image - only show the panel area, not the full image */}
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={panelImageUrl}
                alt="Panel"
                style={{
                  position: 'absolute',
                  left: -panelBounds.x * viewScale,
                  top: -panelBounds.y * viewScale,
                  width: imageWidth * viewScale,
                  height: imageHeight * viewScale,
                  maxWidth: 'none',
                }}
                className="pointer-events-none"
                draggable={false}
              />
            </div>

            {/* Text overlays - show only active language */}
            {texts.map((text) => {
              const content = getTextContent(text, activeLanguage)
              const effective = getEffectiveValues(text, activeLanguage)
              const isSelected = selectedTextId === text.id
              const relX = (effective.position_x - panelBounds.x) * viewScale
              const relY = (effective.position_y - panelBounds.y) * viewScale
              const textWidth = effective.width * viewScale

              const bgStyle = getBackgroundStyle(effective.style, effective.bubble_type)
              const hasLangOverride = hasOverride(text, activeLanguage)

              return (
                <div
                  key={text.id}
                  onMouseDown={(e) => handleDragStart(e, text.id)}
                  className={`absolute select-none ${isSelected ? 'ring-2 ring-blue-500' : ''} ${text.locked ? 'opacity-50' : 'cursor-move'}`}
                  style={{
                    left: relX,
                    top: relY,
                    width: textWidth,
                    zIndex: text.z_index + 10,
                    fontFamily: effective.style.fontFamily || 'Comic Sans MS, cursive, sans-serif',
                    fontSize: (effective.style.fontSize || 16) * viewScale,
                    fontWeight: effective.style.fontWeight || 'bold',
                    fontStyle: effective.style.fontStyle || 'normal',
                    color: effective.style.color || '#000000',
                    backgroundColor: bgStyle,
                    textAlign: effective.style.textAlign as React.CSSProperties['textAlign'] || 'center',
                    padding: (effective.style.padding || 12) * viewScale,
                    borderRadius: effective.bubble_type === 'thought' ? 9999 : (effective.style.borderRadius || 20) * viewScale,
                    lineHeight: 1.3,
                    textTransform: effective.bubble_type === 'shout' ? 'uppercase' : undefined,
                    textShadow: effective.bubble_type === 'sfx' ? `2px 2px 0 ${effective.style.backgroundColor || '#FFFFFF'}, -2px -2px 0 ${effective.style.backgroundColor || '#FFFFFF'}` : undefined,
                  }}
                >
                  {content || `[${activeLanguage.toUpperCase()}]`}
                  
                  {/* Override indicator */}
                  {hasLangOverride && !linkedMode && (
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold">
                      ✦
                    </div>
                  )}
                  
                  {isSelected && (
                    <div
                      onMouseDown={(e) => handleResizeStart(e, text.id)}
                      className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-10 bg-blue-500 rounded cursor-ew-resize flex items-center justify-center hover:bg-blue-400"
                    >
                      <GripHorizontal size={14} className="text-white" />
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add button */}
            <button
              onClick={addText}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-500 shadow-xl text-lg font-medium"
            >
              <Plus size={24} />
              Metin Ekle
            </button>
          </div>
        </div>
      </div>

      {/* Sağ: Ayarlar paneli */}
      <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col overflow-hidden">
        {/* Language selector */}
        <div className="flex-shrink-0 p-4 bg-gray-900 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400">Düzenlenen Dil</label>
            {!linkedMode && (
              <span className="text-xs text-purple-400">🔓 Bağımsız mod</span>
            )}
          </div>
          <div className="flex gap-2">
            {LANGUAGES.slice(0, 5).map(lang => {
              const hasOvr = selectedText ? hasOverride(selectedText, lang.code) : false
              return (
                <button
                  key={lang.code}
                  onClick={() => setActiveLanguage(lang.code)}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-lg text-sm font-medium transition-all relative ${
                    activeLanguage === lang.code
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <span>{lang.code.toUpperCase()}</span>
                  {hasOvr && !linkedMode && (
                    <div className="absolute top-1 right-1 w-2 h-2 bg-purple-500 rounded-full" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Text list */}
        <div className="flex-shrink-0 p-4 border-b border-gray-700">
          <label className="block text-sm text-gray-400 mb-2">Metinler ({texts.length})</label>
          {texts.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-6 bg-gray-900 rounded-lg">
              Henüz metin yok.<br />
              <span className="text-blue-400">Aşağıdaki &quot;Metin Ekle&quot; butonuna tıklayın.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {texts.map((text, i) => (
                <div
                  key={text.id}
                  onClick={() => setSelectedTextId(text.id)}
                  className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer ${
                    selectedTextId === text.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <span className="text-sm font-bold w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">{i + 1}</span>
                  <span className="flex-1 text-sm truncate">{getTextContent(text, activeLanguage).substring(0, 20) || 'Boş metin'}</span>
                  {text.isNew && <span className="text-xs bg-yellow-500 text-black px-1 rounded">Yeni</span>}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteText(text.id) }}
                    className="p-1.5 hover:bg-red-600 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected text properties */}
        {selectedText && selectedEffective ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Clear override button */}
            {!linkedMode && hasOverride(selectedText, activeLanguage) && (
              <button
                onClick={() => clearOverrides(selectedText.id, activeLanguage)}
                className="w-full py-2 px-4 bg-purple-600/20 text-purple-400 rounded-lg text-sm hover:bg-purple-600/30 flex items-center justify-center gap-2"
              >
                <X size={14} />
                {activeLanguage.toUpperCase()} özel ayarlarını temizle
              </button>
            )}

            {/* Text content */}
            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                  <span className="text-xl">{LANGUAGES.find(l => l.code === activeLanguage)?.flag}</span> 
                  {LANGUAGES.find(l => l.code === activeLanguage)?.name} Metin
                </label>
                <textarea
                  value={getTextContent(selectedText, activeLanguage)}
                  onChange={(e) => updateTextContent(selectedText.id, activeLanguage, e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
                  rows={3}
                  placeholder="Metin yazın..."
                />
              </div>
            </div>

            {/* Width */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Genişlik: {Math.round(selectedEffective.width)}px</label>
              <input
                type="range"
                min="80"
                max="400"
                value={selectedEffective.width}
                onChange={(e) => updateTextForLanguage(selectedText.id, activeLanguage, { width: Number(e.target.value) })}
                className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Bubble type */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Balon Tipi</label>
              <div className="grid grid-cols-4 gap-2">
                {BUBBLE_TYPES.map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    onClick={() => updateTextForLanguage(selectedText.id, activeLanguage, { bubble_type: type })}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg text-xs transition-colors ${
                      selectedEffective.bubble_type === type ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                    title={label}
                  >
                    <Icon size={18} />
                  </button>
                ))}
              </div>
            </div>

            {/* Font & Size */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Font</label>
                <select
                  value={selectedEffective.style.fontFamily || DEFAULT_STYLE.fontFamily}
                  onChange={(e) => updateTextForLanguage(selectedText.id, activeLanguage, { style: { fontFamily: e.target.value } })}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                >
                  {FONT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Boyut</label>
                <input
                  type="number"
                  value={selectedEffective.style.fontSize || 16}
                  onChange={(e) => updateTextForLanguage(selectedText.id, activeLanguage, { style: { fontSize: Number(e.target.value) } })}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                  min={5}
                  max={48}
                />
              </div>
            </div>

            {/* Style buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => updateTextForLanguage(selectedText.id, activeLanguage, { 
                  style: { fontWeight: selectedEffective.style.fontWeight === 'bold' ? 'normal' : 'bold' } 
                })}
                className={`flex-1 p-3 rounded-lg ${selectedEffective.style.fontWeight === 'bold' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
              >
                <Bold size={18} className="mx-auto" />
              </button>
              <button
                onClick={() => updateTextForLanguage(selectedText.id, activeLanguage, { 
                  style: { fontStyle: selectedEffective.style.fontStyle === 'italic' ? 'normal' : 'italic' } 
                })}
                className={`flex-1 p-3 rounded-lg ${selectedEffective.style.fontStyle === 'italic' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
              >
                <Italic size={18} className="mx-auto" />
              </button>
              <button
                onClick={() => updateTextForLanguage(selectedText.id, activeLanguage, { style: { textAlign: 'left' } })}
                className={`flex-1 p-3 rounded-lg ${selectedEffective.style.textAlign === 'left' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
              >
                <AlignLeft size={18} className="mx-auto" />
              </button>
              <button
                onClick={() => updateTextForLanguage(selectedText.id, activeLanguage, { style: { textAlign: 'center' } })}
                className={`flex-1 p-3 rounded-lg ${(selectedEffective.style.textAlign || 'center') === 'center' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
              >
                <AlignCenter size={18} className="mx-auto" />
              </button>
              <button
                onClick={() => updateTextForLanguage(selectedText.id, activeLanguage, { style: { textAlign: 'right' } })}
                className={`flex-1 p-3 rounded-lg ${selectedEffective.style.textAlign === 'right' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
              >
                <AlignRight size={18} className="mx-auto" />
              </button>
            </div>

            {/* Colors */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Metin Rengi</label>
                <input
                  type="color"
                  value={selectedEffective.style.color || '#000000'}
                  onChange={(e) => updateTextForLanguage(selectedText.id, activeLanguage, { style: { color: e.target.value } })}
                  className="w-full h-10 rounded-lg border border-gray-600 cursor-pointer"
                />
              </div>
              
              <div className="bg-gray-900 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-400">Arka Plan</label>
                  <button
                    onClick={() => updateTextForLanguage(selectedText.id, activeLanguage, { 
                      style: { backgroundOpacity: (selectedEffective.style.backgroundOpacity ?? 1) === 0 ? 1 : 0 } 
                    })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      (selectedEffective.style.backgroundOpacity ?? 1) === 0 
                        ? 'bg-red-600 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {(selectedEffective.style.backgroundOpacity ?? 1) === 0 ? '✕ Yok' : '✓ Var'}
                  </button>
                </div>
                
                {(selectedEffective.style.backgroundOpacity ?? 1) > 0 && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Renk</label>
                      <input
                        type="color"
                        value={selectedEffective.style.backgroundColor || '#FFFFFF'}
                        onChange={(e) => updateTextForLanguage(selectedText.id, activeLanguage, { style: { backgroundColor: e.target.value } })}
                        className="w-full h-10 rounded-lg border border-gray-600 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Şeffaflık: {Math.round((selectedEffective.style.backgroundOpacity ?? 1) * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round((selectedEffective.style.backgroundOpacity ?? 1) * 100)}
                        onChange={(e) => updateTextForLanguage(selectedText.id, activeLanguage, { 
                          style: { backgroundOpacity: Number(e.target.value) / 100 } 
                        })}
                        className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Border radius & padding */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Köşe: {selectedEffective.style.borderRadius || 20}</label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={selectedEffective.style.borderRadius || 20}
                  onChange={(e) => updateTextForLanguage(selectedText.id, activeLanguage, { style: { borderRadius: Number(e.target.value) } })}
                  className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Boşluk: {selectedEffective.style.padding || 12}</label>
                <input
                  type="range"
                  min="4"
                  max="30"
                  value={selectedEffective.style.padding || 12}
                  onChange={(e) => updateTextForLanguage(selectedText.id, activeLanguage, { style: { padding: Number(e.target.value) } })}
                  className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center text-gray-500">
              <Plus size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Metin ekleyin</p>
              <p className="text-sm">Sol taraftaki panelde &quot;Metin Ekle&quot; butonuna tıklayın</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
