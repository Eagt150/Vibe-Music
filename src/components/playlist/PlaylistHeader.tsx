import { useRef, useState } from "react";
import { Camera, Pencil, Play, Plus, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { InlineEditableText } from "@/components/ui/InlineEditableText";
import { CoverArt } from "@/components/ui/CoverArt";
import { HiddenFileInput } from "@/components/ui/HiddenFileInput";
import type { PlaylistMeta } from "@/types";

interface PlaylistHeaderProps {
  playlist: PlaylistMeta;
  songCount: number;
  songTitles: string[];
  onRename: (name: string) => void;
  onCoverUpload: (file: File) => void;
  onPlay: () => void;
  onShuffle: () => void;
  onAddSongsClick: () => void;
}

export function PlaylistHeader({
  playlist,
  songCount,
  songTitles,
  onRename,
  onCoverUpload,
  onPlay,
  onShuffle,
  onAddSongsClick,
}: PlaylistHeaderProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const disabled = songCount === 0;

  return (
    <div className="flex gap-5 items-end flex-wrap md:flex-nowrap mb-7">
      <div className="relative flex-shrink-0">
        <CoverArt coverHash={playlist.coverHash} songTitles={songTitles} hue={playlist.hue} size="lg" />
        <button
          type="button"
          onClick={() => coverInputRef.current?.click()}
          className="absolute bottom-1.5 right-1.5 w-[30px] h-[30px] rounded-full bg-surface border border-border flex items-center justify-center cursor-pointer shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
          title="Change cover"
          aria-label="Change cover"
        >
          <Camera size={13} />
        </button>
        <HiddenFileInput
          ref={coverInputRef}
          accept="image/*"
          onFiles={(files) => {
            const file = files[0];
            if (file) onCoverUpload(file);
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="text-sm font-bold text-text-faint tracking-widest">PLAYLIST</div>

        {isRenaming ? (
          <InlineEditableText
            value={playlist.name}
            onConfirm={(name) => {
              onRename(name);
              setIsRenaming(false);
            }}
            onCancel={() => setIsRenaming(false)}
            confirmOnBlur
            className="text-[22px] md:text-3xl font-extrabold tracking-tight max-w-full"
          />
        ) : (
          <div className="flex items-center gap-2">
            <div className="text-[22px] md:text-3xl font-extrabold tracking-tight truncate">{playlist.name}</div>
            <button
              type="button"
              onClick={() => setIsRenaming(true)}
              className="text-text-dim hover:text-text cursor-pointer p-1"
              aria-label="Rename"
              title="Rename"
            >
              <Pencil size={14} />
            </button>
          </div>
        )}

        <div className="text-base text-text-dim">{songCount} songs</div>

        <div className="flex gap-2.5 mt-1.5 flex-wrap">
          <Button icon={<Play size={13} fill="currentColor" />} onClick={onPlay} disabled={disabled}>
            Play
          </Button>
          <Button variant="secondary" icon={<Shuffle size={13} />} onClick={onShuffle} disabled={disabled}>
            Shuffle
          </Button>
          <Button variant="ghost" icon={<Plus size={13} />} onClick={onAddSongsClick}>
            Add songs
          </Button>
        </div>
      </div>
    </div>
  );
}
