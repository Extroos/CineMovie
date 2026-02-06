/**
 * CINE-MOVIE UNIFIED WORKER v1.2.7 (ULTIMATE STABILITY)
 * Fixes CORS Preflight, 503 Timeouts, and JSON Parsing crashes.
 */

export default {
    async fetch(request, env, ctx) {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
            'Access-Control-Allow-Headers': 'Content-Type, Bypass-Tunnel-Reminder, X-Requested-With',
            'Access-Control-Max-Age': '86400',
        };

        // Utility: Unified response with guaranteed CORS
        const respond = (data, status = 200, type = 'application/json') => {
            return new Response(typeof data === 'string' ? data : JSON.stringify(data), {
                status,
                headers: { ...corsHeaders, 'Content-Type': type }
            });
        };

        // Handle Preflight & Health Checks instantly
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }
        
        // Rapid Health Check: if HEAD and hitting /home or /, just say OK
        if (request.method === 'HEAD') {
            return new Response(null, { status: 200, headers: corsHeaders });
        }

        try {
            const url = new URL(request.url);
            const path = url.pathname;

            // --- 1. PROXY ---
            if (path === '/proxy') return handleProxy(request, respond, corsHeaders);

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

            if (path === '/') return respond({ status: 'ACTIVE', v: '1.2.7' });
            return respond({ error: 'Not Found' }, 404);

        } catch (e) {
            return respond({ error: 'Worker Interior Error', message: e.message }, 500);
        }
    }
};

