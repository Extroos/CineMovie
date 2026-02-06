import { hianime } from "@/lib/hianime";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const episodeId = searchParams.get("animeEpisodeId") as string;
    const server = (searchParams.get("server") as
      | "hd-1"
      | "hd-2"
      | "megacloud"
      | "streamsb"
      | "streamtape") || "hd-1";
    const category = searchParams.get("category") as "sub" | "dub" | "raw";

    console.log("Fetching sources for episodeId:", episodeId, "Server:", server);
    const data = await hianime.getEpisodeSources(
      episodeId,
      server,
      category,
    );

    return Response.json({ data });
  } catch (err: any) {
    console.error("Error fetching episode sources:", err.message || err);
    return Response.json({ error: err.message || "something went wrong" }, { status: 500 });
  }
}
