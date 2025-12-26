# InStory - Geliştirme Rehberi

> Bu proje, `@comic-panel-toolkit/core` NPM paketini kullanarak interaktif hikaye okuma deneyimi sunan bir Next.js uygulamasıdır.

## 📁 Proje Yapısı

```
instory/
├── src/
│   ├── app/
│   │   ├── story/[id]/          # Hikaye okuma sayfası
│   │   │   ├── page.tsx         # Server component
│   │   │   └── StoryReader.tsx  # Client component (okuyucu)
│   │   ├── panel/               # Panel editör dashboard
│   │   │   ├── page.tsx
│   │   │   ├── PanelDashboard.tsx
│   │   │   └── flow/[storyId]/  # Hikaye akış editörü
│   │   └── login/               # Auth sayfası
│   ├── lib/supabase/            # Supabase client config
│   └── types/                   # TypeScript tip tanımları
└── package.json
```

## 🔗 comic-panel-toolkit ile Entegrasyon

### Kurulu Paket
```json
"@comic-panel-toolkit/core": "^0.2.0"
```

### NPM Paket Modülleri

| Modül | Açıklama | Kullanım Alanı |
|-------|----------|----------------|
| `PanelManager` | Panel CRUD işlemleri | Panel oluşturma/düzenleme |
| `FocusCalculator` | Focus mode için transform hesaplama | StoryReader |
| `ReadingOrder` | Okuma sırası (manga/comic) | Panel sıralama |
| `HistoryManager` | Undo/redo yönetimi | Editör |
| `BrowserImageLoader` | Görsel yükleme (browser) | Upload işlemleri |
| `BrowserArchiveLoader` | CBZ/ZIP yükleme | Toplu yükleme |
| `renderPanel`, `renderBrushStroke` | Canvas rendering | Panel önizleme |
| `generateBrushCursor` | Dinamik cursor | Brush tool |
| `mergePanels`, `addShapeToPanel` | Panel birleştirme | Editör |

### Import Örnekleri

```typescript
// Browser-specific (önerilen)
import { 
  PanelManager,
  FocusCalculator,
  BrowserImageLoader,
  renderPanel,
  generateBrushCursor
} from '@comic-panel-toolkit/core/browser';

// Genel (platform-agnostic)
import { 
  PanelManager,
  HistoryManager,
  ReadingOrder,
  mergePanels
} from '@comic-panel-toolkit/core';

// Tipler
import type { 
  Panel, 
  BrushPoint, 
  PageData,
  FocusTransform 
} from '@comic-panel-toolkit/core';
```

## 🛠️ Geliştirme Akışı

### 1. Yeni Özellik Ekleme

```
┌─────────────────────────────────────────────────────────────┐
│  1. comic-npm paketinde feature geliştir                    │
│     └─ C:\src\developer\comic\comic-npm\src\               │
│                                                             │
│  2. Build al: npm run build                                 │
│                                                             │
│  3. instory'de kullan ve test et                           │
│     └─ C:\src\developer\comic\instory\                     │
│                                                             │
│  4. Gerekirse npm paketini güncelle (iterasyon)            │
│                                                             │
│  5. Stable olunca npm publish                              │
└─────────────────────────────────────────────────────────────┘
```

### 2. Lokal Geliştirme (npm link)

```powershell
# comic-npm klasöründe
cd C:\src\developer\comic\comic-npm
npm link

# instory klasöründe
cd C:\src\developer\comic\instory
npm link @comic-panel-toolkit/core
```

## 📋 Yapılacaklar (Roadmap)

### ✅ Tamamlanan
- [x] Temel StoryReader komponenti
- [x] Focus mode (panel odaklanma)
- [x] Panel-to-panel okuma modu
- [x] Fullscreen desteği
- [x] Choice/branching sistemi
- [x] Supabase entegrasyonu
- [x] Panel editör (rectangle, ellipse, freeform, brush)
- [x] StoryFlowEditor (ReactFlow ile hikaye akış görselleştirme)
- [x] **Text Overlay Sistemi** (Aralık 2024)
  - [x] panel_texts, panel_text_contents, story_languages tabloları
  - [x] Çok dilli metin desteği (13 dil)
  - [x] TextEditor bileşeni (bubble types, font/color/style)
  - [x] StoryReader'da text overlay render
  - [x] Supabase RLS politikaları

### 🔄 Devam Eden
- [ ] Panel birleştirme (merge) özelliği
- [ ] Multi-page yönetimi
- [ ] comic-npm entegrasyonu

### 📌 Planlanan
- [ ] Okuma geçmişi kaydetme
- [ ] Offline desteği (PWA)
- [ ] Export (JSON/CBZ)
- [ ] Collaborative editing
- [ ] Bubble tail (konuşma balonu kuyruğu) çizimi

## 🔧 Sık Kullanılan Komutlar

```powershell
# instory geliştirme
cd C:\src\developer\comic\instory
npm run dev

# comic-npm build
cd C:\src\developer\comic\comic-npm
npm run build

# comic-npm watch mode
npm run dev

# Her iki projeyi paralel çalıştır (ayrı terminallerde)
# Terminal 1: cd C:\src\developer\comic\comic-npm; npm run dev
# Terminal 2: cd C:\src\developer\comic\instory; npm run dev
```

## 📝 Notlar

- `instory` projesinde `@comic-panel-toolkit/core` paketi GitHub Pages üzerinden yayınlanan npm registry'den alınıyor
- Lokal geliştirme için `npm link` kullanılabilir
- Browser-specific özellikler için `/browser` entry point'i kullanılmalı
- Node.js-specific özellikler (sharp, unzipper) sadece `/node` entry point'inde mevcut

---

*Son güncelleme: Haziran 2025*
