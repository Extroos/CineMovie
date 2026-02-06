Hianime-mapper
This API is used to fetch episodes and streaming url from https://hianime.to by using anilist Ids. It is built on Node.js using the web framework Hono.js to serve the API.

Run Locally
Clone the project

git clone https://github.com/IrfanKhan66/hianime-mapper.git
Go to the project directory

cd hianime-mapper
Install dependencies

npm i
Start the server

npm run dev
Documentation
Get routes info & status of API

request url

https://hianime-mapper.vercel.app/
response

{
"about": "This API maps anilist anime to https://hianime.to and also returns the M3U8 links !",
"status": 200,
"routes": [
"/anime/info/:anilistId",
"/anime/servers/:episodeId",
"/anime/sources?serverId={server_id}&episodeId={episode_id}"
]
}
Get info of anime from anilist with hianime episode mappings

request url

https://hianime-mapper.vercel.app/anime/info/:anilistId

example : https://hianime-mapper.vercel.app/anime/info/20
response

{
data: {
id: number;
idMal: number;
title: {
romaji: string;
english: string;
native: string;
userPreferred: string;
};
coverImage: {
extraLarge: string;
large: string;
medium: string;
color: string;
};
format: string;
description: string;
genres: string[];
season: string;
episodes: number;
nextAiringEpisode: {
id: number;
timeUntilAiring: number;
airingAt: number;
episode: number;
};
status: string;
duration: number;
seasonYear: number;
bannerImage: string;
favourites: number;
popularity: number;
averageScore: number;
trailer: {
id: number;
site: string;
thumbnail: string;
};
startDate: {
year: number;
month: number;
day: number;
};
countryOfOrigin: string;
recommendations: {
title: {
romaji: string;
english: string;
native: string;
userPreferred: string;
};
format: string;
coverImage: {
extraLarge: string;
large: string;
medium: string;
color: string;
};
}[];
relations: {
id: number;
title: {
romaji: string;
english: string;
native: string;
userPreferred: string;
};
coverImage: {
extraLarge: string;
large: string;
medium: string;
color: string;
};
}[];
characters: {
role: string;
name: {
first: string;
middle: string;
last: string;
full: string;
native: string;
userPreferred: string;
};
image: {
large: string;
medium: string;
};
voiceActors: {
name: {
first: string;
middle: string;
last: string;
full: string;
native: string;
userPreferred: string;
};
image: {
large: string;
medium: string;
};
}[];
}[];
episodesList: {
id: string;
episodeId: number;
title: string;
number: number;
}[];
};
}
Get servers

request url

https://hianime-mapper.vercel.app/anime/servers/:episodeId

example : https://hianime-mapper.vercel.app/anime/servers/12352
response

{
data: {
sub: {
serverId: string;
serverName: string;
}[],
dub: {
serverId: string;
serverName: string;
}[]
}
}
Get sources

request url

https://hianime-mapper.vercel.app/anime/sources?serverId={server_id}&episodeId={episode_id}

example : https://hianime-mapper.vercel.app/anime/sources?serverId=662001&episodeId=12352
response

{
data:{
intro: {
start: number;
end: number;
};
outro: {
start: number;
end: number;
};
sources: {
url: string;
type: string;
isM3U8: boolean;
}[];
tracks: {
file: string;
kind: string;
label?: string;
default?: boolean;
}[];
server: number;
}
}
Aniwatch API
Quick start
Installation
To use aniwatch package in your project, run:

pnpm add aniwatch

# or "yarn add aniwatch"

# or "npm install aniwatch"

Example usage
Example - getting information about an anime by providing it's unique anime id, using anime Steins;Gate with steinsgate-3 unique anime id as an example.

import { HiAnime, HiAnimeError } from "aniwatch";

const hianime = new HiAnime.Scraper();

try {
const data: HiAnime.ScrapedAnimeAboutInfo = await hianime.getInfo(
"steinsgate-3"
);
console.log(data);
} catch (err) {
console.error(err instanceof HiAnimeError, err);
}
getHomePage
Sample Usage
import { HiAnime } from "aniwatch";

const hianime = new HiAnime.Scraper();

