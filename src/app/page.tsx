import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BookOpen, Sparkles, Play, ChevronRight } from 'lucide-react'

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
    <div className="min-h-screen w-full bg-[#FAFAFA] text-gray-900 font-sans selection:bg-black selection:text-white flex flex-col">
      {/* Header */}
      <header className="flex-none px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between z-50 safe-area-top">
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
              className="px-4 sm:px-5 py-2 text-sm font-medium text-white bg-black rounded-full hover:bg-gray-800 active:scale-95 transition-all shadow-sm"
            >
              Giriş
            </Link>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative w-full overflow-hidden">
        
        {/* Background Typography - Hidden on mobile, visible on larger screens */}
        <div className="hidden lg:flex absolute inset-0 items-center justify-center pointer-events-none overflow-hidden">
          <h1 
            className="font-black tracking-tighter text-black/[0.03] select-none "
            style={{ fontSize: 'clamp(200px, 30vw, 500px)' }}
          >
            STORY
          </h1>
        </div>

        {/* Mobile Hero Section */}
        <div className="lg:hidden px-4 pt-4 pb-6">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 mb-2">
            Hikayeler
          </h1>
          <p className="text-gray-500 text-sm sm:text-base">
            İnteraktif hikayelerle kendinizi kaybedin
          </p>
        </div>

        {stories && stories.length > 0 ? (
          <>
            {/* Mobile Layout - Vertical scroll with cards */}
            <div className="lg:hidden flex-1 px-4 pb-8 space-y-4 overflow-y-auto">
              {stories.map((story, index) => {
                const startScene = story.scenes?.[0]
                const previewImage = startScene?.image_url || story.cover_image

                return (
                  <Link
                    key={story.id}
                    href={`/story/${story.id}`}
                    className="story-card block relative overflow-hidden rounded-2xl bg-black shadow-xl animate-fadeInUp"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    {/* Mobile Card */}
                    <div className="relative aspect-[16/10] sm:aspect-[16/9]">
                      {previewImage ? (
                        <>
                          <img
                            src={previewImage}
                            alt={story.title}
                            className="w-full h-full object-cover"
                            loading={index < 2 ? "eager" : "lazy"}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-800">
                          <BookOpen size={40} className="text-gray-600" />
                        </div>
                      )}

                      {/* Content overlay */}
                      <div className="absolute inset-0 p-4 sm:p-5 flex flex-col justify-end">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded text-[10px] sm:text-xs font-medium text-white border border-white/20">
                            STORY
                          </span>
                        </div>
                        
                        <h3 className="text-lg sm:text-xl font-bold text-white mb-1 line-clamp-2">
                          {story.title}
                        </h3>
                        
                        {story.description && (
                          <p className="text-sm text-gray-300 line-clamp-2 mb-3">
                            {story.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-medium text-white/80">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white text-black flex items-center justify-center">
                              <Play size={12} fill="currentColor" />
                            </div>
                            <span>BAŞLAT</span>
                          </div>
                          <ChevronRight size={20} className="text-white/50" />
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Desktop Layout - Horizontal scroll with phone mockups */}
            <div className="hidden lg:flex flex-1 items-center justify-center gap-8 px-8 overflow-x-auto no-scrollbar pb-8 pt-4">
              {stories.map((story) => {
                const startScene = story.scenes?.[0]
                const previewImage = startScene?.image_url || story.cover_image

                return (
                  <Link
                    key={story.id}
                    href={`/story/${story.id}`}
                    className="story-card relative flex-none"
                  >
                    {/* Phone Mockup Container */}
                    <div className="relative h-[60vh] xl:h-[65vh] aspect-[9/16] bg-black rounded-[2rem] border-[6px] border-gray-900 overflow-hidden shadow-2xl shadow-gray-200">

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
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-50">
                            <BookOpen size={40} className="text-gray-300" />
                          </div>
                        )}

                        {/* Info */}
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

                    {/* Shadow */}
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-32 h-2 bg-black/5 blur-md rounded-full" />
                  </Link>
                )
              })}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-300 rounded-3xl bg-white max-w-sm w-full">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <BookOpen size={28} className="text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Henüz hikaye yok</h3>
              <p className="text-gray-500 text-sm">Yakında harika hikayeler burada olacak.</p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="flex-none py-4 sm:py-6 text-center safe-area-bottom">
        <p className="text-[10px] uppercase tracking-widest text-gray-400">
          InStory Interactive Studio &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  )
}
