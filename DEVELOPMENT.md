# 📖 InStory - Geliştirme Rehberi

> **AI Asistan İçin Referans Dokümanı**
> Bu doküman, InStory projesiyle çalışırken referans alınması gereken teknik detayları, mimariyi ve kuralları içerir.

---

## 🏗️ Proje Yapısı

```
instory/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API Routes
│   │   ├── auth/callback/route.ts    # Supabase Auth callback
│   │   ├── login/page.tsx            # Giriş sayfası
│   │   ├── panel/                    # Panel yönetimi
│   │   │   ├── page.tsx              # Panel Dashboard ana sayfa
│   │   │   ├── PanelDashboard.tsx    # Dashboard bileşeni
│   │   │   └── flow/[storyId]/       # Hikaye akış editörü
│   │   │       ├── page.tsx          # SSR veri çekimi
│   │   │       └── StoryFlowEditor.tsx # ReactFlow editör
│   │   ├── story/[id]/               # Hikaye okuma
│   │   │   ├── page.tsx              # SSR veri çekimi
│   │   │   └── StoryReader.tsx       # Ana okuyucu bileşeni
│   │   ├── globals.css               # Global stiller
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Ana sayfa
│   ├── components/                   # Paylaşılan bileşenler
│   │   ├── AudioManager.tsx          # Ses yönetim arayüzü
│   │   └── TextEditor.tsx            # Panel metin düzenleyici
│   ├── lib/
│   │   └── supabase/                 # Supabase client'ları
│   │       ├── client.ts             # Browser client
│   │       ├── server.ts             # Server client
│   │       └── middleware.ts         # Auth middleware helper
│   ├── types/
│   │   └── database.ts               # Tüm TypeScript tipleri
│   └── middleware.ts                 # Next.js middleware
├── supabase/
│   └── migrations/                   # Veritabanı migration'ları
├── public/                           # Statik dosyalar
├── package.json
└── tsconfig.json
```

---

## 🗄️ Veritabanı Şeması

### Ana Tablolar

| Tablo | Açıklama |
|-------|----------|
| `stories` | Hikaye meta verileri |
| `scenes` | Sahne/sayfa bilgileri + görsel URL |
| `panels` | Panel koordinatları ve şekil verileri |
| `choices` | Sahne bağlantıları (karar noktaları) |
| `panel_texts` | Panel üzerindeki metin kutuları |
| `panel_text_contents` | Metin içerikleri (çoklu dil) |
| `story_languages` | Hikayenin desteklediği diller |
| `story_audios` | Ses dosyaları ve ayarları |
| `scene_positions` | ReactFlow node pozisyonları |

### Tip Tanımları (`src/types/database.ts`)

```typescript
// Ana tipler
Story, Scene, Panel, Choice
PanelText, PanelTextContent
StoryLanguage, StoryAudio
ScenePosition

// Desteklenen diller
type SupportedLanguage = 'tr' | 'en' | 'ja' | 'ko' | 'zh' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'ar' | 'he'

// Panel şekilleri
type PanelShape = 'rectangle' | 'polygon' | 'ellipse' | 'brush'

// Balon tipleri
type BubbleType = 'speech' | 'thought' | 'shout' | 'whisper' | 'narration' | 'caption' | 'sfx' | 'none'

// Ses tipleri
type AudioType = 'background' | 'sfx' | 'voice' | 'ambient'
```

---

## 🎨 UI/UX Kuralları

### Genel Stiller

