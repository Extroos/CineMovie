import React from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

import { CharactersVoiceActor } from "@/types/anime-details";

type Props = {
  className?: string;
  character: CharactersVoiceActor;
};

const CharacterCard = ({ ...props }: Props) => {
  return (
    <div
      className={cn([
        "rounded-2xl overflow-hidden relative cursor-pointer ring-offset-background transition-all active:scale-95 group",
        "aspect-[2/3] w-full",
        props.className,
      ])}
    >
      <Image
        src={props.character.character.poster}
        alt={props.character.character.name}
        fill
        className="object-cover transition-transform group-hover:scale-110 duration-500"
        unoptimized
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
      <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4 flex flex-col">
        <h5 className="text-white text-sm md:text-base font-bold line-clamp-1 group-hover:text-white/90">
          {props.character.character.name}
        </h5>
        <p className="text-white/60 text-[10px] md:text-xs font-medium line-clamp-1">
          {props.character.character.cast}
        </p>
      </div>
    </div>
  );
};

export default CharacterCard;