hianime
.getHomePage()
.then((data) => console.log(data))
.catch((err) => console.error(err));
Response Schema
{
genres: ["Action", "Cars", "Adventure", ...],
latestEpisodeAnimes: [
{
id: string,
name: string,
poster: string,
type: string,
episodes: {
sub: number,
dub: number,
}
},
{...},
],
spotlightAnimes: [
{
id: string,
name: string,
jname: string,
poster: string,
description: string,
rank: number,
otherInfo: string[],
episodes: {
sub: number,
dub: number,
},
},
{...},
],
top10Animes: {
today: [
{
episodes: {
sub: number,
dub: number,
},
id: string,
name: string,
poster: string,
rank: number
},
{...},
],
month: [...],
week: [...]
},
topAiringAnimes: [
{
id: string,
name: string,
jname: string,
poster: string,
},
{...},
],
topUpcomingAnimes: [
{
id: string,
name: string,
poster: string,
duration: string,
type: string,
rating: string,
episodes: {
sub: number,
dub: number,
}
},
{...},
],
trendingAnimes: [
{
id: string,
name: string,
poster: string,
rank: number,
},
{...},
],
mostPopularAnimes: [
{
id: string,
name: string,
poster: string,
type: string,
episodes: {
sub: number,
dub: number,
}
},
{...},
],
mostFavoriteAnimes: [
{
id: string,
name: string,
poster: string,
type: string,
episodes: {
sub: number,
dub: number,
}
},
{...},
],
latestCompletedAnimes: [
{
id: string,
name: string,
poster: string,
type: string,
episodes: {
sub: number,
dub: number,
}
},
{...},
],
}
🔼 Back to Top

getAZList
Parameters
Parameter Type Description Required? Default
sortOption string The az-list sort option. Possible values include: "all", "other", "0-9" and all english alphabets . Yes --
page number The page number of the result. No 1
Sample Usage
import { HiAnime } from "aniwatch";

const hianime = new HiAnime.Scraper();

hianime
.getAZList("0-9", 1)
.then((data) => console.log(data))
.catch((err) => console.error(err));
Response Schema
{
sortOption: "0-9",
animes: [
{
id: string,
name: string,
jname: string,
poster: string,
duration: string,
type: string,
rating: string,
episodes: {
sub: number ,
dub: number
}
},
{...}
],
totalPages: 1,
currentPage: 1,
hasNextPage: false
}
🔼 Back to Top

getQtipInfo
Parameters
Parameter Type Description Required? Default
animeId string The unique anime id (in kebab case). Yes --
Sample Usage
import { HiAnime } from "aniwatch";

const hianime = new HiAnime.Scraper();

hianime
.getQtipInfo("one-piece-100")
.then((data) => console.log(data))
.catch((err) => console.error(err));
Response Schema
{
anime: {
id: "one-piece-100",
name: "One Piece",
malscore: string,
quality: string,
episodes: {
sub: number,
dub: number
},
type: string,
description: string,
jname: string,
synonyms: string,
aired: string,
status: string,
genres: ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Shounen", "Drama", "Fantasy", "Shounen", "Fantasy", "Shounen", "Shounen", "Super Power"]
}
}
🔼 Back to Top

getAnimeAboutInfo
Parameters
Parameter Type Description Required? Default
animeId string The unique anime id (in kebab case). Yes --
Sample Usage
import { HiAnime } from "aniwatch";

const hianime = new HiAnime.Scraper();

hianime
.getInfo("steinsgate-3")
.then((data) => console.log(data))
.catch((err) => console.error(err));
Response Schema
{
anime: [
info: {
id: string,
name: string,
poster: string,
description: string,
stats: {
rating: string,
quality: string,
episodes: {
sub: number,
dub: number
},
type: string,
duration: string
},
promotionalVideos: [
{
title: string | undefined,
source: string | undefined,
thumbnail: string | undefined
},
{...},
],
characterVoiceActor: [
{
character: {
id: string,
poster: string,
name: string,
cast: string
},
voiceActor: {
id: string,
poster: string,
name: string,
cast: string
}
},
{...},
]
}
moreInfo: {
aired: string,
genres: ["Action", "Mystery", ...],
status: string,
studios: string,
duration: string
...
}
],
mostPopularAnimes: [
{
episodes: {
sub: number,
dub: number,
},
id: string,
jname: string,
name: string,
poster: string,
type: string
},
{...},
],
recommendedAnimes: [
{
id: string,
name: string,
poster: string,
duration: string,
type: string,
rating: string,
episodes: {
sub: number,
dub: number,
}
},
{...},
],
relatedAnimes: [
{
id: string,
name: string,
poster: string,
duration: string,
type: string,
rating: string,
episodes: {
sub: number,
dub: number,
}
},
{...},
],
seasons: [
{
id: string,
name: string,
title: string,
poster: string,
isCurrent: boolean
},
{...}
]
}
🔼 Back to Top

