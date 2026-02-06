async function testManualScrape() {
    const episodeId = 'jujutsu-kaisen-the-culling-game-part-1-20401?ep=12345'; // Example
    const epNumericId = episodeId.split('?ep=')[1];
    
    console.log('Testing Manual Scrape via Proxy for Ep:', epNumericId);
    
    // Step 1: Get Servers
    const serversUrl = `https://hianime.to/ajax/v2/episode/servers?episodeId=${epNumericId}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(serversUrl)}`;
    
    try {
        const res = await fetch(proxyUrl);
        const data = await res.json();
        const hianimeData = JSON.parse(data.contents);
        const html = hianimeData.html;
        
        console.log('Parsed HiAnime HTML Length:', html.length);
        
        // The HTML contains <div class="server" data-id="..."> or similar
        const idMatches = [...html.matchAll(/data-id="([0-9]+)"/g)];
        console.log('Found ID matches:', idMatches.map(m => m[1]));
        
        if (idMatches.length > 0) {
            // Priority: Servers like "VidCloud" (usually id 4) or just the first one
            const serverId = idMatches[0][1];
            console.log('Using Server ID:', serverId);
            
            // Step 2: Get Sources
            const sourcesUrl = `https://hianime.to/ajax/v2/episode/sources?id=${serverId}`;
            const sourcesProxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(sourcesUrl)}`;
            
            const sRes = await fetch(sourcesProxyUrl);
            const sData = await sRes.json();
            const sJson = JSON.parse(sData.contents);
            console.log('Sources JSON:', sJson);
        } else {
            console.log('No server IDs found in HTML. Snippet:', html.substring(0, 500));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testManualScrape();
