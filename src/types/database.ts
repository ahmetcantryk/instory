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

