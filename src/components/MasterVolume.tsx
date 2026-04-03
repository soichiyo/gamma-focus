"use client";

type MasterVolumeProps = {
  volume: number;
  onSetVolume: (volume: number) => void;
};

export function MasterVolume({ volume, onSetVolume }: MasterVolumeProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-[family-name:var(--font-geist-mono)] text-[11px] font-semibold tracking-[0.1em] text-zinc-400">
        MASTER
      </span>
      <div className="flex-1" />
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(e) => onSetVolume(Number(e.target.value) / 100)}
        className="h-1 w-44 cursor-pointer appearance-none rounded-full bg-zinc-800 accent-purple-500"
      />
      <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-purple-500 w-8 text-right">
        {Math.round(volume * 100)}%
      </span>
    </div>
  );
}
