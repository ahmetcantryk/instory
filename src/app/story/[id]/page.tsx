import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import StoryReader from './StoryReader'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function StoryPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Get story with scenes and panels
  const { data: story, error } = await supabase
    .from('stories')
    .select(`
      *,
      scenes (
        *,
        panels (*)
      )
    `)
    .eq('id', id)
    .eq('is_published', true)
    .single()

  if (error || !story) {
    notFound()
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

  return <StoryReader story={story} choices={choices} />
}

