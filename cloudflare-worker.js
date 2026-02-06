/**
 * CINE-MOVIE UNIFIED WORKER v1.2.1
 * All-in-one: HiAnime Scraper + VidSrc + HLS Proxy
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Standard CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type, Bypass-Tunnel-Reminder',
    };

    // Support HEAD for health checks
    if (request.method === 'OPTIONS' || request.method === 'HEAD') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    // --- 1. PROXY UTILITY ---
    if (path === '/proxy') return handleProxy(request, corsHeaders);

    // --- 2. HIANIME ROUTES ---
    if (path === '/home') return handleHome(corsHeaders);
    if (path === '/search') return handleSearch(url, corsHeaders);
    if (path.startsWith('/info/')) return handleInfo(path.split('/').pop(), corsHeaders);
    if (path.startsWith('/episodes/')) return handleEpisodes(path.split('/').pop(), corsHeaders);
    if (path.startsWith('/servers/')) return handleServers(path.split('/').pop(), corsHeaders);
    if (path === '/sources') return handleSources(url, corsHeaders, request);

    // --- 3. VIDSRC ROUTES ---
    if (path.startsWith('/vidsrc/')) return handleVidSrc(path, corsHeaders);

    // --- 4. COMPATIBILITY & LEGACY ---
    if (path.startsWith('/anime/')) {
        const id = path.split('/')[2];
        if (path.endsWith('/episodes')) return handleEpisodes(id, corsHeaders);
        return handleInfo(id, corsHeaders);
    }
    if (path === '/episode/servers') return handleServers(url.searchParams.get('animeEpisodeId'), corsHeaders);
    if (path === '/episode/sources') return handleSources(url, corsHeaders, request);

    // Default
    if (path === '/') {
        return new Response(JSON.stringify({ status: 'Unified Worker Active', v: '1.2.1' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};

// --- SCRAPER HELPERS ---

async function fetchHtml(url, referer = 'https://hianime.to/') {
    const res = await fetch(url.startsWith('http') ? url : `https://hianimez.to${url}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Referer': referer,
            'X-Requested-With': 'XMLHttpRequest'
        }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
}

async function handleHome(headers) {
    try {
        const html = await fetchHtml('/home');
        
        // Extraction
        const extract = (regex) => {
            const results = [];
            const matches = [...html.matchAll(regex)];
            for (const m of matches) results.push({ id: m[1], poster: m[2], name: m[3] });
            return results;
        };

        const spotlight = extract(/<div class="des-title">[\s\S]*?href="\/(.+?)"[\s\S]*?src="(.+?)"[\s\S]*?>(.+?)<\/a>/g);
        const trending = extract(/<div class="number">[\s\S]*?href="\/(.+?)"[\s\S]*?src="(.+?)"[\s\S]*?title="(.+?)"/g);
        const latest = extract(/<div class="flw-item">[\s\S]*?data-id="(.+?)"[\s\S]*?src="(.+?)"[\s\S]*?class="dynamic-name"[\s\S]*?>(.+?)<\/a>/g);

        return new Response(JSON.stringify({ 
            data: { spotlightAnimes: spotlight, trendingAnimes: trending, latestEpisodeAnimes: latest, topUpcomingAnimes: [] } 
        }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
}

async function handleSearch(url, headers) {
    const q = url.searchParams.get('q');
    try {
        const html = await fetchHtml(`/search?keyword=${encodeURIComponent(q || '')}`);
        const animes = [];
        const matches = [...html.matchAll(/<div class="flw-item">[\s\S]*?data-id="(.+?)"[\s\S]*?src="(.+?)"[\s\S]*?class="dynamic-name"[\s\S]*?>(.+?)<\/a>/g)];
        for (const m of matches) animes.push({ id: m[1], poster: m[2], name: m[3] });
        return new Response(JSON.stringify({ data: { animes } }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
}

async function handleInfo(id, headers) {
    try {
        const html = await fetchHtml(`/${id}`);
        const name = html.match(/<h2 class="film-name dynamic-name".*?>(.*?)<\/h2>/)?.[1] || 'Unknown';
        const poster = html.match(/<img class="film-poster-img" src="(.*?)"/)?.[1] || '';
        const desc = html.match(/<div class="text">(.*?)<\/div>/)?.[1]?.replace(/<[^>]*>/g, '') || '';
        
        return new Response(JSON.stringify({ 
            data: { anime: { info: { id, name, poster, description: desc } } } 
        }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
}

async function handleEpisodes(id, headers) {
    try {
        const numericId = id.split('-').pop();
        const res = await fetch(`https://hianimez.to/ajax/v2/episode/list/${numericId}`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://hianimez.to/' }
        });
        const json = await res.json();
        const html = json.html || '';
        const episodes = [];
        const matches = [...html.matchAll(/data-id="(.+?)"[\s\S]*?data-number="(.+?)"[\s\S]*?title="(.+?)"/g)];
        for (const m of matches) episodes.push({ episodeId: m[1], number: parseInt(m[2]), title: m[3] });
        return new Response(JSON.stringify({ data: { episodes } }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
}

async function handleServers(id, headers) {
    try {
        const res = await fetch(`https://hianimez.to/ajax/v2/episode/servers?episodeId=${id}`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://hianimez.to/' }
        });
        const json = await res.json();
        const html = json.html || '';
        const sub = [];
        const matches = [...html.matchAll(/data-id="([0-9]+)"[^>]*>([^<]+)/g)];
        for (const m of matches) sub.push({ id: m[1], name: m[2].trim().toLowerCase() });
        return new Response(JSON.stringify({ data: { sub, dub: [] } }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
}

async function handleSources(url, headers, request) {
    const epId = url.searchParams.get('episodeId') || url.searchParams.get('animeEpisodeId');
    const server = url.searchParams.get('serverId') || url.searchParams.get('server') || 'vidcloud';
    try {
        // 1. Get server id
        const serRes = await fetch(`https://hianimez.to/ajax/v2/episode/servers?episodeId=${epId}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const serJson = await serRes.json();
        const html = serJson.html || '';
        const match = [...html.matchAll(/data-id="([0-9]+)"[^>]*>([^<]+)/g)].find(m => m[2].toLowerCase().includes(server));
        const id = match ? match[1] : null; if (!id) throw new Error("Server not found");

        // 2. Get sources
        const souRes = await fetch(`https://hianimez.to/ajax/v2/episode/sources?id=${id}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const souJson = await souRes.json();
        const embedUrl = souJson.link;
        const videoId = embedUrl.split('/').pop()?.split('?')[0];

        // 3. Get direct m3u8
        const apiRes = await fetch(`https://megacloud.tv/embed-2/ajax/e-1/getSources?id=${videoId}`, { headers: { 'Referer': 'https://hianime.to/' } });
        const data = await apiRes.json();
        
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
    const target = `https://vidsrc.icu${path.replace('/vidsrc', '')}`;
    try {
        const res = await fetch(target);
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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Referer': referer || 'https://hianime.to/'
        }
    });

    const contentType = res.headers.get('Content-Type');
    if (url.includes('.m3u8') || (contentType && contentType.includes('mpegurl'))) {
        let text = await res.text();
        const base = url.split('/').slice(0, -1).join('/');
        const workerUrl = new URL(request.url).origin;
        text = text.split('\n').map(l => {
            if (l.startsWith('#') || !l.trim()) return l;
            return `${workerUrl}/proxy?url=${encodeURIComponent(l.startsWith('http') ? l : `${base}/${l}`)}&referer=${encodeURIComponent(referer || '')}`;
        }).join('\n');
        return new Response(text, { headers: { ...headers, 'Content-Type': contentType } });
    }

    return new Response(res.body, { status: res.status, headers: { ...headers, 'Content-Type': contentType } });
}
