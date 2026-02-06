/**
 * CINE-MOVIE UNIFIED WORKER v1.2.5 (ELITE STABILITY)
 * Fixes CORS, 503/500 crashes, and VidSrc routing.
 */

export default {
    async fetch(request, env, ctx) {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
            'Access-Control-Allow-Headers': 'Content-Type, Bypass-Tunnel-Reminder',
        };

        // Standard Utility: Always send CORS
        const respond = (data, status = 200, extraHeaders = {}) => {
            return new Response(typeof data === 'string' ? data : JSON.stringify(data), {
                status,
                headers: { 
                    ...corsHeaders, 
                    'Content-Type': extraHeaders['Content-Type'] || 'application/json',
                    ...extraHeaders 
                }
            });
        };

        try {
            const url = new URL(request.url);
            const path = url.pathname;

            if (request.method === 'OPTIONS' || request.method === 'HEAD') {
                return new Response(null, { status: 200, headers: corsHeaders });
            }

            // --- 1. PROXY ---
            if (path === '/proxy') return handleProxy(request, respond);

            // --- 2. HIANIME ---
            if (path === '/home') return handleHome(respond);
            if (path === '/search') return handleSearch(url, respond);
            if (path.startsWith('/info/')) return handleInfo(path.split('/').pop(), respond);
            if (path.startsWith('/episodes/')) return handleEpisodes(path.split('/').pop(), respond);
            if (path.startsWith('/servers/')) return handleServers(path.split('/').pop(), respond);
            if (path === '/sources') return handleSources(url, request, respond);

            // --- 3. VIDSRC ---
            if (path.startsWith('/vidsrc/')) return handleVidSrc(path, respond);

            // --- 4. COMPAT ---
            if (path.startsWith('/anime/')) {
                const id = path.split('/')[2];
                if (path.endsWith('/episodes')) return handleEpisodes(id, respond);
                return handleInfo(id, respond);
            }
            if (path === '/episode/servers') return handleServers(url.searchParams.get('animeEpisodeId'), respond);
            if (path === '/episode/sources') return handleSources(url, request, respond);

            if (path === '/') return respond({ status: 'ACTIVE', v: '1.2.5' });
            return respond({ error: 'Not Found' }, 404);

        } catch (e) {
            return respond({ error: 'Runtime Error', message: e.message, stack: e.stack }, 500);
        }
    }
};

// --- SCRAPER HELPERS ---

async function fetchHtml(url) {
    const domains = ['https://hianime.to', 'https://hianimez.to'];
    let lastErr;
    for (const d of domains) {
        try {
            const res = await fetch(`${d}${url}`, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36', 
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': d
                },
                signal: AbortSignal.timeout(8000)
            });
            if (res.ok) return await res.text();
        } catch(e) { lastErr = e; }
    }
    throw new Error(`Upstream connection failed: ${lastErr?.message}`);
}

async function handleHome(respond) {
    try {
        const html = await fetchHtml('/home');
        
        const extract = (regex) => {
            const results = [];
            const matches = [...html.matchAll(regex)];
            for (const m of matches) results.push({ id: m[2], poster: m[1], name: m[3] });
            return results;
        };

        const spotlight = extract(/<div class="swiper-slide spotlight-item">[\s\S]*?src="(.+?)"[\s\S]*?class="des-title">[\s\S]*?href="\/(.+?)"[\s\S]*?>(.+?)<\/a>/g);
        const trending = extract(/<div class="item">[\s\S]*?src="(.+?)"[\s\S]*?class="film-poster-ahref" href="\/(.+?)" title="(.+?)"/g);
        const latest = extract(/<div class="flw-item">[\s\S]*?href="\/(.+?)"[\s\S]*?src="(.+?)"[\s\S]*?class="dynamic-name"[\s\S]*?>(.+?)<\/a>/g);

        return respond({ 
            data: { 
                spotlightAnimes: spotlight, 
                trendingAnimes: trending.slice(0, 10), 
                latestEpisodeAnimes: latest.slice(0, 12),
                topUpcomingAnimes: [] 
            } 
        });
    } catch (e) { return respond({ error: e.message }, 500); }
}

async function handleSearch(url, respond) {
    const q = url.searchParams.get('q');
    try {
        const html = await fetchHtml(`/search?keyword=${encodeURIComponent(q || '')}`);
        const animes = [];
        const matches = [...html.matchAll(/<div class="flw-item">[\s\S]*?href="\/(.+?)"[\s\S]*?src="(.+?)"[\s\S]*?class="dynamic-name"[\s\S]*?>(.+?)<\/a>/g)];
        for (const m of matches) animes.push({ id: m[1], poster: m[2], name: m[3] });
        return respond({ data: { animes } });
    } catch (e) { return respond({ error: e.message }, 500); }
}

