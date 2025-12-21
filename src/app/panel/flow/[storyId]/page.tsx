import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StoryFlowEditor from './StoryFlowEditor'
import type { Scene, Choice, Panel } from '@/types/database'

interface SceneWithPanels extends Scene {
  panels: Panel[]
}

export default async function StoryFlowPage({ params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: story, error: storyError } = await supabase
    .from('stories')
    .select('*')
    .eq('id', storyId)
    .eq('author_id', user.id)
    .single()

  if (storyError || !story) {
    redirect('/panel')
  }

  const { data: scenes, error: scenesError } = await supabase
    .from('scenes')
    .select('*, panels(*)')
    .eq('story_id', storyId)
    .order('order_index', { ascending: true })

  const { data: choices, error: choicesError } = await supabase
    .from('choices')
    .select('*')

  if (scenesError || choicesError) {
    console.error('Error fetching data:', scenesError || choicesError)
  }

  const storyScenes: SceneWithPanels[] = scenes?.map(s => ({
    ...s,
    panels: s.panels || []
  })) || []

  const storyChoices: Choice[] = choices?.filter(c => 
    storyScenes.some(s => s.id === c.from_scene_id)
  ) || []

  return (
    <StoryFlowEditor 
      story={story} 
      initialScenes={storyScenes} 
      initialChoices={storyChoices}
    />
  )
}