getAnimeSearchResults
Parameters
Parameter Type Description Required? Default
q string The search query, i.e. the title of the item you are looking for. Yes --
page number The page number of the result. No 1
type string Type of the anime. eg: movie No --
status string Status of the anime. eg: finished-airing No --
rated string Rating of the anime. eg: r+ or pg-13 No --
score string Score of the anime. eg: good or very-good No --
season string Season of the aired anime. eg: spring No --
language string Language category of the anime. eg: sub or sub-&-dub No --
start_date string Start date of the anime(yyyy-mm-dd). eg: 2014-10-2 No --
end_date string End date of the anime(yyyy-mm-dd). eg: 2010-12-4 No --
sort string Order of sorting the anime result. eg: recently-added No --
genres string Genre of the anime, separated by commas. eg: isekai,shounen No --
[!TIP]

For both start_date and end_date, year must be mentioned. If you wanna omit date or month specify 0 instead. Eg: omitting date -> 2014-10-0, omitting month -> 2014-0-12, omitting both -> 2014-0-0

Sample Usage
import { HiAnime } from "aniwatch";

const hianime = new HiAnime.Scraper();

hianime
.search("monster", 1, {
genres: "seinen,psychological",
})
.then((data) => {
console.log(data);
})
.catch((err) => {
console.error(err);
});
Response Schema
{
animes: [
{
id: string,
name: string,
poster: string,
duration: string,
type: string,
rating: string,
episodes: {
sub: number,
dub: number,
}
},
{...},
],
mostPopularAnimes: [
{
episodes: {
sub: number,
dub: number,
},
id: string,
jname: string,
name: string,
poster: string,
type: string
},
{...},
],
currentPage: 1,
totalPages: 1,
hasNextPage: false,
searchQuery: string,
searchFilters: {
[filter_name]: [filter_value]
...
}
}
🔼 Back to Top

getAnimeSearchSuggestion
Parameters
Parameter Type Description Required? Default
q string The search suggestion query. Yes --
Sample Usage
import { HiAnime } from "aniwatch";

const hianime = new HiAnime.Scraper();

hianime
.searchSuggestions("one piece")
.then((data) => console.log(data))
.catch((err) => console.error(err));
Response Schema
{
suggestions: [
{
id: string,
name: string,
poster: string,
jname: string,
moreInfo: ["Mar 4, 2000", "Movie", "50m"]
},
{...},
],
}
🔼 Back to Top

getProducerAnimes
getGenreAnime
getAnimeCategory
Parameters
Parameter Type Description Required? Default
category string The category of anime. Yes --
page number The page number of the result. No 1
Sample Usage
import { HiAnime } from "aniwatch";

const hianime = new HiAnime.Scraper();

hianime
.getCategoryAnime("subbed-anime")
.then((data) => console.log(data))
.catch((err) => console.error(err));

// categories ->
// "most-favorite", "most-popular", "subbed-anime", "dubbed-anime",
// "recently-updated", "recently-added", "top-upcoming", "top-airing",
// "movie", "special", "ova", "ona", "tv", "completed"
Response Schema
{
category: "TV Series Anime",
animes: [
{
id: string,
name: string,
poster: string,
duration: string,
type: string,
rating: string,
episodes: {
sub: number,
dub: number,
}
},
{...},
],
genres: ["Action", "Cars", "Adventure", ...],
top10Animes: {
today: [
{
episodes: {
sub: number,
dub: number,
},
id: string,
name: string,
poster: string,
rank: number
},
{...},
],
month: [...],
week: [...]
},
currentPage: 2,
totalPages: 100,
hasNextPage: true
}
🔼 Back to Top

