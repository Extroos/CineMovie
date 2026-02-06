"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
import { Search } from "lucide-react";
import EpisodeCard from "./common/episode-card";
import { useGetAllEpisodes } from "@/query/get-all-episodes";
import { Episode } from "@/types/episodes";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type Props = {
  animeId: string;
  onEpisodeClick?: (episodeId: string) => void;
};

const AnimeEpisodes = ({ animeId, onEpisodeClick }: Props) => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);
  const [ranges, setRanges] = useState<string[]>([]);
  const [selectedRange, setSelectedRange] = useState<string>("");

  const { data, isLoading } = useGetAllEpisodes(animeId);

  useEffect(() => {
    if (data) {
      const episodes = data.episodes;
      setAllEpisodes(episodes);

      if (episodes.length > 50) {
        // Calculate ranges
        const rangesArray = [];
        for (let i = 0; i < episodes.length; i += 50) {
          const start = i + 1;
          const end = Math.min(i + 50, episodes.length);
          rangesArray.push(`${start}-${end}`);
        }
        setRanges(rangesArray);
        setSelectedRange(rangesArray[0]);

        // Filter the first range directly from episodes
        const filteredEpisodes = episodes.filter(
          (_, index) => index + 1 >= 1 && index + 1 <= 50,
        );
        setEpisodes(filteredEpisodes);
      } else {
        setEpisodes(episodes);
      }
    }
  }, [data]);

  const handleRangeChange = (range: string) => {
    setSelectedRange(range);

    const [start, end] = range.split("-").map(Number);
    const filteredEpisodes = allEpisodes.filter(
      (_, index) => index + 1 >= start && index + 1 <= end,
    );
    setEpisodes(filteredEpisodes);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toLowerCase();
    if (!query) {
      // Reset episodes to the selected range
      const [start, end] = selectedRange.split("-").map(Number);
      const filteredEpisodes = allEpisodes.filter(
        (_, index) => index + 1 >= start && index + 1 <= end,
      );
      setEpisodes(filteredEpisodes);
    } else {
      const filteredEpisodes = episodes.filter((episode, index) => {
        return (
          (index + 1).toString().includes(query) ||
          episode.title.toLowerCase().includes(query) ||
          "episode".includes(query.trim())
        );
      });
      setEpisodes(filteredEpisodes);
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row w-full md:items-center justify-between gap-4 mb-6">
        <h3 className="hidden md:block text-xl font-bold text-white/40 uppercase tracking-wider">Episodes</h3>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {ranges.length > 0 && (
            <Select onValueChange={handleRangeChange} value={selectedRange}>
              <SelectTrigger className="flex-1 md:w-[140px] bg-white/5 border-white/10 rounded-xl h-12">
                <SelectValue
                  className="text-white"
                  placeholder="Range"
                />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10 rounded-xl">
                <SelectGroup>
                  {ranges.map((range) => (
                    <SelectItem key={range} value={range} className="text-white">
                      {range}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
          <div className="relative flex-1 md:w-[250px]">
            <Search className="absolute inset-y-0 left-3 m-auto h-4 w-4 text-white/40" />
            <Input
              placeholder="Search..."
              className="w-full pl-10 bg-white/5 border-white/10 rounded-xl h-12 text-white placeholder:text-white/20 focus:ring-1 focus:ring-white/20"
              onChange={handleSearch}
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-4">
        {episodes.map((episode, idx) => (
          <EpisodeCard
            episode={episode}
            key={idx}
            animeId={animeId}
            onClick={onEpisodeClick}
          />
        ))}
        {!episodes.length && !isLoading && (
          <div className="lg:col-span-5 col-span-2 sm:col-span-3 md:col-span-4 xl:col-span-6 2xl:col-span-7 flex items-center justify-center py-10 bg-slate-900 rounded-md">
            No Episodes
          </div>
        )}
        {isLoading &&
          Array.from({ length: 14 }).map((_, idx) => (
            <div
              key={idx}
              className={cn([
                "h-[6.25rem] rounded-lg cursor-pointer w-full flex items-center justify-center animate-pulse bg-slate-800",
                "self-center justify-self-center",
              ])}
            ></div>
          ))}
      </div>
    </>
  );
};

export default AnimeEpisodes;