async function handleInfo(id, respond) {
    try {
        const html = await fetchHtml(`/${id}`);
        const name = html.match(/<h2 class="film-name dynamic-name".*?>(.*?)<\/h2>/)?.[1] || 'Unknown';
        const poster = html.match(/<img class="film-poster-img" src="(.*?)"/)?.[1] || '';
        const desc = html.match(/<div class="text">(.*?)<\/div>/)?.[1]?.split('<br>')[0]?.replace(/<[^>]*>/g, '').trim() || '';
        
        const subCount = html.match(/<div class="tick-item tick-sub">.*?(\d+).*?<\/div>/)?.[1] || '0';
        const dubCount = html.match(/<div class="tick-item tick-dub">.*?(\d+).*?<\/div>/)?.[1] || '0';
        const quality = html.match(/<div class="tick-item tick-quality">(.*?)<\/div>/)?.[1] || 'HD';
        const rating = html.match(/<div class="tick-item tick-pg">(.*?)<\/div>/)?.[1] || 'PG-13';

        return respond({ 
            data: { 
                anime: { 
                    info: { id, name, poster, description: desc, stats: { rating, quality, episodes: { sub: parseInt(subCount), dub: parseInt(dubCount) } }, charactersVoiceActors: [], recommendedAnimes: [] },
                    moreInfo: { genres: [], status: 'Released', aired: 'Unknown', studios: 'Unknown' }
                } 
            } 
        });
    } catch (e) { return respond({ error: e.message }, 500); }
}

async function handleEpisodes(id, respond) {
    try {
        const numericId = id.split('-').pop();
        const res = await fetch(`https://hianime.to/ajax/v2/episode/list/${numericId}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const json = await res.json();
        const episodes = [];
        const matches = [...(json.html || '').matchAll(/data-id="(.+?)"[\s\S]*?data-number="(.+?)"[\s\S]*?title="(.+?)"/g)];
        for (const m of matches) episodes.push({ episodeId: m[1], number: parseInt(m[2]), title: m[3] });
        return respond({ data: { episodes } });
    } catch (e) { return respond({ error: e.message }, 500); }
}

async function handleServers(id, respond) {
    try {
        const res = await fetch(`https://hianime.to/ajax/v2/episode/servers?episodeId=${id}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const json = await res.json();
        const sub = [];
        const matches = [...(json.html || '').matchAll(/data-id="([0-9]+)"[^>]*>([^<]+)/g)];
        for (const m of matches) sub.push({ id: m[1], name: m[2].trim().toLowerCase() });
        return respond({ data: { sub, dub: [] } });
    } catch (e) { return respond({ error: e.message }, 500); }
}

async function handleSources(url, request, respond) {
    const epId = url.searchParams.get('episodeId') || url.searchParams.get('animeEpisodeId');
    const server = url.searchParams.get('serverId') || url.searchParams.get('server') || 'vidcloud';
    try {
        const serRes = await fetch(`https://hianime.to/ajax/v2/episode/servers?episodeId=${epId}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const serJson = await serRes.json();
        const match = [...(serJson.html || '').matchAll(/data-id="([0-9]+)"[^>]*>([^<]+)/g)].find(m => m[2].toLowerCase().includes(server));
        const sId = match ? match[1] : null; if (!sId) throw new Error("No server found");

        const souRes = await fetch(`https://hianime.to/ajax/v2/episode/sources?id=${sId}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const souJson = await souRes.json();
        const videoId = souJson.link.split('/').pop()?.split('?')[0];

        const apiRes = await fetch(`https://megacloud.tv/embed-2/ajax/e-1/getSources?id=${videoId}`, { headers: { 'Referer': 'https://hianime.to/' } });
        const data = await apiRes.json();
        
        const workerUrl = new URL(request.url).origin;
        if (data.sources) {
            data.sources = data.sources.map(s => ({ ...s, url: `${workerUrl}/proxy?url=${encodeURIComponent(s.file)}&referer=${encodeURIComponent('https://hianime.to/')}` }));
        }
        return respond({ data });
    } catch (e) { return respond({ error: e.message }, 500); }
}

async function handleVidSrc(path, respond) {
    try {
        // Path mapping: /vidsrc/movie/1 -> https://vidsrc.icu/api/movie/latest/1
        let target = path.replace('/vidsrc', '');
        if (target.startsWith('/movie/')) target = `/api/movie/latest${target.replace('/movie', '')}`;
        else if (target.startsWith('/tv/')) target = `/api/tv/latest${target.replace('/tv', '')}`;
        else if (target.startsWith('/episodes/')) target = `/api/episode/latest${target.replace('/episodes', '')}`;
        
        const res = await fetch(`https://vidsrc.icu${target}`);
        const text = await res.text();
        try {
            return respond(JSON.parse(text));
        } catch (je) {
            return respond(text, 200, { 'Content-Type': 'text/plain' });
        }
    } catch (e) { return respond({ error: e.message }, 500); }
}

async function handleProxy(request, respond) {
    const url = new URL(request.url).searchParams.get('url');
    if (!url) return respond({ error: 'No URL' }, 400);
    const referer = new URL(request.url).searchParams.get('referer');

    try {
        const res = await fetch(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36', 
                'Referer': referer || 'https://hianime.to/' 
            },
            signal: AbortSignal.timeout(15000)
        });

        const contentType = res.headers.get('Content-Type');
        if (url.includes('.m3u8') || (contentType && contentType.includes('mpegurl'))) {
            let text = await res.text();
            const base = url.split('/').slice(0, -1).join('/');
            const workerUrl = new URL(request.url).origin;
            text = text.split('\n').map(l => {
                if (l.startsWith('#') || !l.trim()) return l;
                const abs = l.startsWith('http') ? l : `${base}/${l}`;
                return `${workerUrl}/proxy?url=${encodeURIComponent(abs)}&referer=${encodeURIComponent(referer || '')}`;
            }).join('\n');
            return respond(text, 200, { 'Content-Type': contentType });
        }
        
        return new Response(res.body, { 
            status: res.status, 
            headers: { 
                'Access-Control-Allow-Origin': '*',
                'Content-Type': contentType 
            } 
        });
    } catch (e) { return respond({ error: e.message }, 500); }
}