getEstimatedSchedule
Parameters
Parameter Type Description Required? Default
date (yyyy-mm-dd) string The date of the desired schedule. (months & days must have 2 digits) Yes --
tzOffset number The timezone offset in minutes (defaults to -330 i.e. IST) No -330
Sample Usage
import { HiAnime } from "aniwatch";

const hianime = new HiAnime.Scraper();
const timezoneOffset = -330; // IST offset in minutes

hianime
.getEstimatedSchedule("2025-06-09", timezoneOffset)
.then((data) => console.log(data))
.catch((err) => console.error(err));
Response Schema
{
scheduledAnimes: [
{
id: string,
time: string, // 24 hours format
name: string,
jname: string,
airingTimestamp: number,
secondsUntilAiring: number
},
{...}
]
}
🔼 Back to Top

getNextEpisodeSchedule
Parameters
Parameter Type Description Required? Default
animeId string The unique anime id (in kebab case). Yes --
Sample Usage
import { HiAnime } from "aniwatch";

const hianime = new HiAnime.Scraper();

hianime
.getNextEpisodeSchedule("one-piece-100")
.then((data) => console.log(data))
.catch((err) => console.error(err));
Response Schema
{
airingISOTimestamp: string | null,
airingTimestamp: number | null,
secondsUntilAiring: number | null
}
🔼 Back to Top

getAnimeEpisodes
Parameters
Parameter Type Description Required? Default
animeId string The unique anime id. Yes --
Sample Usage
import { HiAnime } from "aniwatch";

const hianime = new HiAnime.Scraper();

hianime
.getEpisodes("steinsgate-3")
.then((data) => console.log(data))
.catch((err) => console.error(err));
Response Schema
{
totalEpisodes: 24,
episodes: [
{
number: 1,
isFiller: false,
title: "Turning Point",
episodeId: "steinsgate-3?ep=213"
},
{...}
]
}
🔼 Back to Top

getEpisodeServers
Parameters
Parameter Type Description Required? Default
episodeId string The unique episode id. Yes --
Request sample
import { HiAnime } from "aniwatch";

const hianime = new HiAnime.Scraper();

hianime
.getEpisodeServers("steinsgate-0-92?ep=2055")
.then((data) => console.log(data))
.catch((err) => console.error(err));
Response Schema
{
episodeId: "steinsgate-0-92?ep=2055",
episodeNo: 5,
sub: [
{
serverId: 4,
serverName: "vidstreaming",
},
{...}
],
dub: [
{
serverId: 1,
serverName: "megacloud",
},
{...}
],
raw: [
{
serverId: 1,
serverName: "megacloud",
},
{...}
],
}
🔼 Back to Top

getAnimeEpisodeSources
Parameters
Parameter Type Description Required? Default
id string The id of the episode. Yes --
server string The name of the server. No "vidstreaming"
category string The category of the episode ('sub', 'dub' or 'raw'). No "sub"
Request sample
import { HiAnime } from "aniwatch";

const hianime = new HiAnime.Scraper();

hianime
.getEpisodeSources("steinsgate-3?ep=230", "hd-1", "sub")
.then((data) => console.log(data))
.catch((err) => console.error(err));
Response Schema
{
headers: {
Referer: string,
"User-Agent": string,
...
},
sources: [
{
url: string, // .m3u8 hls streaming file
isM3U8: boolean,
quality?: string,
},
{...}
],
subtitles: [
{
lang: "English",
url: string, // .vtt subtitle file
},
{...}
],
anilistID: number | null,
malID: number | null,
}
consumet
Consumet API
Consumet provides an APIs for accessing information and links for various entertainments like movies, books, anime, etc.

Discord Discord Discord GitHub

Consumet scrapes data from various websites and provides APIs for accessing the data to satisfy your needs.

Important

Self-hosting the Consumet is required to use the API. Consumet API is no longer publicly available. Please refer to the Installation section for more information on hosting your own instance.

Caution

Consumet is not affiliated with any of the providers it scrapes data from. Consumet is not responsible for any misuse of the data provided by the API. Commercial utilization may lead to serious consequences, including potential site takedown measures. Ensure that you understand the legal implications before using this API.

Run the following command to clone the repository, and install the dependencies.

$ git clone https://github.com/consumet/api.consumet.org.git
$ cd api.consumet.org
$ npm install #or yarn install
start the server!

$ npm start #or yarn start
