/**
 * CINE-MOVIE UNIFIED WORKER v1.3.2 (ULTRA-MASTER)
 * Block-Aware Scraper + Schedule + VidSrc Fixed + Redirects Safe.
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
            if (path === '/schedule') return handleSchedule(url, respond);
            if (path.startsWith('/info/')) return handleInfo(path.split('/').pop(), respond);
            if (path.startsWith('/episodes/')) return handleEpisodes(path.split('/').pop(), respond);
            if (path.startsWith('/servers/')) return handleServers(path.split('/').pop(), respond);
            if (path === '/sources') return handleSources(url, request, respond);
            if (path.startsWith('/vidsrc/')) return handleVidSrc(path, respond);

            // Kitsune/Mobile Compat
            if (path.startsWith('/anime/')) {
                const id = path.split('/')[2];
                if (path.endsWith('/episodes')) return handleEpisodes(id, respond);
                return handleInfo(id, respond);
            }
            if (path === '/episode/servers') return handleServers(url.searchParams.get('animeEpisodeId'), respond);
            if (path === '/episode/sources') return handleSources(url, request, respond);

            if (path === '/') return respond({ status: 'ACTIVE', v: '1.3.2' });
            return respond({ error: 'Route Not Found' }, 404);
        } catch (e) {
            return respond({ error: 'Worker Interior Error', message: e.message, data: {} }, 200);
        }
    }
};

async function fetchSafe(url) {
    const domains = ['https://hianime.to', 'https://hianimez.to'];
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

function cleanText(t) { return t?.replace(/<[^>]*>/g, '').trim(); }

async function handleHome(respond) {
    const html = await fetchSafe('/home');
    if (!html) return respond({ data: { spotlightAnimes: [], trendingAnimes: [], latestEpisodeAnimes: [], topUpcomingAnimes: [] } });

    // 1. Spotlight (Big Slider)
    const spotlights = [...html.matchAll(/<div class="deslide-item">([\s\S]*?)<div class="desi-buttons">/g)].map(item => {
        const h = item[1];
        return {
            id: h.match(/href="\/(.+?)"/)?.[1],
            name: cleanText(h.match(/class="desi-head-title dynamic-name"[\s\S]*?>(.+?)<\/div>/)?.[1]),
            poster: h.match(/data-src="(.+?)"/)?.[1] || h.match(/src="(.+?)"/)?.[1]
        };
    }).filter(x => x.id && x.name);

    // 2. Trending
    const trendings = [...html.matchAll(/<div class="swiper-slide item-qtip"[\s\S]*?>([\s\S]*?)<div class="clearfix"><\/div>/g)].map(item => {
        const h = item[1];
        const id = h.match(/href="\/(.+?)"/)?.[1];
        const name = cleanText(h.match(/class="film-title dynamic-name"[\s\S]*?>(.+?)<\/div>/)?.[1]);
        const poster = h.match(/data-src="(.+?)"/)?.[1] || h.match(/src="(.+?)"/)?.[1];
        return { id, name, poster };
    }).filter(x => x.id && x.name);

    // 3. Grids (Latest, Airing, etc.)
    const gridItems = [...html.matchAll(/<(?:div class="flw-item"|li)>([\s\S]*?)<div class="film-detail">([\s\S]*?)<\/div>/g)].map(item => {
        const h = item[0];
        const id = h.match(/href="\/(.+?)"/)?.[1];
        const name = cleanText(h.match(/class="dynamic-name"[\s\S]*?>(.+?)<\/a>/)?.[1]);
        const poster = h.match(/data-src="(.+?)"/)?.[1] || h.match(/src="(.+?)"/)?.[1];
        return { id, name, poster };
    }).filter(x => x.id && x.name);

    return respond({ 
        data: { 
            spotlightAnimes: spotlights,
            trendingAnimes: trendings.slice(0, 10),
            latestEpisodeAnimes: gridItems.slice(0, 12),
            mostPopularAnimes: gridItems.slice(12, 24),
            topUpcomingAnimes: []
        }
    });
}

async function handleSchedule(url, respond) {
    const rawDate = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
    const html = await fetchSafe(`/schedule?date=${rawDate}`);
    if (!html) return respond({ data: [] });
    const items = [...html.matchAll(/<li class="item">([\s\S]*?)<\/li>/g)].map(item => {
        const h = item[1];
        return {
            time: cleanText(h.match(/class="time">(.+?)<\/div>/)?.[1]),
            id: h.match(/href="\/(.+?)"/)?.[1],
            name: cleanText(h.match(/class="dynamic-name"[\s\S]*?>(.+?)<\/a>/)?.[1])
        };
    }).filter(x => x.id);
    return respond({ data: items });
}

async function handleSearch(url, respond) {
    const q = url.searchParams.get('q') || '';
    const html = await fetchSafe(`/search?keyword=${encodeURIComponent(q)}`);
    if (!html) return respond({ data: { animes: [] } });
    const animes = [...html.matchAll(/<div class="flw-item">([\s\S]*?)<div class="film-detail">([\s\S]*?)<\/div>/g)].map(item => {
        const h = item[0];
        return {
            id: h.match(/href="\/(.+?)"/)?.[1],
            name: cleanText(h.match(/class="dynamic-name"[\s\S]*?>(.+?)<\/a>/)?.[1]),
            poster: h.match(/data-src="(.+?)"/)?.[1] || h.match(/src="(.+?)"/)?.[1]
        };
    }).filter(x => x.id);
    return respond({ data: { animes } });
}

async function handleInfo(id, respond) {
    const html = await fetchSafe(`/${id}`);
    const mock = { info: { id, name: id, poster: '', description: '', stats: { rating: 'PG-13', quality: 'HD', episodes: { sub: 0, dub: 0 } }, charactersVoiceActors: [], recommendedAnimes: [] }, moreInfo: { genres: [], status: 'Released' } };
    if (!html) return respond({ data: { anime: mock } });
    try {
        const name = cleanText(html.match(/<h2 class="film-name dynamic-name".*?>(.*?)<\/h2>/)?.[1]) || id;
        const poster = html.match(/<img class="film-poster-img" src="(.*?)"/)?.[1] || '';
        const description = cleanText(html.match(/<div class="text">(.*?)<\/div>/)?.[1]);
        const stats = {
            rating: cleanText(html.match(/class="tick-item tick-pg">(.+?)<\/div>/)?.[1]) || 'PG-13',
            quality: cleanText(html.match(/class="tick-item tick-quality">(.+?)<\/div>/)?.[1]) || 'HD',
            episodes: { sub: cleanText(html.match(/class="tick-item tick-sub">[\s\S]*?<\/i>(.+?)<\/div>/)?.[1]) || 0 }
        };
        return respond({ data: { anime: { info: { id, name, poster, description, stats, charactersVoiceActors: [], recommendedAnimes: [] }, moreInfo: mock.moreInfo } } });
    } catch (e) { return respond({ data: { anime: mock } }); }
}

async function handleEpisodes(id, respond) {
    try {
        const cleanId = id.split('-').pop();
        const res = await fetch(`https://hianime.to/ajax/v2/episode/list/${cleanId}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
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
        if (t === '/movie' || t === '/tv' || t === '/movie/' || t === '/tv/') t += '/latest';
        if (t.startsWith('/movie/')) t = `/api/movie/latest?page=${t.split('/').pop()}`;
        else if (t.startsWith('/tv/')) t = `/api/tv/latest?page=${t.split('/').pop()}`;
        else if (t.startsWith('/episodes/')) t = `/api/episode/latest?page=${t.split('/').pop()}`;
        const res = await fetch(`https://vidsrc.icu${t}`, { signal: AbortSignal.timeout(6000) });
        const text = await res.text();
        try { return respond(JSON.parse(text)); } catch { return respond({ result: [] }); }
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
