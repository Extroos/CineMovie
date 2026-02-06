import axios from 'axios';
import { HiAnime } from 'aniwatch';

const originalGet = axios.get;
const originalCreate = axios.create;
const originalFetch = global.fetch;

const PROXY_DOMAINS = [
    'hianime.to', 
    'hianimez.to', 
    'megacloud.tv', 
    'megacloud.blog', 
    'rapid-cloud.co', 
    'vizcloud.online',
    'rabbitstream.net'
];

function shouldProxy(url) {
    if (!url) return false;
    const urlStr = url.toString();
    return PROXY_DOMAINS.some(domain => urlStr.includes(domain));
}

function getProxyUrl(url) {
    return `https://api.allorigins.win/get?url=${encodeURIComponent(url.toString())}`;
}

// Patch Global Fetch
global.fetch = async (url, options) => {
    if (shouldProxy(url)) {
        console.log('[Patch] Fetching via Proxy:', url);
        const res = await originalFetch(getProxyUrl(url), options);
        const data = await res.json();
        return {
            ok: true,
            status: 200,
            text: async () => data.contents,
            json: async () => JSON.parse(data.contents)
        };
    }
    return originalFetch(url, options);
};

// Patch Axios Get
axios.get = async function(url, config) {
    if (shouldProxy(url)) {
        console.log('[Patch] Axios GET via Proxy:', url);
        const res = await originalGet(getProxyUrl(url), config);
        // AllOrigins returns the content in 'contents'
        if (res.data && res.data.contents) {
            try {
                // If it looks like JSON, parse it
                res.data = JSON.parse(res.data.contents);
            } catch (e) {
                // Otherwise keep it as string (HTML)
                res.data = res.data.contents;
            }
        }
        return res;
    }
    return originalGet(url, config);
};

// Patch Axios Create to ensure new instances also use patched methods
axios.create = function(config) {
    const instance = originalCreate(config);
    const originalInstanceGet = instance.get;
    instance.get = async function(url, cfg) {
        if (shouldProxy(url) || (config.baseURL && shouldProxy(config.baseURL))) {
            const targetUrl = url.startsWith('http') ? url : (config.baseURL || '') + url;
            console.log('[Patch] Instance GET via Proxy:', targetUrl);
            const res = await originalGet(getProxyUrl(targetUrl), cfg);
            if (res.data && res.data.contents) {
                try {
                    res.data = JSON.parse(res.data.contents);
                } catch (e) {
                    res.data = res.data.contents;
                }
            }
            return res;
        }
        return originalInstanceGet.apply(this, [url, cfg]);
    };
    return instance;
};

async function runTest() {
    const hianime = new HiAnime.Scraper();
    const epId = 'solo-leveling-18751?ep=121408';
    
    console.log('Testing Fully Patched Scraper...');
    try {
        const servers = await hianime.getEpisodeServers(epId);
        console.log('Servers Found:', servers.sub.length);
        
        if (servers.sub.length > 0) {
            const server = servers.sub[0];
            console.log('Fetching Sources for Server:', server.serverName);
            const sources = await hianime.getEpisodeSources(epId, server.serverId);
            console.log('SUCCESS! Sources Found:', sources.sources.length);
            if (sources.sources.length > 0) {
                console.log('Direct URL Snippet:', sources.sources[0].url.substring(0, 50));
            }
        }
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

runTest();
