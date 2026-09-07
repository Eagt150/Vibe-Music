import { useState } from "react";

interface CreatePlaylistInlineFormProps {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function CreatePlaylistInlineForm({ onConfirm, onCancel }: CreatePlaylistInlineFormProps) {
  const [name, setName] = useState("");

  function confirm() {
    const trimmed = name.trim();
    if (trimmed) onConfirm(trimmed);
    else onCancel();
  }

  return (
    <div className="flex gap-1.5 px-2.5 pb-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") confirm();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Playlist name"
        className="flex-1 min-w-0 bg-input-bg border border-border rounded-sm px-2 py-1.5 text-base text-text outline-none focus:border-accent"
      />
      <button
        type="button"
        onClick={confirm}
        className="bg-accent text-accent-text rounded-sm px-2.5 py-1.5 text-sm font-bold cursor-pointer"
      >
        Add
      </button>
    </div>
  );
}
