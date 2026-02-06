/**
 * CINE-MOVIE UNIFIED WORKER v1.2.9 (ULTIMATE RELIABILITY)
 * Fixes JSON Syntax Errors and sequential timeout failures.
 */

export default {
    async fetch(request, env, ctx) {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
            'Access-Control-Allow-Headers': 'Content-Type, Bypass-Tunnel-Reminder, X-Requested-With',
            'Access-Control-Max-Age': '86400',
        };

        const respond = (data, status = 200, type = 'application/json') => {
            // CRITICAL: Ensure JSON is ALWAYS stringified if header is JSON
            const body = type === 'application/json' ? JSON.stringify(data) : data;
            return new Response(body, {
                status,
                headers: { ...corsHeaders, 'Content-Type': type }
            });
        };

        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
        if (request.method === 'HEAD') return new Response(null, { status: 200, headers: corsHeaders });

        try {
            const url = new URL(request.url);
            const path = url.pathname;

            if (path === '/proxy') return handleProxy(request, respond, corsHeaders);
            if (path === '/home') return handleHome(respond);
            if (path === '/search') return handleSearch(url, respond);
            if (path.startsWith('/info/')) return handleInfo(path.split('/').pop(), respond);
            if (path.startsWith('/episodes/')) return handleEpisodes(path.split('/').pop(), respond);
            if (path.startsWith('/servers/')) return handleServers(path.split('/').pop(), respond);
            if (path === '/sources') return handleSources(url, request, respond);
            if (path.startsWith('/vidsrc/')) return handleVidSrc(path, respond);

            // Kitsune Compat
            if (path.startsWith('/anime/')) {
                const id = path.split('/')[2];
                if (path.endsWith('/episodes')) return handleEpisodes(id, respond);
                return handleInfo(id, respond);
            }
            if (path === '/episode/servers') return handleServers(url.searchParams.get('animeEpisodeId'), respond);
            if (path === '/episode/sources') return handleSources(url, request, respond);

            if (path === '/') return respond({ status: 'READY', v: '1.2.9' });
            return respond({ error: 'Not Found' }, 404);
        } catch (e) {
            // Aggressive fallback to 200 OK + JSON body to keep UI alive
            return respond({ error: 'Worker Failure', message: e.message, data: {} }, 200);
        }
    }
};

async function fetchSafe(url) {
    const domains = ['https://hianimez.to', 'https://hianime.to'];
    for (const d of domains) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 4500);
            const res = await fetch(`${d}${url}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'X-Requested-With': 'XMLHttpRequest' },
                signal: controller.signal
            });
            clearTimeout(timer);
            if (res.ok) return await res.text();
        } catch(e) {}
    }
    return null;
}

async function handleHome(respond) {
    const html = await fetchSafe('/home');
    const extract = r => !html ? [] : [...html.matchAll(r)].map(m => ({ id: m[2], poster: m[1], name: m[3] }));
    return respond({ 
        data: { 
            spotlightAnimes: extract(/<div class="swiper-slide spotlight-item">[\s\S]*?src="(.+?)"[\s\S]*?class="des-title">[\s\S]*?href="\/(.+?)"[\s\S]*?>(.+?)<\/a>/g),
            trendingAnimes: extract(/<div class="item">[\s\S]*?src="(.+?)"[\s\S]*?class="film-poster-ahref" href="\/(.+?)" title="(.+?)"/g).slice(0, 10),
            latestEpisodeAnimes: extract(/<div class="flw-item">[\s\S]*?href="\/(.+?)"[\s\S]*?src="(.+?)"[\s\S]*?class="dynamic-name"[\s\S]*?>(.+?)<\/a>/g).slice(0, 12),
            topUpcomingAnimes: []
        }
    });
}

async function handleSearch(url, respond) {
    const html = await fetchSafe(`/search?keyword=${encodeURIComponent(url.searchParams.get('q') || '')}`);
    const animes = !html ? [] : [...html.matchAll(/<div class="flw-item">[\s\S]*?href="\/(.+?)"[\s\S]*?src="(.+?)"[\s\S]*?class="dynamic-name"[\s\S]*?>(.+?)<\/a>/g)].map(m => ({ id: m[1], poster: m[2], name: m[3] }));
    return respond({ data: { animes } });
}

async function handleInfo(id, respond) {
    const html = await fetchSafe(`/${id}`);
    const mock = { info: { id, name: id, poster: '', description: '', stats: { rating: 'PG-13', quality: 'HD', episodes: { sub: 0, dub: 0 } }, charactersVoiceActors: [], recommendedAnimes: [] }, moreInfo: { genres: [], status: 'Released' } };
    if (!html) return respond({ data: { anime: mock } });

    try {
        const info = {
            id,
            name: html.match(/<h2 class="film-name dynamic-name".*?>(.*?)<\/h2>/)?.[1] || id,
            poster: html.match(/<img class="film-poster-img" src="(.*?)"/)?.[1] || '',
            description: html.match(/<div class="text">(.*?)<\/div>/)?.[1]?.replace(/<[^>]*>/g, '').trim() || '',
            stats: { rating: 'PG-13', quality: 'HD', episodes: { sub: 0, dub: 0 } },
            charactersVoiceActors: [], recommendedAnimes: []
        };
        return respond({ data: { anime: { info, moreInfo: mock.moreInfo } } });
    } catch (e) { return respond({ data: { anime: mock } }); }
}

async function handleEpisodes(id, respond) {
    try {
        const res = await fetch(`https://hianime.to/ajax/v2/episode/list/${id.split('-').pop()}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const json = await res.json();
        const episodes = [...(json.html || '').matchAll(/data-id="(.+?)"[\s\S]*?data-number="(.+?)"[\s\S]*?title="(.+?)"/g)].map(m => ({ episodeId: m[1], number: parseInt(m[2]), title: m[3] }));
        return respond({ data: { episodes } });
    } catch (e) { return respond({ data: { episodes: [] } }); }
}

async function handleServers(id, respond) {
    try {
        const res = await fetch(`https://hianime.to/ajax/v2/episode/servers?episodeId=${id}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const json = await res.json();
        const sub = [...(json.html || '').matchAll(/data-id="([0-9]+)"[^>]*>([^<]+)/g)].map(m => ({ id: m[1], name: m[2].trim().toLowerCase() }));
        return respond({ data: { sub, dub: [] } });
    } catch (e) { return respond({ data: { sub: [], dub: [] } }); }
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
        if (t.startsWith('/movie/')) t = `/api/movie/latest?page=${t.split('/').pop()}`;
        else if (t.startsWith('/tv/')) t = `/api/tv/latest?page=${t.split('/').pop()}`;
        else if (t.startsWith('/episodes/')) t = `/api/episode/latest?page=${t.split('/').pop()}`;
        
        const res = await fetch(`https://vidsrc.icu${t}`, { signal: AbortSignal.timeout(6000) });
        const text = await res.text();
        try { 
            return respond(JSON.parse(text)); 
        } catch { 
            return respond({ result: [] }); // Guaranteed JSON structure even on error
        }
    } catch (e) { return respond({ result: [] }); }
}

async function handleProxy(request, respond, corsHeaders) {
    const url = new URL(request.url).searchParams.get('url');
    const ref = new URL(request.url).searchParams.get('referer');
    if (!url) return respond({ error: 'No URL' }, 400);
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
        return new Response(res.body, { status: res.status, headers: { ...corsHeaders, 'Content-Type': type } });
    } catch (e) { return respond({ error: e.message }, 500); }
}
