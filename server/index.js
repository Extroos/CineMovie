import express from 'express';
import cors from 'cors';
import { HiAnime } from 'aniwatch';
import axios from 'axios';
import os from 'os';

const app = express();
const PORT = process.env.PORT || 3001;

// RETRY HELPER
const withRetry = async (fn, attempts = 3, delay = 1000) => {
    let lastError = null;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            console.warn(`[Kitsune] Attempt ${i + 1}/${attempts} failed: ${err.message}`);
            if (i < attempts - 1) await new Promise(r => setTimeout(r, delay));
        }
    }
    throw lastError;
};

const corsOptions = {
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Bypass-Tunnel-Reminder']
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());

// Diagnostic Header
app.use((req, res, next) => {
    res.setHeader('X-Proxy-Version', '1.1.4');
    console.log(`[Proxy 1.1.4] ${req.method} ${req.url}`);
    next();
});

const hianime = new HiAnime.Scraper();

// Utility for internal recursion (M3U8 segments)
const getInternalSelfUrl = (req) => {
    let host = req.get('x-forwarded-host') || req.get('host') || '';
    const protocol = req.get('x-forwarded-proto') || (req.protocol === 'https' ? 'https' : 'http');
    
    // CRITICAL: Force use of cloud domain if we are clearly on Vercel but host is localhost or missing
    if (process.env.VERCEL || host.includes('vercel.app')) {
        if (host.includes('localhost') || !host) {
            host = 'server-blue-delta.vercel.app';
        }
    }
    
    return `${protocol}://${host}`;
};

// Discovery
app.get('/home', async (req, res) => {
  try {
    const data = await hianime.getHomePage();
    res.json({ data });
  } catch (err) {
    console.error('Home Page Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch home page', message: err.message });
  }
});

