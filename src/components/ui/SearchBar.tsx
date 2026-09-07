import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchBar({ value, onChange, placeholder, className, autoFocus }: SearchBarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 bg-input-bg border border-border rounded-pill px-3 py-1.5 min-w-0",
        className
      )}
    >
      <Search size={14} className="opacity-60 flex-shrink-0" />
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent border-none outline-none text-text text-base placeholder:text-text-faint"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-text-faint hover:text-text flex-shrink-0 cursor-pointer"
          aria-label="Clear search"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
