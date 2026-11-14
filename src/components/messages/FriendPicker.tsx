import { Check } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { cn } from "@/lib/cn";
import type { FriendRow, UserId } from "./types";

interface FriendPickerProps {
  friends: FriendRow[];
  selected: Set<UserId>;
  onToggle: (id: UserId) => void;
}

export function FriendPicker({ friends, selected, onToggle }: FriendPickerProps) {
  return (
    <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto -mx-1">
      {friends.map(({ user }) => {
        const checked = selected.has(user._id);
        return (
          <button
            key={user._id}
            type="button"
            onClick={() => onToggle(user._id)}
            aria-pressed={checked}
            className="flex items-center gap-3 px-1 py-1.5 rounded-md hover:bg-surface-alt cursor-pointer text-left"
          >
            <UserAvatar name={user.displayName} url={user.avatarUrl} size={32} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base truncate">{user.displayName}</div>
              <div className="text-xs text-text-dim truncate">@{user.username}</div>
            </div>
            <span
              className={cn(
                "w-5 h-5 rounded-full border inline-flex items-center justify-center flex-shrink-0",
                checked ? "bg-accent border-accent text-accent-text" : "border-border"
              )}
            >
              {checked && <Check size={12} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