app.post('/import/anilist', async (req, res) => {
  try {
    const { animes } = req.body;
    if (!animes || !Array.isArray(animes)) return res.status(400).json({ error: 'Invalid anime list' });
    
    const mappedAnimes = [];
    for (const item of animes) {
        for (const entry of (item.entries || [])) {
            const title = entry.media?.title?.english;
            if (!title) continue;
            const search = await hianime.searchSuggestions(title);
            if (search.suggestions.length > 0) {
                mappedAnimes.push({
                    id: search.suggestions[0].id,
                    thumbnail: search.suggestions[0].poster,
                    title: search.suggestions[0].name,
                    status: item.status
                });
            }
        }
    }
    res.json({ data: mappedAnimes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/schedule', async (req, res) => {
  try {
    const { date } = req.query;
    const formattedDate = date 
      ? new Date(date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const data = await hianime.getEstimatedSchedule(formattedDate);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/sources', async (req, res) => {
  const { episodeId, serverId, category } = req.query;
  if (!episodeId || !serverId) return res.status(400).json({ error: 'Missing parameters' });

  const id = decodeURIComponent(String(episodeId));
  const maxRetries = 2;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Proxy 1.1.3] Fetching Sources (Attempt ${attempt}): ${id} | Server: ${serverId}`);
      
      const data = await hianime.getEpisodeSources(id, String(serverId), (category) || 'sub');
      
      if (data && data.sources && Array.isArray(data.sources)) {
          const selfUrl = getInternalSelfUrl(req);
          const headers = data.headers || {};
          const referer = headers.Referer || 'https://hianime.to/';
          const agent = headers['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';
          
          data.sources = data.sources.map((src) => ({
              ...src,
              // Proxied version (for PC browsers)
              url: `${selfUrl}/proxy?url=${encodeURIComponent(src.url)}&referer=${encodeURIComponent(referer)}&user_agent=${encodeURIComponent(agent)}`,
              // Original version (for Native mobile bypass)
              originalUrl: src.url,
              headers: { 
                  'Referer': referer, 
                  'User-Agent': agent,
                  'Origin': (() => {
                      try { return new URL(referer).origin; }
                      catch(e) { return 'https://hianime.to'; }
                  })()
              }
          }));
      }

      return res.json(data);
    } catch (err) {
      lastError = err;
      console.warn(`[Sources Attempt ${attempt} Failed]:`, err.message);
      if (attempt < maxRetries) {
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // If we get here, all retries failed
  try {
    const msg = lastError.message || '';
    console.error(`[Sources Error] ${id}:`, msg);
    
    // Detect typical scraper blocks / Vercel IP blocks
    const isBlock = msg.includes('Forbidden') || msg.includes('403') || msg.includes('cheerio') || msg.includes('client key');
    
    if (isBlock) {
        return res.status(403).json({
            error: 'Cloud IP Blocked',
            message: 'The cloud server IP is blocked by the anime provider. Please run your Local Anime Server (npm run dev) and connect in Settings.',
            isBlock: true
        });
    }

    res.status(500).json({ 
        error: 'Scraper failed after retries', 
        message: msg,
        id: id
    });
  } catch (finalErr) {
      res.status(500).json({ error: 'Fatal failure' });
  }
});

app.get('/', (req, res) => {
  res.json({ 
      status: 'Local Anime Proxy Running', 
      version: '1.1.4',
      time: new Date().toISOString(),
      vercel: !!process.env.VERCEL
  });
});

app.get('/check-version', (req, res) => {
    res.json({ version: '1.1.4', status: 'ready' });
});

app.get('/my-ip', (req, res) => {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(iface.address);
            }
        }
    }
    res.json({ ips, local: '127.0.0.1' });
});

// Proxy for HLS Streams (Manifests & Segments)
app.get('/proxy', async (req, res) => {
    const { url, referer, user_agent } = req.query;
    if (!url) return res.status(400).send('No URL provided');

    try {
        const selfUrl = getInternalSelfUrl(req);
        let urlObj;
        let refererUrl = null;
        
        try {
            urlObj = new URL(url);
            if (referer) refererUrl = new URL(referer);
        } catch (e) {
            console.error('[Proxy] Invalid URL or Referer:', { url, referer });
            return res.status(400).send('Invalid URL or Referer');
        }
        
        const headers = {
            'Referer': referer || 'https://hianime.to/',
            'User-Agent': user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Origin': refererUrl ? `${refererUrl.protocol}//${refererUrl.host}` : (urlObj ? urlObj.origin : 'https://hianime.to/'),
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Fetch-Dest': 'video',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site',
            'Connection': 'keep-alive'
        };

        const isM3U8 = (url).includes('.m3u8') || 
                       (req.query.contentType && req.query.contentType.includes('mpegurl')) || 
                       (req.query.contentType && req.query.contentType.includes('application/x-mpegURL')) ||
                       (req.query.contentType && req.query.contentType.includes('application/vnd.apple.mpegurl'));

        const response = await axios.get(url, {
            headers,
            responseType: isM3U8 ? 'arraybuffer' : 'stream',
            timeout: 25000
        });

        let contentType = response.headers['content-type'] || 'application/octet-stream';
        // Force text/vtt for subtitles to ensure they render
        if (url.includes('.vtt')) contentType = 'text/vtt';
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', contentType);
        
        // Pass through other useful headers
        if (response.headers['content-length']) res.setHeader('Content-Length', response.headers['content-length']);
        if (response.headers['accept-ranges']) res.setHeader('Accept-Ranges', response.headers['accept-ranges']);

        if (isM3U8) {
            let content = Buffer.from(response.data).toString();
            const baseUrl = new URL(url);
            
            // 1. First rewrite any URI="https://..." tags (Keys, Subtitles, alternative manifests)
            content = content.replace(/URI=["']([^"']+)["']/g, (match, innerUrl) => {
                try {
                    const absoluteUrl = new URL(innerUrl, baseUrl).href;
                    return `URI="${selfUrl}/proxy?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer || 'https://hianime.to/')}&user_agent=${encodeURIComponent(user_agent || '')}"`;
                } catch (e) { return match; }
            });

            // 2. Then rewrite the actual segment lines (non-tags)
            const modifiedData = content.split('\n').map(line => {
                const trimmed = line.trim();
                // Ignore empty lines or lines that are now ALREADY proxied 
                // (or comments that aren't segments)
                if (!trimmed || trimmed.startsWith('#')) return line;
                
                try {
                    const absoluteUrl = new URL(trimmed, baseUrl).href;
                    return `${selfUrl}/proxy?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer || 'https://hianime.to/')}&user_agent=${encodeURIComponent(user_agent || '')}`;
                } catch (e) {
                    return line;
                }
            }).join('\n');
            
            return res.send(modifiedData);
        }

        // Segment files (.ts, .vtt, images) are PIPED directly
        const fileName = (url).split('/').pop()?.split('?')[0] || 'segment';
        console.log(`[Proxy] Streaming: ${fileName} (${contentType})`);
        response.data.pipe(res);
    } catch (error) {
        console.error('Proxy error:', error.message);
        if (!res.headersSent) {
            res.status(500).send('Proxy error: ' + error.message);
        }
    }
});

// Standard Search/Info/Episodes
app.get('/search', async (req, res) => {
    try {
        const data = await hianime.search(String(req.query.q), parseInt(req.query.page) || 1);
        res.json({ data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/info/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const data = await hianime.getInfo(id);
        res.json({ data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/episodes/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const data = await hianime.getEpisodes(id);
        res.json({ data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/servers/:id', async (req, res) => {
    try {
        let id = req.params.id;
        if (req.query.ep) id = `${id}?ep=${req.query.ep}`;
        const data = await hianime.getEpisodeServers(id);
        res.json({ data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// KITSUNE COMPATIBILITY ROUTES
app.get('/anime/:id/episodes', async (req, res) => {
    try {
        const id = req.params.id;
        const data = await withRetry(() => hianime.getEpisodes(id));
        res.json({ data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/anime/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const data = await withRetry(() => hianime.getInfo(id));
        res.json({ data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});




app.get('/episode/servers', async (req, res) => {
    try {
        const id = req.query.animeEpisodeId;
        if (!id) return res.status(400).json({ error: 'Missing animeEpisodeId' });
        const decodedId = decodeURIComponent(String(id));
        const data = await withRetry(() => hianime.getEpisodeServers(decodedId));
        res.json({ data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/episode/sources', async (req, res) => {
    const { animeEpisodeId, server, category } = req.query;
    if (!animeEpisodeId) return res.status(400).json({ error: 'Missing animeEpisodeId' });
    
    console.log(`[Kitsune] Fetching Sources: ${animeEpisodeId} | Server: ${server}`);
    
    try {
        const data = await withRetry(() => hianime.getEpisodeSources(
            String(animeEpisodeId), 
            String(server || 'vidcloud'), 
            String(category || 'sub')
        ));
        
        if (data && data.sources && Array.isArray(data.sources)) {
            const selfUrl = getInternalSelfUrl(req);
            const headers = data.headers || {};
            const referer = headers.Referer || 'https://hianime.to/';
            const agent = headers['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';
            
            data.sources = data.sources.map((src) => ({
                ...src,
                url: `${selfUrl}/proxy?url=${encodeURIComponent(src.url)}&referer=${encodeURIComponent(referer)}&user_agent=${encodeURIComponent(agent)}`,
                originalUrl: src.url,
                headers: { 'Referer': referer, 'User-Agent': agent }
            }));
        }
        res.json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});




app.get('/search/suggestion', async (req, res) => {
    try {
        const data = await withRetry(() => hianime.search(String(req.query.q)));
        res.json({ data: { suggestions: data.animes || [] } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/search', async (req, res) => {
    try {
        const { q, page, type, status, rated, season, language, sort, genres } = req.query;
        const data = await withRetry(() => hianime.search(String(q || ''), Number(page || 1), {
            type, status, rated, season, language, sort, genres
        }));
        res.json({ data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/home', async (req, res) => {
    try {
        const data = await withRetry(() => hianime.getHomeContent());
        res.json({ data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/schedule', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: 'Missing date' });
        const data = await withRetry(() => hianime.getEstimatedSchedule(String(date)));
        res.json({ data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// Export for Vercel
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        const interfaces = os.networkInterfaces();
        const ips = [];
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    ips.push(iface.address);
                }
            }
        }

        console.log('-------------------------------------------');
        console.log(`🚀 ANIME PROXY v1.1.4 STARTED!`);
        console.log(`📡 Local: http://localhost:${PORT}`);
        ips.forEach(ip => {
            console.log(`🌐 Network: http://${ip}:${PORT}`);
        });
        console.log('-------------------------------------------');
        if (ips.length > 0) {
            console.log(`📱 Connect on phone using: http://${ips[0]}:${PORT}`);
        }
    });
}

export default app;
