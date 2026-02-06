import axios from "axios";
import { ServerManager } from "../utils/server-manager";

export const api = axios.create();

// Centralized dynamic backend discovery for all Kitsune queries
api.interceptors.request.use(async (config) => {
    // 1. Get the current active backend (Cloud, Local, or Custom)
    const baseUrl = await ServerManager.getUrl();
    const isVercel = baseUrl.includes('vercel.app');
    
    // 2. Handle the URL transformation
    if (config.url) {
        let cleanUrl = config.url;
        
        // Remove '/api' prefix if present (Vite logic, but backend doesn't use it)
        if (cleanUrl.startsWith('/api')) {
            cleanUrl = cleanUrl.replace(/^\/api/, '');
        }

        // LEGACY VERCEL MAPPING:
        // If talking to an older Vercel backend, translate new Kitsune routes to Legacy routes
        if (isVercel) {
            // Case 1: /anime/:id -> /info/:id
            if (cleanUrl.match(/^\/anime\/[^\/]+$/)) {
                cleanUrl = cleanUrl.replace(/^\/anime\//, '/info/');
            }
            // Case 2: /anime/:id/episodes -> /episodes/:id
            else if (cleanUrl.match(/^\/anime\/[^\/]+\/episodes$/)) {
                cleanUrl = cleanUrl.replace(/^\/anime\//, '/episodes/').replace(/\/episodes$/, '');
            }
            // Case 3: /episode/servers?animeEpisodeId=... -> /servers/:id
            else if (cleanUrl.includes('/episode/servers')) {
                const epId = config.params?.animeEpisodeId || cleanUrl.match(/animeEpisodeId=([^&?]+)/)?.[1];
                if (epId) {
                    cleanUrl = `/servers/${decodeURIComponent(epId)}`;
                    if (config.params) delete config.params.animeEpisodeId;
                }
            }
            // Case 4: /episode/sources?animeEpisodeId=...&server=... -> /sources?episodeId=...&serverId=...
            else if (cleanUrl.includes('/episode/sources')) {
                const epId = config.params?.animeEpisodeId || cleanUrl.match(/animeEpisodeId=([^&?]+)/)?.[1];
                const server = config.params?.server || cleanUrl.match(/server=([^&?]+)/)?.[1];
                const category = config.params?.category || cleanUrl.match(/category=([^&?]+)/)?.[1] || 'sub';
                
                if (epId && server) {
                    cleanUrl = `/sources?episodeId=${encodeURIComponent(decodeURIComponent(epId))}&serverId=${encodeURIComponent(decodeURIComponent(server))}&category=${category}`;
                    if (config.params) {
                        delete config.params.animeEpisodeId;
                        delete config.params.server;
                        delete config.params.category;
                    }
                }
            }
        }
        
        // Prepend baseURL if it's not already an absolute URL
        if (!cleanUrl.startsWith('http')) {
            const base = baseUrl.replace(/\/$/, '');
            const path = cleanUrl.replace(/^\//, '');
            config.url = `${base}/${path}`;
        } else {
            config.url = cleanUrl;
        }
    }
    
    // Add bypass header for tunnels
    config.headers['Bypass-Tunnel-Reminder'] = 'true';
    
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Auto-wrap Legacy Vercel responses if they are missing the 'data' property
api.interceptors.response.use(async (response) => {
    const config = response.config;
    const isVercel = config.url?.includes('vercel.app');
    
    // If it's Vercel and the response is successful BUT missing the 'data' wrapper 
    // that Kitsune components expect (res.data.data)
    if (isVercel && response.data && !response.data.data) {
        // Detect if this is an anime-related response (info, episodes, etc.)
        const hasAnimeKeys = response.data.anime || response.data.episodes || response.data.sources || response.data.animes;
        
        if (hasAnimeKeys) {
            console.log('[API Interceptor] Legacy Vercel detected: Wrapping response in "data" property');
            // We wrap the body so that res.data.data becomes the original body
            response.data = { data: response.data };
        }
    }
    
    return response;
}, (error) => {
    return Promise.reject(error);
});
