import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import StoryReader from './StoryReader'
import type { StoryAudio } from '@/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function StoryPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Get story with scenes, panels, and panel texts
  const { data: story, error } = await supabase
    .from('stories')
    .select(`
      *,
      scenes (
        *,
        panels (
          *,
          panel_texts (
            *,
            panel_text_contents (*)
          )
        )
      )
    `)
    .eq('id', id)
    .eq('is_published', true)
    .single()

  if (error || !story) {
    notFound()
  }

  // Transform panel_texts to texts format expected by StoryReader
  // Supabase returns nested data with table names, we need to rename them
  if (story.scenes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    story.scenes = story.scenes.map((scene: any) => ({
      ...scene,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      panels: (scene.panels || []).map((panel: any) => {
        const panelTexts = panel.panel_texts || []
        return {
          ...panel,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          texts: panelTexts.map((pt: any) => ({
            ...pt,
            // Ensure numeric values are numbers (Supabase may return as strings)
            position_x: Number(pt.position_x),
            position_y: Number(pt.position_y),
            width: pt.width ? Number(pt.width) : null,
            height: pt.height ? Number(pt.height) : null,
            rotation: Number(pt.rotation) || 0,
            z_index: Number(pt.z_index) || 0,
            contents: pt.panel_text_contents || []
          }))
        }
      })
    }))
    
    // Debug: Log text counts
    let totalTexts = 0
    story.scenes.forEach((scene: { panels?: { texts?: unknown[] }[] }) => {
      (scene.panels || []).forEach((panel: { texts?: unknown[] }) => {
        totalTexts += (panel.texts || []).length
      })
    })
    console.log('[StoryPage] Total texts loaded:', totalTexts)
  }

  // Get story languages
  const { data: languages } = await supabase
    .from('story_languages')
    .select('language, is_primary')
    .eq('story_id', id)
  
  if (languages && languages.length > 0) {
    story.languages = languages
  }

  // Get choices for all scenes
  const sceneIds = story.scenes?.map((s: { id: string }) => s.id) || []
  
  let choices: { id: string; from_scene_id: string; to_scene_id: string; choice_text: string; order_index: number }[] = []
  if (sceneIds.length > 0) {
    const { data: choicesData } = await supabase
      .from('choices')
      .select('*')
      .in('from_scene_id', sceneIds)
      .order('order_index')
    
    choices = choicesData || []
  }

  // Get story audios
  const { data: audiosData } = await supabase
    .from('story_audio')
    .select('*')
    .eq('story_id', id)
    .order('order_index')
  
  const audios: StoryAudio[] = (audiosData || []).map(a => ({
    ...a,
    volume: Number(a.volume),
    start_delay_ms: Number(a.start_delay_ms) || 0,
    fade_in_ms: Number(a.fade_in_ms) || 0,
    fade_out_ms: Number(a.fade_out_ms) || 0,
  }))

  console.log('[StoryPage] Total audios loaded:', audios.length)

  return <StoryReader story={story} choices={choices} audios={audios} />
}