async function fetchWithMirror(url) {
    const domains = ['https://hianime.to', 'https://hianimez.to'];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
        const promises = domains.map(d => 
            fetch(`${d}${url}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'X-Requested-With': 'XMLHttpRequest' },
                signal: controller.signal
            }).then(r => {
                if (r.ok) {
                    controller.abort();
                    return r.text();
                }
                throw new Error('Mirror fail');
            })
        );
        const result = await Promise.any(promises);
        clearTimeout(timeout);
        return result;
    } catch (e) {
        throw new Error('Mirror Sync Failed: ' + e.message);
    }
}

async function handleHome(respond) {
    try {
        const html = await fetchWithMirror('/home');
        const extract = r => [...html.matchAll(r)].map(m => ({ id: m[2], poster: m[1], name: m[3] }));
        return respond({ 
            data: { 
                spotlightAnimes: extract(/<div class="swiper-slide spotlight-item">[\s\S]*?src="(.+?)"[\s\S]*?class="des-title">[\s\S]*?href="\/(.+?)"[\s\S]*?>(.+?)<\/a>/g),
                trendingAnimes: extract(/<div class="item">[\s\S]*?src="(.+?)"[\s\S]*?class="film-poster-ahref" href="\/(.+?)" title="(.+?)"/g).slice(0, 10),
                latestEpisodeAnimes: extract(/<div class="flw-item">[\s\S]*?href="\/(.+?)"[\s\S]*?src="(.+?)"[\s\S]*?class="dynamic-name"[\s\S]*?>(.+?)<\/a>/g).slice(0, 12),
                topUpcomingAnimes: []
            } 
        });
    } catch (e) { return respond({ error: e.message }, 500); }
}

async function handleSearch(url, respond) {
    try {
        const html = await fetchWithMirror(`/search?keyword=${encodeURIComponent(url.searchParams.get('q') || '')}`);
        const animes = [...html.matchAll(/<div class="flw-item">[\s\S]*?href="\/(.+?)"[\s\S]*?src="(.+?)"[\s\S]*?class="dynamic-name"[\s\S]*?>(.+?)<\/a>/g)].map(m => ({ id: m[1], poster: m[2], name: m[3] }));
        return respond({ data: { animes } });
    } catch (e) { return respond({ error: e.message }, 500); }
}

async function handleInfo(id, respond) {
    try {
        const html = await fetchWithMirror(`/${id}`);
        return respond({ 
            data: { 
                anime: { 
                    info: { 
                        id, 
                        name: html.match(/<h2 class="film-name dynamic-name".*?>(.*?)<\/h2>/)?.[1] || 'Unknown', 
                        poster: html.match(/<img class="film-poster-img" src="(.*?)"/)?.[1] || '',
                        description: html.match(/<div class="text">(.*?)<\/div>/)?.[1]?.replace(/<[^>]*>/g, '').trim() || '',
                        stats: { rating: 'PG-13', quality: 'HD', episodes: { sub: 0, dub: 0 } },
                        charactersVoiceActors: [], recommendedAnimes: []
                    },
                    moreInfo: { genres: [], status: 'Released' }
                }
            }
        });
    } catch (e) { return respond({ error: e.message }, 500); }
}

async function handleEpisodes(id, respond) {
    try {
        const res = await fetch(`https://hianime.to/ajax/v2/episode/list/${id.split('-').pop()}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const json = await res.json();
        const episodes = [...(json.html || '').matchAll(/data-id="(.+?)"[\s\S]*?data-number="(.+?)"[\s\S]*?title="(.+?)"/g)].map(m => ({ episodeId: m[1], number: parseInt(m[2]), title: m[3] }));
        return respond({ data: { episodes } });
    } catch (e) { return respond({ error: e.message }, 500); }
}

async function handleServers(id, respond) {
    try {
        const res = await fetch(`https://hianime.to/ajax/v2/episode/servers?episodeId=${id}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const json = await res.json();
        const sub = [...(json.html || '').matchAll(/data-id="([0-9]+)"[^>]*>([^<]+)/g)].map(m => ({ id: m[1], name: m[2].trim().toLowerCase() }));
        return respond({ data: { sub, dub: [] } });
    } catch (e) { return respond({ error: e.message }, 500); }
}

async function handleSources(url, request, respond) {
    try {
        const epId = url.searchParams.get('episodeId') || url.searchParams.get('animeEpisodeId');
        const server = url.searchParams.get('serverId') || url.searchParams.get('server') || 'vidcloud';
        const serRes = await fetch(`https://hianime.to/ajax/v2/episode/servers?episodeId=${epId}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const serJson = await serRes.json();
        const sId = [...(serJson.html || '').matchAll(/data-id="([0-9]+)"[^>]*>([^<]+)/g)].find(m => m[2].toLowerCase().includes(server))?.[1];
        const souRes = await fetch(`https://hianime.to/ajax/v2/episode/sources?id=${sId}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const souJson = await souRes.json();
        const vId = souJson.link.split('/').pop()?.split('?')[0];
        const apiRes = await fetch(`https://megacloud.tv/embed-2/ajax/e-1/getSources?id=${vId}`, { headers: { 'Referer': 'https://hianime.to/' } });
        const data = await apiRes.json();
        const origin = new URL(request.url).origin;
        if (data.sources) data.sources = data.sources.map(s => ({ ...s, url: `${origin}/proxy?url=${encodeURIComponent(s.file)}&referer=${encodeURIComponent('https://hianime.to/')}` }));
        return respond({ data });
    } catch (e) { return respond({ error: e.message }, 500); }
}

async function handleVidSrc(path, respond) {
    try {
        let t = path.replace('/vidsrc', '');
        // Mapping: /movie/1 -> /api/latest/movie/1
        if (t.startsWith('/movie/')) t = `/api/movie/latest?page=${t.split('/').pop()}`;
        else if (t.startsWith('/tv/')) t = `/api/tv/latest?page=${t.split('/').pop()}`;
        else if (t.startsWith('/episodes/')) t = `/api/episode/latest?page=${t.split('/').pop()}`;
        
        const res = await fetch(`https://vidsrc.icu${t}`);
        if (!res.ok) return respond({ result: [] }); // Always valid JSON
        
        const text = await res.text();
        try { 
            return respond(JSON.parse(text)); 
        } catch { 
            return respond({ result: [] }); // Fallback to empty result if not JSON
        }
    } catch (e) { return respond({ result: [] }, 500); }
}

async function handleProxy(request, respond, corsHeaders) {
    const url = new URL(request.url).searchParams.get('url');
    const ref = new URL(request.url).searchParams.get('referer');
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': ref || 'https://hianime.to/' }, signal: AbortSignal.timeout(10000) });
        const type = res.headers.get('Content-Type');
        if (url.includes('.m3u8')) {
            let t = await res.text();
            const base = url.split('/').slice(0, -1).join('/');
            const origin = new URL(request.url).origin;
            t = t.split('\n').map(l => (l.startsWith('#') || !l.trim()) ? l : `${origin}/proxy?url=${encodeURIComponent(l.startsWith('http') ? l : `${base}/${l}`)}&referer=${encodeURIComponent(ref || '')}`).join('\n');
            return respond(t, 200, type);
        }
        return new Response(res.body, { 
            status: res.status, 
            headers: { ...corsHeaders, 'Content-Type': type } 
        });
    } catch (e) { return respond({ error: e.message }, 500); }
}
