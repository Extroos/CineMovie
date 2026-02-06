import { HiAnime } from 'aniwatch';

const hianime = new HiAnime.Scraper();

async function test() {
    console.log('Testing HiAnime Scraper...');
    try {
        const data = await hianime.getHomePage();
        console.log('Success! Found', data.spotlightAnimes.length, 'spotlight animes');
    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

test();
