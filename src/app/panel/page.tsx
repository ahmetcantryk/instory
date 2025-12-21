import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PanelDashboard from './PanelDashboard'

export default async function PanelPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user's stories
  const { data: stories } = await supabase
    .from('stories')
    .select(`
      *,
      scenes (
        *,
        panels (*)
      )
    `)
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })

  // Get all choices for user's stories
  const storyIds = stories?.map(s => s.id) || []
  let choices: { id: string; from_scene_id: string; to_scene_id: string; choice_text: string; order_index: number }[] = []
  
  if (storyIds.length > 0) {
    const sceneIds = stories?.flatMap(s => s.scenes?.map((sc: { id: string }) => sc.id) || []) || []
    if (sceneIds.length > 0) {
      const { data: choicesData } = await supabase
        .from('choices')
        .select('*')
        .in('from_scene_id', sceneIds)
      choices = choicesData || []
    }
  }

  return <PanelDashboard initialStories={stories || []} initialChoices={choices} userId={user.id} />
}

