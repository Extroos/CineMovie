# AI Agent Guide: Integrating Kitsune

This guide is for AI agents (like yourself) to help you understand, use, and integrate the Kitsune anime streaming project into other applications.

## 🏗️ Project Architecture

Kitsune is a Next.js 15 (App Router) application that scrapes anime data from HiAnime via the `aniwatch` library and streams it using `Artplayer` and `HLS.js`.

### Core Backend (Pocketbase)

- Handles user authentication, favorites (bookmarks), and watch history.
- Schema: See `docs/pb.json`.
- Client: `src/lib/pocketbase.ts`.

### Proxy Server

- Essential for bypassing CORS on streaming links.
- Uses `proxy-m3u8` to relay `.m3u8` and `.ts` files.
- Configured in `.env` as `NEXT_PUBLIC_PROXY_URL`.

## 📦 Key Components for Fusion

### 1. `KitsunePlayer` (`src/components/kitsune-player.tsx`)

The most complex and critical component. It handles:

- **Artplayer Initialization:** Full-featured HTML5 player.
- **HLS Integration:** Loads `.m3u8` streams via `hls.js`.
- **CORS Proxy:** Wraps video and subtitle URLs automatically.
- **Watch History:** Syncs progress to Pocketbase every 10s.
- **Auto-Skip:** Skips intros/outros based on metadata.

**Usage:**

```tsx
<KitsunePlayer
  episodeInfo={/* IEpisodeSource */}
  animeInfo={{ title, image, id }}
  subOrDub="sub"
  serversData={/* IEpisodeServers */}
/>
```

### 2. `AnimeCard` (`src/components/anime-card.tsx`)

Standardized card for displaying anime with progress bars and badges (sub/dub/episodes).

### 3. `HeroSection` (`src/components/hero-section.tsx`)

A stunning spotlight carousel for featured anime.

## 🌐 API Endpoints

| Route                      | Description                                       |
| :------------------------- | :------------------------------------------------ |
| `/api/home`                | Fetches spotlight, trending, and latest anime.    |
| `/api/anime/[id]`          | Fetches detailed metadata for a specific anime.   |
| `/api/anime/[id]/episodes` | Lists all episodes for an anime.                  |
| `/api/episode/servers`     | Lists available streaming servers for an episode. |
| `/api/episode/sources`     | **[CRITICAL]** Fetches actual streaming links.    |

## ⚠️ Known Issues & Integration Gotchas

1.  **Upstream Scraper Issue:** The `aniwatch` library currently faces a "Failed extracting client key" error on `/api/episode/sources`. This is due to changes on the source website (HiAnime).
2.  **Dependencies:** Ensure to install `artplayer`, `hls.js`, `aniwatch`, `pocketbase`, `lucide-react`, and `framer-motion`.
3.  **Tailwind Mix:** This app uses `shadcn/ui`. If fusing into a non-Tailwind app, you'll need to adapt the styles or include Tailwind.
4.  **Environment Variables:** Always define `NEXT_PUBLIC_PROXY_URL` and `NEXT_PUBLIC_POCKETBASE_URL`.

## 🚀 How to Fuse

1.  **Copy Sources:** Migration should focus on `src/components`, `src/lib`, `src/hooks`, and `src/app/api`.
2.  **Types:** Copy `src/types` to ensure type safety across the new app.
3.  **Context/Stores:** If using auth, integrate `src/store/auth-store`.
4.  **API Integration:** Ensure the target app has a working Next.js API layer or similar backend to house the scrapers.
