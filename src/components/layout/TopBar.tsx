import { useState } from "react";
import { ArrowLeft, Menu as MenuIcon, Moon, Search, Settings, Sun } from "lucide-react";
import { useUiState } from "@/context/UiStateContext";
import { useTheme } from "@/context/ThemeContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { SearchBar } from "@/components/ui/SearchBar";
import { IconButton } from "@/components/ui/IconButton";
import { SettingsMenu } from "@/components/settings/SettingsMenu";

export function TopBar() {
  const {
    route,
    navigateHome,
    searchQuery,
    setSearchQuery,
    isMobileSearchExpanded,
    openMobileSearch,
    closeMobileSearch,
    openMobileSidebar,
  } = useUiState();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const showBack = route.type === "playlist";
  const showSearch = !isMobile || isMobileSearchExpanded;
  const placeholder = route.type === "home" ? "Search playlists & songs" : "Search this playlist";

  return (
    <div className="flex items-center gap-2.5 px-3.5 md:px-6 py-3 md:py-4 border-b border-border flex-shrink-0">
      {isMobile && !isMobileSearchExpanded && (
        <IconButton onClick={openMobileSidebar} aria-label="Open menu">
          <MenuIcon size={16} />
        </IconButton>
      )}

      {showBack && !isMobileSearchExpanded && (
        <button
          type="button"
          onClick={navigateHome}
          className="flex items-center gap-1 text-text-dim hover:text-text text-base font-semibold cursor-pointer px-1"
        >
          <ArrowLeft size={14} /> Back
        </button>
      )}

      <div className="flex-1" />

      {isMobile && !isMobileSearchExpanded && (
        <IconButton onClick={openMobileSearch} aria-label="Search">
          <Search size={16} />
        </IconButton>
      )}

      {showSearch && (
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={placeholder}
          autoFocus={isMobileSearchExpanded}
          className={isMobile ? "flex-1" : "flex-none w-[280px]"}
        />
      )}
      {isMobile && isMobileSearchExpanded && (
        <button type="button" onClick={closeMobileSearch} className="text-text-faint text-sm cursor-pointer px-1">
          Cancel
        </button>
      )}

      {!isMobileSearchExpanded && (
        <>
          <div className="relative">
            <IconButton onClick={() => setSettingsOpen((v) => !v)} aria-label="Settings" variant="solid">
              <Settings size={15} />
            </IconButton>
            {settingsOpen && <SettingsMenu onClose={() => setSettingsOpen(false)} />}
          </div>
          <IconButton onClick={toggleTheme} aria-label="Toggle theme" variant="solid">
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </IconButton>
        </>
      )}
    </div>
  );
}
