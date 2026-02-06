"use client";

import React from "react";

import { cn } from "@/lib/utils";

import { ROUTES } from "@/constants/routes";
import { Episode } from "@/types/episodes";
import { useAnimeStore } from "@/store/anime-store";
import { useHasAnimeWatched } from "@/hooks/use-is-anime-watched";
import { Captions, Mic } from "lucide-react";
import Link from "next/link";
import { WatchHistory } from "@/hooks/use-get-bookmark";

type Props = {
  className?: string;
  episode: Episode;
  showCard?: boolean;
  animeId: string;
  variant?: "card" | "list";
  subOrDub?: { sub: number; dub: number };
  watchedEpisodes?: WatchHistory[] | null;
  onClick?: (episodeId: string) => void;
};

const EpisodeCard = ({
  showCard = false,
  variant = "card",
  ...props
}: Props) => {
  const { selectedEpisode } = useAnimeStore();
  const { hasWatchedEpisode } = useHasAnimeWatched(
    props.animeId,
    props.episode.episodeId,
    props.watchedEpisodes!,
  );

  if (showCard && variant === "card") {
    return (
      <div
        className={cn([
          "rounded-xl overflow-hidden relative cursor-pointer ",

          "h-[8.625rem] min-w-[8.625rem] max-w-[10.625rem] md:h-[10.75rem] md:max-w-[12.5rem]",
          props.className,
        ])}
      >
        {/* <Image */}
        {/*   src={props.episode.} */}
        {/*   alt="image" */}
        {/*   height={100} */}
        {/*   width={100} */}
        {/*   className="w-full h-full object-cover" */}
        {/*   unoptimized */}
        {/* /> */}

        <div className="absolute inset-0 m-auto h-full w-full bg-gradient-to-t from-[#000000a9] to-transparent"></div>
        <div className="absolute bottom-0 flex flex-col gap-1 px-4 pb-3">
          <h5 className="line-clamp-1">{`${props.episode.number}. ${props.episode.title}`}</h5>
          {/* <p className="line-clamp-2">{props.episode.airDate}</p> */}
        </div>
      </div>
    );
  } else if (!showCard && variant === "card") {
    const content = (
      <div
        onClick={() => props.onClick?.(props.episode.episodeId)}
        className={cn([
          "h-12 md:h-14 rounded-xl cursor-pointer w-full flex items-center justify-center font-bold transition-all active:scale-95",
          hasWatchedEpisode 
            ? "bg-white/5 text-white/40 border border-white/5" 
            : "bg-white/10 text-white border border-white/10 hover:bg-white/20 shadow-lg",
          props.className
        ])}
      >
        <span className="text-sm md:text-base">
          {props.episode.number}
        </span>
      </div>
    );

    if (props.onClick) return content;

    return (
      <Link
        href={`${ROUTES.WATCH}?anime=${props.animeId}&episode=${props.episode.episodeId}`}
      >
        {content}
      </Link>
    );
  } else {
    const content = (
      <div
        onClick={() => props.onClick?.(props.episode.episodeId)}
        className="flex gap-5 items-center w-full relative h-fit rounded-md p-2"
        style={
          selectedEpisode === props.episode.episodeId
            ? { backgroundColor: "#e9376b" }
            : hasWatchedEpisode
              ? {
                  backgroundColor: "#0f172a",
                }
              : {}
        }
      >
        <h3>{`Episode ${props.episode.number}`}</h3>
        {props.subOrDub && props.episode.number <= props.subOrDub.sub && (
          <Captions className="text-gray-400" />
        )}
        {props.subOrDub && props.episode.number <= props.subOrDub.dub && (
          <Mic className="text-gray-400" />
        )}
      </div>
    );

    if (props.onClick) return content;

    return (
      <Link
        href={`${ROUTES.WATCH}?anime=${props.animeId}&episode=${props.episode.episodeId}`}
      >
        {content}
      </Link>
    );
  }
};

export default EpisodeCard;
