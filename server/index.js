import './patch.js';
import express from 'express';
import cors from 'cors';
import { HiAnime } from 'aniwatch';
import axios from 'axios';
import os from 'os';

const app = express();
const PORT = process.env.PORT || 3001;

// ... (Rest of the file remains same, but now uses the patched axios/fetch)
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
      console.log(`[Proxy 1.1.4] Fetching Sources (Manual): ${id} | Server: ${serverId}`);
      
      const data = await getSourcesManual(id, String(serverId));
      
      if (data && data.sources && Array.isArray(data.sources)) {
          const selfUrl = getInternalSelfUrl(req);
          // Standard headers for HiAnime
          const referer = 'https://hianime.to/';
          const agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';
          
          data.sources = data.sources.map((src) => ({
              ...src,
              // Proxied version (for PC browsers)
              url: `${selfUrl}/proxy?url=${encodeURIComponent(src.url)}&referer=${encodeURIComponent(referer)}&user_agent=${encodeURIComponent(agent)}`,
              // Original version (for Native mobile bypass)
              originalUrl: src.url,
              headers: { 
                  'Referer': referer, 
                  'User-Agent': agent,
                  'Origin': 'https://hianime.to'
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
      vercel: !!process.env.VERCEL,
      proxy: process.env.PRIVATE_PROXY_URL ? 'Private (Cloudflare)' : 'Public (AllOrigins)'
  });
});

app.get('/debug/proxy-test', async (req, res) => {
    try {
        const testUrl = 'https://hianime.to/ajax/v2/episode/servers?episodeId=121408';
        const data = await fetchViaProxy(testUrl);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- MANUAL SCRAPER UTILITIES (For Cloud Bypass) ---
import crypto from 'crypto';

const MECACLOUD_URLS = {
    script: "https://megacloud.tv/js/player/a/prod/e1-player.min.js?v=",
    sources: "https://megacloud.tv/embed-2/ajax/e-1/getSources?id="
};

async function fetchViaProxy(url, options = {}) {
    const privateProxy = process.env.PRIVATE_PROXY_URL;
    let proxyUrl;
    
    if (privateProxy) {
        // Use user's private Cloudflare Worker
        const base = privateProxy.endsWith('/') ? privateProxy.slice(0, -1) : privateProxy;
        proxyUrl = `${base}?url=${encodeURIComponent(url)}`;
        console.log(`[PrivateProxy] ${url}`);
    } else {
        // Fallback to AllOrigins (public, often blocked)
        proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        console.log(`[PublicProxy] ${url}`);
    }

    const res = await fetch(proxyUrl, options);
    const data = await res.json();
    
    const content = data.contents || data.result; // Handle different proxy response formats
    if (!content) throw new Error("No contents from proxy");
    
    try {
        return typeof content === 'string' ? JSON.parse(content) : content;
    } catch (e) {
        return content;
    }
}

async function extractMegaCloud(videoUrl) {
    try {
        const videoId = videoUrl.split('/').pop()?.split('?')[0];
        console.log(`[ManualScraper] Extracting MegaCloud: ${videoId}`);
        
        const srcsData = await fetchViaProxy(`${MECACLOUD_URLS.sources}${videoId}`);
        if (!srcsData || !srcsData.sources) throw new Error("Failed to get MegaCloud sources");

        if (!srcsData.encrypted && Array.isArray(srcsData.sources)) {
            return {
                sources: srcsData.sources.map(s => ({ url: s.file, type: s.type })),
                tracks: srcsData.tracks || [],
                intro: srcsData.intro,
                outro: srcsData.outro
            };
        }

        const scriptText = await fetchViaProxy(`${MECACLOUD_URLS.script}${Date.now()}`);

        const regex = /case\s*0x[0-9a-f]+:(?![^;]*=partKey)\s*\w+\s*=\s*(\w+)\s*,\s*\w+\s*=\s*(\w+);/g;
        const matches = [...scriptText.matchAll(regex)];
        const vars = matches.map(match => {
            const findKey = (key) => {
                const r = new RegExp(`var ${key}\\s*=\\s*([^,;]+)`, 'g');
                return r.exec(scriptText)?.[1];
            };
            return [parseInt(findKey(match[1]), 16), parseInt(findKey(match[2]), 16)];
        }).filter(v => v.length > 0);

        if (!vars.length) throw new Error("Failed to extract decryption variables");

        const getSecret = (encryptedString, values) => {
            let secret = "", encryptedSource = "", encryptedSourceArray = encryptedString.split(""), currentIndex = 0;
            for (const index of values) {
                const start = index[0] + currentIndex;
                const end = start + index[1];
                for (let i = start; i < end; i++) {
                    secret += encryptedString[i];
                    encryptedSourceArray[i] = "";
                }
                currentIndex += index[1];
            }
            encryptedSource = encryptedSourceArray.join("");
            return { secret, encryptedSource };
        };

        const { secret, encryptedSource } = getSecret(srcsData.sources, vars);
        
        const decrypt = (encrypted, secret) => {
            const cypher = Buffer.from(encrypted, "base64");
            const salt = cypher.subarray(8, 16);
            const password = Buffer.concat([Buffer.from(secret, "binary"), salt]);
            const md5Hashes = [];
            let digest = password;
            for (let i = 0; i < 3; i++) {
                md5Hashes[i] = crypto.createHash("md5").update(digest).digest();
                digest = Buffer.concat([md5Hashes[i], password]);
            }
            const key = Buffer.concat([md5Hashes[0], md5Hashes[1]]);
            const iv = md5Hashes[2];
            const contents = cypher.subarray(16);
            const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
            let decrypted = decipher.update(contents, "binary", "utf8");
            decrypted += decipher.final("utf8");
            return decrypted;
        };

        const decrypted = decrypt(encryptedSource, secret);
        const sources = JSON.parse(decrypted);

        return {
            sources: sources.map(s => ({ url: s.file, type: s.type })),
            tracks: srcsData.tracks || [],
            intro: srcsData.intro,
            outro: srcsData.outro
        };
    } catch (err) {
        console.error("[ManualScraper] MegaCloud failed:", err.message);
        throw err;
    }
}

async function getSourcesManual(episodeId, serverName = "vidcloud") {
    const domains = ["https://hianime.to", "https://hianimez.to"];
    let lastErr;

    for (const domain of domains) {
        try {
            const epNumericId = episodeId.split('=')[1] || episodeId;
            console.log(`[ManualScraper] Scraping ${domain} for Ep: ${epNumericId}`);

            const serversData = await fetchViaProxy(`${domain}/ajax/v2/episode/servers?episodeId=${epNumericId}`);
            if (!serversData || !serversData.html) continue;
            
            const html = serversData.html;
            const serverMatches = [...html.matchAll(/data-id="([0-9]+)"[^>]*>([^<]+)/g)];
            const servers = serverMatches.map(m => ({ id: m[1], name: m[2].trim().toLowerCase() }));
            
            const targetServer = servers.find(s => s.name.includes(serverName.toLowerCase())) || servers[0];
            if (!targetServer) continue;

            const sourceData = await fetchViaProxy(`${domain}/ajax/v2/episode/sources?id=${targetServer.id}`);
            if (!sourceData) continue;
            
            if (sourceData.type === 'iframe') {
                return await extractMegaCloud(sourceData.link);
            }
            
            return sourceData;
        } catch (err) {
            lastErr = err;
            console.warn(`[ManualScraper] ${domain} failed:`, err.message);
        }
    }
    
    throw lastErr || new Error("All domains failed in manual scraper");
}

app.get('/test-patch', async (req, res) => {
    try {
        console.log('[TestPatch] Triggering Manual Scrape...');
        const data = await getSourcesManual('121408', 'vidcloud');
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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
        const data = await getSourcesManual(
            String(animeEpisodeId), 
            String(server || 'vidcloud')
        );
        
        if (data && data.sources && Array.isArray(data.sources)) {
            const selfUrl = getInternalSelfUrl(req);
            const referer = 'https://hianime.to/';
            const agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';
            
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
