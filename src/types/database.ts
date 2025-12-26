// Database types for Supabase

export interface Story {
  id: string
  title: string
  description: string | null
  cover_image: string | null
  author_id: string
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface Scene {
  id: string
  story_id: string
  title: string
  image_url: string
  image_width: number
  image_height: number
  order_index: number
  is_start_scene: boolean
  is_decision_scene: boolean
  created_at: string
}

export interface Panel {
  id: string
  scene_id: string
  shape: 'rectangle' | 'polygon' | 'ellipse' | 'brush'
  x: number
  y: number
  width: number
  height: number
  points: { x: number; y: number }[] | null
  brush_strokes: { x: number; y: number; size: number }[] | null
  ellipse_data: { centerX: number; centerY: number; rx: number; ry: number } | null
  order_index: number
}

export interface Choice {
  id: string
  from_scene_id: string
  to_scene_id: string
  choice_text: string
  order_index: number
}

// ─────────────────────────────────────────────────────────────────────────
// TEXT OVERLAY TYPES
// ─────────────────────────────────────────────────────────────────────────

export type SupportedLanguage = 
  | 'tr' | 'en' | 'ja' | 'ko' | 'zh' 
  | 'es' | 'fr' | 'de' | 'it' | 'pt' 
  | 'ru' | 'ar' | 'he'

export type BubbleType = 
  | 'speech' | 'thought' | 'shout' | 'whisper' 
  | 'narration' | 'caption' | 'sfx' | 'none'

export interface TextStyle {
  fontFamily?: string
  fontSize?: number
  fontWeight?: number | string
  fontStyle?: 'normal' | 'italic' | 'oblique'
  color?: string
  backgroundColor?: string
  backgroundOpacity?: number  // 0-1 arası, varsayılan 1
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  lineHeight?: number
  letterSpacing?: number
  padding?: number
  paddingX?: number
  paddingY?: number
  borderRadius?: number
  borderColor?: string
  borderWidth?: number
  strokeColor?: string
  strokeWidth?: number
  opacity?: number
  shadow?: {
    offsetX: number
    offsetY: number
    blur: number
    color: string
  }
  direction?: 'ltr' | 'rtl' | 'auto'
  isVertical?: boolean
}

export interface PanelTextContent {
  id: string
  panel_text_id: string
  language: SupportedLanguage
  text: string
  style_override: Partial<TextStyle> | null
  created_at: string
  updated_at: string
}

export interface PanelText {
  id: string
  panel_id: string
  
  // Pozisyon
  position_x: number
  position_y: number
  width: number | null
  height: number | null
  rotation: number
  anchor: string
  
  // Bubble
  bubble_type: BubbleType
  bubble_tail_enabled: boolean
  bubble_tail_direction: string | null
  bubble_tail_position: number | null
  bubble_tail_target_x: number | null
  bubble_tail_target_y: number | null
  
  // Stil
  style: TextStyle
  
  // Görünüm
  z_index: number
  visible: boolean
  locked: boolean
  name: string | null
  
  // Meta
  created_at: string
  updated_at: string
  
