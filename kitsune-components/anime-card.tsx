import React from "react";
import Link from "next/link";
import Image from "next/image";

import { cn, formatSecondsToMMSS } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Captions, Mic } from "lucide-react";
import { WatchHistory } from "@/hooks/use-get-bookmark";
import { Progress } from "./ui/progress";

type Props = {
  className?: string;
  poster: string;
  title: string;
  episodeCard?: boolean;
  sub?: number | null;
  dub?: number | null;
  subTitle?: string;
  displayDetails?: boolean;
  variant?: "sm" | "lg";
  href?: string;
  showGenre?: boolean;
  watchDetail?: WatchHistory | null;
};

const AnimeCard = ({
  displayDetails = true,
  // showGenre = true,
  variant = "sm",
  ...props
}: Props) => {
  const safeCurrent =
    typeof props.watchDetail?.current === "number"
      ? props.watchDetail.current
      : 0;
  const safeTotal =
    typeof props.watchDetail?.timestamp === "number" &&
    props.watchDetail.timestamp > 0
      ? props.watchDetail.timestamp
      : 0;

  const clampedCurrent = Math.min(safeCurrent, safeTotal);

  const percentage = safeTotal > 0 ? (clampedCurrent / safeTotal) * 100 : 0;

  return (
    <Link href={props.href as string}>
      <div
        className={cn([
          "rounded-2xl overflow-hidden relative cursor-pointer transition-all active:scale-95 duration-300 group shadow-lg",
          variant === "sm" &&
            "aspect-[2/3] w-full",
          variant === "lg" &&
            "aspect-[16/9] md:aspect-[2/3] w-full",
          props.className,
        ])}
      >
        <Image
          src={props.poster}
          alt={props.title}
          fill
          className="object-cover transition-transform group-hover:scale-110 duration-500"
          unoptimized
        />
        {displayDetails && (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
            <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4 flex flex-col gap-1">
              <h5 className="text-white text-sm md:text-base font-bold line-clamp-1 group-hover:text-white/90">
                {props.title}
              </h5>
              {props.watchDetail && (
                <div className="mt-1 flex flex-col gap-1.5">
                  <p className="text-[10px] md:text-xs text-white/60 font-medium">
                    Ep {props.watchDetail.episodeNumber} • {formatSecondsToMMSS(props.watchDetail.current)}/{formatSecondsToMMSS(props.watchDetail.timestamp)}
                  </p>
                  <Progress value={percentage} className="h-1 bg-white/10" />
                </div>
              )}
              {props.episodeCard ? (
                <div className="flex flex-row items-center gap-2 mt-1">
                  {props.sub && (
                    <Badge className="bg-white/20 text-white text-[10px] px-1.5 flex items-center gap-1 border-none backdrop-blur-md">
                      <Captions size={"12"} />
                      <span>{props.sub}</span>
                    </Badge>
                  )}
                  {props.dub && (
                    <Badge className="bg-white/20 text-white text-[10px] px-1.5 flex items-center gap-1 border-none backdrop-blur-md">
                      <Mic size={"12"} />
                      <span>{props.dub}</span>
                    </Badge>
                  )}
                  <span className="text-[10px] text-white/60 font-medium">{props.subTitle}</span>
                </div>
              ) : (
                <span className="text-[10px] md:text-xs text-white/60 font-medium">{props.subTitle}</span>
              )}
            </div>
          </>
        )}
      </div>
    </Link>
  );
};

export default AnimeCard;
