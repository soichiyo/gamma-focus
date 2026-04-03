"use client";

import { Headphones, Play, Square } from "lucide-react";

type PlayerProps = {
  isPlaying: boolean;
  onTogglePlay: () => void;
};

export function Player({ isPlaying, onTogglePlay }: PlayerProps) {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex w-full items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-geist)] text-2xl font-bold">
            Gamma Focus
          </h1>
          <p className="font-[family-name:var(--font-geist-mono)] text-xs text-zinc-500 tracking-wider">
            40Hz Binaural Beat Generator
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1.5">
          <Headphones className="h-3.5 w-3.5 text-purple-500" />
          <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-zinc-400 tracking-wide">
            Headphones
          </span>
        </div>
      </div>

      <button
        onClick={onTogglePlay}
        className="relative flex h-[120px] w-[120px] items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-700 shadow-[0_4px_32px_8px_rgba(168,85,247,0.3)] transition-transform hover:scale-105 active:scale-95"
      >
        {isPlaying ? (
          <Square className="h-10 w-10 text-white fill-white" />
        ) : (
          <Play className="h-10 w-10 text-white fill-white ml-1" />
        )}
      </button>

      <div className="flex flex-col items-center gap-1">
        <span className="text-sm text-zinc-500">
          {isPlaying ? "40 Hz · Gamma Wave" : "Ready to focus"}
        </span>
        <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-zinc-600">
          200 Hz → 240 Hz
        </span>
      </div>
    </div>
  );
}
