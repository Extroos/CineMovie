import { HiAnime } from 'aniwatch';

async function testPatch() {
    const originalFetch = global.fetch;
    
    // Monkey-patch global fetch
    global.fetch = async (url, options) => {
        const urlStr = url.toString();
        if (urlStr.includes('hianime.to') || urlStr.includes('megacloud.blog') || urlStr.includes('vizcloud')) {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlStr)}`;
            console.log('[Fetch Patch] Proxying:', urlStr);
            const res = await originalFetch(proxyUrl, options);
            const data = await res.json();
            
            // Reconstruct a response-like object
            return {
                ok: true,
                status: 200,
                text: async () => data.contents,
                json: async () => JSON.parse(data.contents)
            };
        }
        return originalFetch(url, options);
    };

    const hianime = new HiAnime.Scraper();
    const epId = 'solo-leveling-18751?ep=121408';
    
    console.log('Testing Scraper with Patched Fetch...');
    try {
        // We also need to fix the axios calls (which don't use fetch)
        // For now, let's see if we can get past the servers part
        const servers = await hianime.getEpisodeServers(epId);
        console.log('Servers Found:', servers.sub.length);
        
        if (servers.sub.length > 0) {
            const sources = await hianime.getEpisodeSources(epId, servers.sub[0].serverId);
            console.log('SOURCES FOUND:', sources.sources.length);
        }
    } catch (e) {
        console.error('Scraper Error:', e.message);
    }
}

testPatch();