- **Tema**: Dark theme (siyah/koyu tonlar)
- **Accent**: Turuncu (#f97316, orange-500)
- **Glass efekti**: `glass-dark` class'ı kullan
- **Animasyonlar**: Smooth transitions (300ms default)

### CSS Değişkenleri (globals.css)

```css
:root {
  --min-touch-target: 44px;    /* Touch hedef minimum boyut */
  --safe-area-top: env(safe-area-inset-top);
  --safe-area-bottom: env(safe-area-inset-bottom);
}

/* Glass efekti */
.glass-dark {
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(12px);
}
```

### Responsive Breakpoints

```typescript
const screenSize = useMemo(() => {
  if (viewportWidth < 640) return 'xs'      // Mobile
  if (viewportWidth < 768) return 'sm'      // Tablet portrait
  if (viewportWidth < 1024) return 'md'     // Tablet landscape
  if (viewportWidth < 1280) return 'lg'     // Desktop
  return 'xl'                               // Large desktop
}, [viewportWidth])
```

### Önemli CSS Kuralları

```css
/* Reader ve TextEditor içindeki görseller için max-width devre dışı */
.reader-container img, .reader-container video,
.text-editor-panel img, .text-editor-panel video {
  max-width: none !important;
}
```

---

## 📱 Okuma Modları (StoryReader.tsx)

### 1. Focus Mode
- Tek panel görünür
- Panel'e zoom yapılır
- Sol/sağ tıkla veya swipe ile gezinme

### 2. Panel-to-Panel Mode
- Tüm paneller progresif reveal
- Her adımda bir panel daha görünür olur
- Okuma yönüne göre sıralama

### Kontroller

| Konum | İçerik |
|-------|--------|
| Sol üst | Mod değiştirme butonları |
| Sağ üst | Dil seçici, Ses kontrolü, Fullscreen, Kapat |
| Alt | İlerleme çubuğu |

### Klavye Kısayolları

```typescript
'ArrowLeft' / 'ArrowUp'     → Önceki panel
'ArrowRight' / 'ArrowDown'  → Sonraki panel
'Home'                      → İlk panel
'End'                       → Son panel
'F'                         → Fullscreen toggle
'Escape'                    → Çık / Seçimleri kapat
'M'                         → Focus/P2P mod değiştir
'L'                         → Dil menüsü aç/kapa
'S'                         → Sesi aç/kapat (mute)
```

---

## 🔊 Ses Sistemi

### Ses Kapsamları (Scope)

1. **Story Level**: Tüm hikaye boyunca çalar (loop genelde true)
2. **Scene Level**: O sahne aktifken çalar
3. **Panel Level**: O panel görünürken çalar

### AudioManager Özellikleri

- Görsel önizleme paneli (sağ taraf)
- Scope bazlı sekme yapısı (Story/Scene/Panel)
- Ses kütüphanesi (yeniden kullanım)
- Per-audio ayarlar: volume, loop, autoplay, fade in/out, delay

### StoryReader'da Ses

```typescript
// Master ses kontrolü
const [isMuted, setIsMuted] = useState(false)
const [masterVolume, setMasterVolume] = useState(1)

// Aktif sesler yönetimi
const activeAudiosRef = useRef<Map<string, ActiveAudio>>(new Map())
```

---

## 🌐 Çoklu Dil Sistemi

### Metin Yapısı

```
PanelText (pozisyon, stil, balon tipi)
  └── PanelTextContent[] (dil başına içerik)
        ├── language: 'tr' → text: "Merhaba"
        ├── language: 'en' → text: "Hello"
        └── style_override: {...} (dil bazlı stil farkları)
```

### style_override Alanları (Dil Bazlı)

```typescript
interface StyleOverride extends TextStyle {
  __position_x?: number    // Dil bazlı X konumu
  __position_y?: number    // Dil bazlı Y konumu
  __width?: number         // Dil bazlı genişlik
  __bubble_type?: BubbleType // Dil bazlı balon tipi
}
```

### Dil Değişim Akışı (Reader)

1. Kullanıcı dil butonu tıklar
2. `currentLanguage` state güncellenir
3. TextOverlayRenderer key değişir → re-render
4. İlgili dildeki içerikler smooth fade ile görünür

---

## 🔄 ReactFlow Entegrasyonu (StoryFlowEditor)

### Node Pozisyon Kaydetme

```typescript
// Debounced save
const saveNodePositions = useCallback(
  debounce(async (nodes: Node[]) => {
    for (const node of changedNodes) {
      await supabase
        .from('scene_positions')
        .upsert({
          scene_id: node.id,
          position_x: node.position.x,
          position_y: node.position.y
        })
    }
  }, 1000),
  []
)
```

---

## 🛠️ Geliştirme Kuralları

### 1. Supabase Kullanımı

```typescript
// Client tarafı
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()

// Server tarafı (SSR)
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
```

### 2. Tip Güvenliği

- Tüm veritabanı tipleri `src/types/database.ts`'de tanımlı
- Yeni tablo/alan → önce tip tanımla, sonra kullan
- `as any` kullanma, doğru tip tanımla

### 3. Bileşen Yapısı

```typescript
'use client'  // İnteraktif bileşenler için zorunlu

// page.tsx → SSR data fetching
// Component.tsx → Client component logic
```

### 4. Görsel İşleme

- Görseller Supabase Storage'da
- Public bucket: `story-images`, `story-audios`
- URL: `supabase.storage.from('bucket').getPublicUrl('path')`

### 5. State Yönetimi

- Basit state: `useState`
- Computed değerler: `useMemo`
- Callback'ler: `useCallback`
- Side effects: `useEffect`
- DOM referansları: `useRef`

---

## 📦 Bağımlılıklar

| Paket | Versiyon | Kullanım |
|-------|----------|----------|
| `next` | 16.1.0 | Framework |
| `react` | 19.2.3 | UI Library |
| `@supabase/ssr` | 0.8.0 | Auth & SSR |
| `@supabase/supabase-js` | 2.89.0 | Database client |
| `reactflow` | 11.11.4 | Flow editor |
| `lucide-react` | 0.562.0 | İkonlar |
| `tailwindcss` | 4.x | Styling |
| `@comic-panel-toolkit/core` | 0.2.0 | Panel utilities |

---

## ⚠️ Bilinen Sorunlar ve Çözümler

### 1. Görsel max-width Sorunu
**Sorun**: Tailwind'in default `max-width: 100%` kuralı zoom/pan'ı bozuyor
**Çözüm**: `.reader-container img { max-width: none !important; }`

### 2. Çift Tanım Hatası
**Sorun**: `currentPanel` gibi değişkenlerin birden fazla tanımı
**Çözüm**: Duplicate `useMemo` tanımlarını kaldır

### 3. Node Pozisyon Kaybolması
**Sorun**: ReactFlow node'ları refresh'te resetleniyor
**Çözüm**: `scene_positions` tablosuna kaydet/yükle

---

## 🚀 Komutlar

```bash
# Geliştirme sunucusu
npm run dev

# Production build
npm run build

# Linting
npm run lint
```

---

## 📝 Notlar

- **Dil**: Türkçe kullanıcı arayüzü
- **Tema**: Dark mode default
- **Terminal**: PowerShell kullan
- **Tarayıcı testi**: Yapma (kullanıcı isteği)"
- **Responsive**: Mobile-first yaklaşım
- **Ses**: Web Audio API + HTML5 Audio

---

*Son güncelleme: Ocak 2026*
