/**
 * CINE-MOVIE UNIFIED WORKER v1.2.0
 * All-in-one: HiAnime Scraper + VidSrc + HLS Proxy
 * Paste this into your Cloudflare Worker "Edit Code" section.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = request.headers.get('Origin');
    
    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Bypass-Tunnel-Reminder',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // --- 1. PROXY UTILITY (HLS Rewriting) ---
    if (path === '/proxy') {
      return handleProxy(request, corsHeaders);
    }

    // --- 2. HIANIME ROUTES ---
    if (path === '/home') return handleHome(corsHeaders);
    if (path === '/search') return handleSearch(url, corsHeaders);
    if (path === '/info' || path.startsWith('/info/')) return handleInfo(url, path, corsHeaders);
    if (path === '/episodes' || path.startsWith('/episodes/')) return handleEpisodes(url, path, corsHeaders);
    if (path === '/servers' || path.startsWith('/servers/')) return handleServers(url, path, corsHeaders);
    if (path === '/sources') return handleSources(url, corsHeaders, request);

    // --- 3. VIDSRC ROUTES ---
    if (path.startsWith('/vidsrc/')) return handleVidSrc(path, corsHeaders);

    // --- 4. KITSUNE COMPATIBILITY ---
    if (path.startsWith('/anime/')) {
        const id = path.split('/')[2];
        if (path.endsWith('/episodes')) return handleEpisodes(url, `/episodes/${id}`, corsHeaders);
        return handleInfo(url, `/info/${id}`, corsHeaders);
    }
    if (path === '/episode/servers') {
        const id = url.searchParams.get('animeEpisodeId');
        return handleServers(url, `/servers/${encodeURIComponent(id || '')}`, corsHeaders);
    }
    if (path === '/episode/sources') return handleSources(url, corsHeaders, request);

    // Status Check
    if (path === '/') {
        return new Response(JSON.stringify({
            status: 'CineMovie Unified Worker Active',
            version: '1.2.0',
            time: new Date().toISOString()
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};

// --- SCRAPER LOGIC ---

async function fetchWithRetry(url, options = {}, retries = 2) {
    const domains = ["https://hianime.to", "https://hianimez.to"];
    let lastErr;
    
    for (const domain of domains) {
        const targetUrl = url.startsWith('http') ? url : `${domain}${url.startsWith('/') ? '' : '/'}${url}`;
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(targetUrl, {
                    ...options,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                        'Referer': domain,
                        ...options.headers
                    }
                });
                if (res.ok) return res;
                if (res.status === 403) continue; // Try next domain
            } catch (e) {
                lastErr = e;
            }
        }
    }
    throw lastErr || new Error(`Failed to fetch ${url}`);
}

async function handleHome(headers) {
    try {
        const res = await fetchWithRetry('/home');
        const text = await res.text();
        
        // Very basic regex-based "spotlight" and "trending" extraction
        // In a real scenario, we'd port the full scraper. For now, let's focus on search and sources.
        // Return dummy or minimal home for now to verify connectivity
        return new Response(JSON.stringify({ 
            data: { spotlightAnimes: [], trendingAnimes: [], latestEpisodeAnimes: [], topUpcomingAnimes: [] } 
        }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
}

async function handleSearch(url, headers) {
    const q = url.searchParams.get('q');
    try {
        const res = await fetchWithRetry(`/search?keyword=${encodeURIComponent(q || '')}`);
        const html = await res.text();
        
        const animes = [];
        const matches = [...html.matchAll(/<div class="flw-item">[\s\S]*?data-id="(.+?)"[\s\S]*?src="(.+?)"[\s\S]*?class="dynamic-name"[\s\S]*?>(.+?)<\/a>/g)];
        
        for (const m of matches) {
            animes.push({ id: m[1], poster: m[2], name: m[3] });
        }
        
        return new Response(JSON.stringify({ data: { animes } }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
}

async function handleInfo(url, path, headers) {
    const id = path.split('/').pop();
    try {
        const res = await fetchWithRetry(`/${id}`);
        const html = await res.text();
        
        const nameMatch = html.match(/<h2 class="film-name dynamic-name".*?>(.*?)<\/h2>/);
        const posterMatch = html.match(/<img class="film-poster-img" src="(.*?)"/);
        const descMatch = html.match(/<div class="text">(.*?)<\/div>/);
        
        return new Response(JSON.stringify({ 
            data: { 
                anime: { 
                    info: { 
                        id, 
                        name: nameMatch ? nameMatch[1] : 'Unknown',
                        poster: posterMatch ? posterMatch[1] : '',
                        description: descMatch ? descMatch[1].replace(/<[^>]*>/g, '') : ''
                    } 
                } 
            } 
        }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
}

async function handleEpisodes(url, path, headers) {
    const id = path.split('/').pop();
    try {
        const res = await fetchWithRetry(`/ajax/v2/episode/list/${id.split('-').pop()}`);
        const json = await res.json(); // HiAnime returns JSON for episodes ajax
        
        const html = json.html || '';
        const episodes = [];
        const matches = [...html.matchAll(/data-id="(.+?)"[\s\S]*?data-number="(.+?)"[\s\S]*?title="(.+?)"/g)];
        
        for (const m of matches) {
            episodes.push({ episodeId: m[1], number: parseInt(m[2]), title: m[3] });
        }
        
        return new Response(JSON.stringify({ data: { episodes } }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
}

async function handleServers(url, path, headers) {
    const id = path.split('/').pop();
    try {
        const res = await fetchWithRetry(`/ajax/v2/episode/servers?episodeId=${id}`);
        const json = await res.json();
        
        const html = json.html || '';
        const sub = [];
        const matches = [...html.matchAll(/data-id="([0-9]+)"[^>]*>([^<]+)/g)];
        
        for (const m of matches) {
            sub.push({ id: m[1], name: m[2].trim().toLowerCase() });
        }
        
        return new Response(JSON.stringify({ data: { sub, dub: [] } }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
}

async function handleSources(url, headers, request) {
    const episodeId = url.searchParams.get('episodeId') || url.searchParams.get('animeEpisodeId');
    const serverName = url.searchParams.get('serverId') || url.searchParams.get('server') || 'vidcloud';
    
    try {
        // 1. Get Servers
        const serversRes = await fetchWithRetry(`/ajax/v2/episode/servers?episodeId=${episodeId}`);
        const serversJson = await serversRes.json();
        const html = serversJson.html || '';
        const serverMatches = [...html.matchAll(/data-id="([0-9]+)"[^>]*>([^<]+)/g)];
        const servers = serverMatches.map(m => ({ id: m[1], name: m[2].trim().toLowerCase() }));
        
        const targetServer = servers.find(s => s.name.includes(serverName.toLowerCase())) || servers[0];
        if (!targetServer) throw new Error("No servers found");

        // 2. Get Source Link (iframe)
        const sourcesRes = await fetchWithRetry(`/ajax/v2/episode/sources?id=${targetServer.id}`);
        const sourcesJson = await sourcesRes.json();
        const embedUrl = sourcesJson.link;
        if (!embedUrl) throw new Error("No embed link found");

        // 3. Extract MegaCloud (This logic needs to be simplified or use a fallback)
        // For brevity in the worker, we return the iframe link if extraction is complex,
        // but let's try a direct fetch of the sources from the embed supplier
        const videoId = embedUrl.split('/').pop()?.split('?')[0];
        const apiRes = await fetch(`https://megacloud.tv/embed-2/ajax/e-1/getSources?id=${videoId}`, {
            headers: { 'Referer': 'https://hianime.to/', 'X-Requested-With': 'XMLHttpRequest' }
        });
        const data = await apiRes.json();
        
        // Transform for Player
        const workerUrl = new URL(request.url).origin;
        if (data.sources) {
            data.sources = data.sources.map(s => ({
                ...s,
                url: `${workerUrl}/proxy?url=${encodeURIComponent(s.file)}&referer=${encodeURIComponent('https://hianime.to/')}`
            }));
        }
        
        return new Response(JSON.stringify({ data }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
}

async function handleVidSrc(path, headers) {
    // Basic VidSrc Mirror (Metadata Only)
    const targetUrl = `https://vidsrc.icu${path.replace('/vidsrc', '')}`;
    try {
        const res = await fetch(targetUrl);
        const data = await res.json();
        return new Response(JSON.stringify(data), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
}

async function handleProxy(request, headers) {
    const url = new URL(request.url).searchParams.get('url');
    const referer = new URL(request.url).searchParams.get('referer');
    if (!url) return new Response('No URL', { status: 400 });

    const res = await fetch(url, {
        headers: {
            'Referer': referer || 'https://hianime.to/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        }
    });

    const contentType = res.headers.get('Content-Type');
    const isM3U8 = url.includes('.m3u8') || (contentType && contentType.includes('mpegurl'));

    if (isM3U8) {
        let text = await res.text();
        const baseUrl = url.split('/').slice(0, -1).join('/');
        const workerUrl = new URL(request.url).origin;

        // Rewrite relative paths in M3U8
        text = text.split('\n').map(line => {
            if (line.startsWith('#') || !line.trim()) return line;
            const absLineUrl = line.startsWith('http') ? line : `${baseUrl}/${line}`;
            return `${workerUrl}/proxy?url=${encodeURIComponent(absLineUrl)}&referer=${encodeURIComponent(referer || '')}`;
        }).join('\n');

        return new Response(text, { headers: { ...headers, 'Content-Type': contentType } });
    }

    return new Response(res.body, { 
        status: res.status,
        headers: { ...headers, 'Content-Type': contentType } 
    });
}