  // İlişkili içerikler (join ile gelir)
  contents?: PanelTextContent[]
}

export interface StoryLanguage {
  id: string
  story_id: string
  language: SupportedLanguage
  is_primary: boolean
  is_complete: boolean
  created_at: string
}

export interface FontPreset {
  id: string
  user_id: string | null
  name: string
  display_name: string
  font_family: string
  category: string
  languages: SupportedLanguage[]
  font_url: string | null
  default_style: TextStyle | null
  is_global: boolean
  created_at: string
}

// Extended types with relations
export interface SceneWithPanels extends Scene {
  panels: Panel[]
}

export interface SceneWithChoices extends Scene {
  choices: Choice[]
}

export interface StoryWithScenes extends Story {
  scenes: SceneWithPanels[]
}

// Input types for creating/updating
export interface CreateStoryInput {
  title: string
  description?: string
  cover_image?: string
}

export interface CreateSceneInput {
  story_id: string
  title: string
  image_url: string
  image_width: number
  image_height: number
  order_index: number
  is_start_scene?: boolean
  is_decision_scene?: boolean
}

export interface CreatePanelInput {
  scene_id: string
  shape: Panel['shape']
  x: number
  y: number
  width: number
  height: number
  points?: { x: number; y: number }[]
  brush_strokes?: { x: number; y: number; size: number }[]
  ellipse_data?: { centerX: number; centerY: number; rx: number; ry: number }
  order_index: number
}

export interface CreateChoiceInput {
  from_scene_id: string
  to_scene_id: string
  choice_text: string
  order_index?: number
}

// Panel Text Input Types
export interface CreatePanelTextInput {
  panel_id: string
  position_x: number
  position_y: number
  width?: number
  height?: number
  rotation?: number
  anchor?: string
  bubble_type?: BubbleType
  style?: Partial<TextStyle>
  name?: string
}

export interface CreatePanelTextContentInput {
  panel_text_id: string
  language: SupportedLanguage
  text: string
  style_override?: Partial<TextStyle>
}

export interface UpdatePanelTextInput {
  position_x?: number
  position_y?: number
  width?: number
  height?: number
  rotation?: number
  anchor?: string
  bubble_type?: BubbleType
  bubble_tail_enabled?: boolean
  bubble_tail_direction?: string
  bubble_tail_position?: number
  bubble_tail_target_x?: number
  bubble_tail_target_y?: number
  style?: Partial<TextStyle>
  z_index?: number
  visible?: boolean
  locked?: boolean
  name?: string
}

// Extended types with text overlays
export interface PanelWithTexts extends Panel {
  texts: PanelText[]
}

export interface SceneWithPanelsAndTexts extends Scene {
  panels: PanelWithTexts[]
}

export interface StoryWithScenesAndTexts extends Story {
  scenes: SceneWithPanelsAndTexts[]
  languages?: StoryLanguage[]
}

// ─────────────────────────────────────────────────────────────────────────
// AUDIO TYPES
// ─────────────────────────────────────────────────────────────────────────

export type AudioType = 'background' | 'sfx' | 'voice' | 'ambient'

export interface StoryAudio {
  id: string
  story_id: string
  scene_id: string | null
  panel_id: string | null
  
  // Audio file info
  audio_url: string
  audio_name: string
  duration_ms: number | null
  file_size: number | null
  
  // Playback settings
  volume: number
  loop: boolean
  autoplay: boolean
  
  // Timing
  start_delay_ms: number
  fade_in_ms: number
  fade_out_ms: number
  
  // Type
  audio_type: AudioType
  
  // Ordering
  order_index: number
  
  // Meta
  created_at: string
  updated_at: string
}

export interface CreateStoryAudioInput {
  story_id: string
  scene_id?: string
  panel_id?: string
  audio_url: string
  audio_name: string
  duration_ms?: number
  file_size?: number
  volume?: number
  loop?: boolean
  autoplay?: boolean
  start_delay_ms?: number
  fade_in_ms?: number
  fade_out_ms?: number
  audio_type?: AudioType
  order_index?: number
}

export interface UpdateStoryAudioInput {
  audio_name?: string
  volume?: number
  loop?: boolean
  autoplay?: boolean
  start_delay_ms?: number
  fade_in_ms?: number
  fade_out_ms?: number
  audio_type?: AudioType
  order_index?: number
}

// ─────────────────────────────────────────────────────────────────────────
// SCENE POSITION TYPES (for Flow Editor)
// ─────────────────────────────────────────────────────────────────────────

export interface ScenePosition {
  id: string
  scene_id: string
  position_x: number
  position_y: number
  created_at: string
  updated_at: string
}

export interface CreateScenePositionInput {
  scene_id: string
  position_x: number
  position_y: number
}

export interface UpdateScenePositionInput {
  position_x?: number
  position_y?: number
}


