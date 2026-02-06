async function testVercelZ() {
    const url = 'https://server-blue-delta.vercel.app/sources?episodeId=solo-leveling-18751?ep=121408&serverId=vidstreaming&category=sub';
    console.log('Testing Vercel Sources...');
    try {
        const res = await fetch(url);
        console.log('Status:', res.status);
        if (res.ok) {
            const json = await res.json();
            console.log('SUCCESS:', !!json.sources);
        } else {
            const err = await res.json();
            console.log('Error Message:', err.message);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}
testVercelZ();
