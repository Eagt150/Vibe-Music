import { createContext, useContext, useState, type ReactNode } from "react";

export type Route = { type: "home" } | { type: "playlist"; playlistId: string };

interface UiStateContextValue {
  route: Route;
  navigateHome: () => void;
  navigateToPlaylist: (playlistId: string) => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  importError: string | null;
  setImportError: (message: string | null) => void;

  isFullScreenOpen: boolean;
  openFullScreen: () => void;
  closeFullScreen: () => void;

  isQueueOpen: boolean;
  toggleQueue: () => void;
  closeQueue: () => void;

  isMobileSidebarOpen: boolean;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;

  isMobileSearchExpanded: boolean;
  openMobileSearch: () => void;
  closeMobileSearch: () => void;
}

const UiStateContext = createContext<UiStateContextValue | null>(null);

export function UiStateProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>({ type: "home" });
  const [searchQuery, setSearchQuery] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [isFullScreenOpen, setFullScreenOpen] = useState(false);
  const [isQueueOpen, setQueueOpen] = useState(false);
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobileSearchExpanded, setMobileSearchExpanded] = useState(false);

  const value: UiStateContextValue = {
    route,
    navigateHome: () => {
      setRoute({ type: "home" });
      setSearchQuery("");
      setMobileSidebarOpen(false);
      setMobileSearchExpanded(false);
    },
    navigateToPlaylist: (playlistId) => {
      setRoute({ type: "playlist", playlistId });
      setSearchQuery("");
      setMobileSidebarOpen(false);
      setMobileSearchExpanded(false);
    },

    searchQuery,
    setSearchQuery,

    importError,
    setImportError,

    isFullScreenOpen,
    openFullScreen: () => setFullScreenOpen(true),
    closeFullScreen: () => setFullScreenOpen(false),

    isQueueOpen,
    toggleQueue: () => setQueueOpen((v) => !v),
    closeQueue: () => setQueueOpen(false),

    isMobileSidebarOpen,
    openMobileSidebar: () => setMobileSidebarOpen(true),
    closeMobileSidebar: () => setMobileSidebarOpen(false),

    isMobileSearchExpanded,
    openMobileSearch: () => setMobileSearchExpanded(true),
    closeMobileSearch: () => setMobileSearchExpanded(false),
  };

  return <UiStateContext.Provider value={value}>{children}</UiStateContext.Provider>;
}

export function useUiState(): UiStateContextValue {
  const ctx = useContext(UiStateContext);
  if (!ctx) throw new Error("useUiState must be used within a UiStateProvider");
  return ctx;
}
