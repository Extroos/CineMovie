/**
 * CINE-MOVIE UNIFIED WORKER v1.2.4 (STABLE)
 * All-in-one: Scraper + Proxy + Defense + VidSrc Fix
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type, Bypass-Tunnel-Reminder',
    };

    if (request.method === 'OPTIONS' || request.method === 'HEAD') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (path === '/proxy') return handleProxy(request, corsHeaders);
    if (path === '/home') return handleHome(corsHeaders);
    if (path === '/search') return handleSearch(url, corsHeaders);
    if (path.startsWith('/info/')) return handleInfo(path.split('/').pop(), corsHeaders);
    if (path.startsWith('/episodes/')) return handleEpisodes(path.split('/').pop(), corsHeaders);
    if (path.startsWith('/servers/')) return handleServers(path.split('/').pop(), corsHeaders);
    if (path === '/sources') return handleSources(url, corsHeaders, request);

    // VIDSRC Integration
    if (path.startsWith('/vidsrc/')) return handleVidSrc(path, corsHeaders);

    // KITSUNE BACKWARD COMPAT
    if (path.startsWith('/anime/')) {
        const id = path.split('/')[2];
        if (path.endsWith('/episodes')) return handleEpisodes(id, corsHeaders);
        return handleInfo(id, corsHeaders);
    }
    if (path === '/episode/servers') return handleServers(url.searchParams.get('animeEpisodeId'), corsHeaders);
    if (path === '/episode/sources') return handleSources(url, corsHeaders, request);

    if (path === '/') return new Response(JSON.stringify({ status: 'READY', v: '1.2.4' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response('404', { status: 404, headers: corsHeaders });
  }
};

async function fetchHtml(url) {
    const domains = ['https://hianimez.to', 'https://hianime.to'];
    for (const d of domains) {
        try {
            const res = await fetch(`${d}${url}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36', 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (res.ok) return await res.text();
        } catch(e) {}
    }
    throw new Error("Failed to fetch from all mirrors");
}

async function handleHome(headers) {
    try {
        const html = await fetchHtml('/home');
        const spotlight = [];
        const spotMatches = [...html.matchAll(/<div class="swiper-slide spotlight-item">[\s\S]*?src="(.+?)"[\s\S]*?class="des-title">[\s\S]*?href="\/(.+?)"[\s\S]*?>(.+?)<\/a>/g)];
        for (const m of spotMatches) spotlight.push({ id: m[2], poster: m[1], name: m[3] });

        const trending = [];
        const trendMatches = [...html.matchAll(/<div class="item">[\s\S]*?src="(.+?)"[\s\S]*?class="film-poster-ahref" href="\/(.+?)" title="(.+?)"/g)];
        for (const m of trendMatches) trending.push({ id: m[2], poster: m[1], name: m[3] });

        const latest = [];
        const latMatches = [...html.matchAll(/<div class="flw-item">[\s\S]*?href="\/(.+?)"[\s\S]*?src="(.+?)"[\s\S]*?class="dynamic-name"[\s\S]*?>(.+?)<\/a>/g)];
        for (const m of latMatches) latest.push({ id: m[1], poster: m[2], name: m[3] });

        return new Response(JSON.stringify({ 
            data: { 
                spotlightAnimes: spotlight, 
                trendingAnimes: trending.slice(0, 10), 
                latestEpisodeAnimes: latest.slice(0, 12),
                topUpcomingAnimes: [] 
            } 
        }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500, headers }); }
}

async function handleSearch(url, headers) {
    const q = url.searchParams.get('q');
    try {
        const html = await fetchHtml(`/search?keyword=${encodeURIComponent(q || '')}`);
        const animes = [];
        const matches = [...html.matchAll(/<div class="flw-item">[\s\S]*?href="\/(.+?)"[\s\S]*?src="(.+?)"[\s\S]*?class="dynamic-name"[\s\S]*?>(.+?)<\/a>/g)];
        for (const m of matches) animes.push({ id: m[1], poster: m[2], name: m[3] });
        return new Response(JSON.stringify({ data: { animes } }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500, headers }); }
}

async function handleInfo(id, headers) {
    try {
        const html = await fetchHtml(`/${id}`);
        const name = html.match(/<h2 class="film-name dynamic-name".*?>(.*?)<\/h2>/)?.[1] || 'Unknown';
        const poster = html.match(/<img class="film-poster-img" src="(.*?)"/)?.[1] || '';
        const desc = html.match(/<div class="text">(.*?)<\/div>/)?.[1]?.split('<br>')[0]?.replace(/<[^>]*>/g, '').trim() || '';
        const rating = html.match(/<div class="tick-item tick-pg">(.*?)<\/div>/)?.[1] || '0';
        const quality = html.match(/<div class="tick-item tick-quality">(.*?)<\/div>/)?.[1] || 'HD';
        const subCount = html.match(/<div class="tick-item tick-sub">.*?(\d+).*?<\/div>/)?.[1] || '0';
        const dubCount = html.match(/<div class="tick-item tick-dub">.*?(\d+).*?<\/div>/)?.[1] || '0';
        const genres = [...html.matchAll(/<a href="\/genre\/.+?>(.*?)<\/a>/g)].map(m => m[1]);

        return new Response(JSON.stringify({ 
            data: { 
                anime: { 
                    info: { id, name, poster, description: desc, stats: { rating, quality, episodes: { sub: parseInt(subCount), dub: parseInt(dubCount) } }, charactersVoiceActors: [], recommendedAnimes: [] },
                    moreInfo: { genres, status: 'Unknown', aired: 'Unknown', studios: 'Unknown' }
                } 
            } 
        }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500, headers }); }
}

async function handleEpisodes(id, headers) {
    try {
        const numericId = id.split('-').pop();
        const res = await fetch(`https://hianime.to/ajax/v2/episode/list/${numericId}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const json = await res.json();
        const episodes = [];
        const matches = [...(json.html || '').matchAll(/data-id="(.+?)"[\s\S]*?data-number="(.+?)"[\s\S]*?title="(.+?)"/g)];
        for (const m of matches) episodes.push({ episodeId: m[1], number: parseInt(m[2]), title: m[3] });
        return new Response(JSON.stringify({ data: { episodes } }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500, headers }); }
}

async function handleServers(id, headers) {
    try {
        const res = await fetch(`https://hianime.to/ajax/v2/episode/servers?episodeId=${id}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const json = await res.json();
        const sub = [];
        const matches = [...(json.html || '').matchAll(/data-id="([0-9]+)"[^>]*>([^<]+)/g)];
        for (const m of matches) sub.push({ id: m[1], name: m[2].trim().toLowerCase() });
        return new Response(JSON.stringify({ data: { sub, dub: [] } }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500, headers }); }
}

async function handleSources(url, headers, request) {
    const epId = url.searchParams.get('episodeId') || url.searchParams.get('animeEpisodeId');
    const server = url.searchParams.get('serverId') || url.searchParams.get('server') || 'vidcloud';
    try {
        const serRes = await fetch(`https://hianime.to/ajax/v2/episode/servers?episodeId=${epId}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const serJson = await serRes.json();
        const match = [...(serJson.html || '').matchAll(/data-id="([0-9]+)"[^>]*>([^<]+)/g)].find(m => m[2].toLowerCase().includes(server));
        const id = match ? match[1] : null; if (!id) throw new Error("No server");

        const souRes = await fetch(`https://hianime.to/ajax/v2/episode/sources?id=${id}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const souJson = await souRes.json();
        const videoId = souJson.link.split('/').pop()?.split('?')[0];

        const apiRes = await fetch(`https://megacloud.tv/embed-2/ajax/e-1/getSources?id=${videoId}`, { headers: { 'Referer': 'https://hianime.to/' } });
        const data = await apiRes.json();
        
        const workerUrl = new URL(request.url).origin;
        if (data.sources) {
            data.sources = data.sources.map(s => ({ ...s, url: `${workerUrl}/proxy?url=${encodeURIComponent(s.file)}&referer=${encodeURIComponent('https://hianime.to/')}` }));
        }
        return new Response(JSON.stringify({ data }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500, headers }); }
}

async function handleVidSrc(path, headers) {
    try {
        // Path mapping for VidSrc.icu API
        let targetPath = path.replace('/vidsrc', '');
        
        // Fix routes: /movie/1 -> /api/latest/movie/1
        if (targetPath.startsWith('/movie/')) targetPath = `/api/movie/latest${targetPath.replace('/movie', '')}`;
        if (targetPath.startsWith('/tv/')) targetPath = `/api/tv/latest${targetPath.replace('/tv', '')}`;
        if (targetPath.startsWith('/episodes/')) targetPath = `/api/episode/latest${targetPath.replace('/episodes', '')}`;
        
        const res = await fetch(`https://vidsrc.icu${targetPath}`);
        const data = await res.json();
        return new Response(JSON.stringify(data), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500, headers }); }
}

async function handleProxy(request, headers) {
    const url = new URL(request.url).searchParams.get('url');
    if (!url) return new Response('No URL', { status: 400 });
    const referer = new URL(request.url).searchParams.get('referer');

    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36', 'Referer': referer || 'https://hianime.to/' }
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
