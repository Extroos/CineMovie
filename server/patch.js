// --- CLOUD BYPASS PATCH v5 (STABLE FETCH-ONLY) ---
const PROXY_DOMAINS = [
    'hianime.to', 'hianimez.to', 'megacloud.tv', 'megacloud.blog', 
    'rapid-cloud.co', 'vizcloud.online', 'rabbitstream.net'
];

function shouldProxy(url) {
    if (!url) return false;
    const urlStr = url.toString();
    if (urlStr.includes('allorigins.win')) return false; // Never proxy the proxy itself
    return urlStr.startsWith('/') || PROXY_DOMAINS.some(domain => urlStr.includes(domain));
}

function ensureAbsolute(url) {
    const urlStr = url.toString();
    if (urlStr.startsWith('/')) return `https://hianimez.to${urlStr}`;
    return urlStr;
}

const getProxyUrl = (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url.toString())}`;

// THE MAIN FIX: Patch Global Fetch
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
    const absUrl = ensureAbsolute(url);
    if (shouldProxy(absUrl)) {
        console.log(`[ProxyPatch] Fetch via AllOrigins: ${absUrl}`);
        try {
            const res = await originalFetch(getProxyUrl(absUrl));
            const data = await res.json();
            
            if (!data.contents) {
                console.error(`[ProxyPatch] FAILED: No contents for ${absUrl}`);
                return res; // Fallback to original response behavior
            }
            
            console.log(`[ProxyPatch] SUCCESS: ${data.contents.length} bytes for ${absUrl}`);
            return {
                ok: true,
                status: 200,
                text: async () => data.contents,
                json: async () => {
                    try { return JSON.parse(data.contents); }
                    catch (e) { return data.contents; }
                }
            };
        } catch (err) {
            console.error(`[ProxyPatch] Fetch ERROR for ${absUrl}:`, err.message);
        }
    }
    return originalFetch(url, options);
};

console.log('--- PROXY PATCH v5 (STABLE) INITIALIZED ---');
