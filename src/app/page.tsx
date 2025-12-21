import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BookOpen, Sparkles, Play } from 'lucide-react'

export default async function HomePage() {
  const supabase = await createClient()

  // Publis edilmiş ve başlangıç sahnesi olan hikayeleri getir
  const { data: stories } = await supabase
    .from('stories')
    .select(`
      *,
      scenes!inner (
        id,
        title,
        image_url,
        is_start_scene
      )
    `)
    .eq('is_published', true)
    .eq('scenes.is_start_scene', true)
    .order('created_at', { ascending: false })

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="h-screen w-full bg-[#FAFAFA] text-gray-900 font-sans selection:bg-black selection:text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-none px-6 py-5 flex items-center justify-between z-50">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-black text-white rounded-lg flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <span className="text-lg font-bold tracking-tight">InStory</span>
        </Link>

        <div>
          {!user && (
            <Link
              href="/login"
              className="px-5 py-2 text-sm font-medium text-white bg-black rounded-full hover:bg-gray-800 transition-colors shadow-sm"
            >
              Giriş
            </Link>
          )}
        </div>
      </header>

      {/* Main Studio Area */}
      <main className="flex-1 flex flex-col justify-center items-center relative w-full overflow-hidden">

        {/* Background Typography (Subtle) */}
        {/* Background Typography (Subtle) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.06]">
          <h1 className="text-[20vw] font-black tracking-tighter text-black">STORY</h1>
        </div>

        {stories && stories.length > 0 ? (
          <div className="w-full flex items-center justify-center gap-8 px-8 overflow-x-auto no-scrollbar pb-8 pt-4 h-full">
            {stories.map((story) => {
              const startScene = story.scenes?.[0]
              const previewImage = startScene?.image_url || story.cover_image

              return (
                <Link
                  key={story.id}
                  href={`/story/${story.id}`}
                  className="relative flex-none"
                >
                  {/* Phone Mockup Container */}
                  {/* h-[65vh] ensures it fits on screen nicely with header/footer */}
                  <div className="relative h-[65vh] aspect-[9/16] bg-black rounded-[2rem] border-[6px] border-gray-900 overflow-hidden shadow-2xl shadow-gray-200">

                    {/* Notch & Sensors */}
                    <div className="absolute top-0 inset-x-0 h-6 bg-transparent flex justify-center z-20">
                      <div className="w-24 h-5 bg-black rounded-b-xl" />
                    </div>

                    {/* Content Image */}
                    <div className="w-full h-full relative bg-gray-100">
                      {previewImage ? (
                        <>
                          <img
                            src={previewImage}
                            alt={story.title}
                            className="w-full h-full object-cover"
                          />
                          {/* Static Overlay - Always visible for readability */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-50">
                          <BookOpen size={40} className="text-gray-300" />
                        </div>
                      )}

                      {/* Info - Always Visible (No Hover) */}
                      <div className="absolute top-8 left-4 right-4 flex justify-between items-start z-10">
                        <div className="px-2 py-1 bg-white/20 backdrop-blur-md rounded text-[10px] font-medium text-white border border-white/20">
                          STORY
                        </div>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-6 text-white z-10">
                        <h3 className="text-xl font-bold leading-tight mb-2 drop-shadow-md">
                          {story.title}
                        </h3>
                        {story.description && (
                          <p className="text-sm text-gray-300 line-clamp-2 leading-relaxed opacity-90">
                            {story.description}
                          </p>
                        )}

                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-white/80">
                          <div className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center">
                            <Play size={10} fill="currentColor" />
                          </div>
                          <span>BAŞLAT</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reflection/Shadow fix */}
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-32 h-2 bg-black/5 blur-md rounded-full" />
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-300 rounded-3xl bg-white">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <BookOpen size={20} className="text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">Henüz içerik eklenmemiş.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="flex-none py-6 text-center">
        <p className="text-[10px] uppercase tracking-widest text-gray-400">
          InStory Interactive Studio &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  )
}
