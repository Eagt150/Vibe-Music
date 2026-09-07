import { ThemeProvider } from "@/context/ThemeContext";
import { AudioPlayerProvider } from "@/context/AudioPlayerContext";
import { LibraryProvider } from "@/context/LibraryContext";
import { UiStateProvider } from "@/context/UiStateContext";
import { AppShell } from "@/components/layout/AppShell";

export default function App() {
  return (
    <ThemeProvider>
      <AudioPlayerProvider>
        <LibraryProvider>
          <UiStateProvider>
            <AppShell />
          </UiStateProvider>
        </LibraryProvider>
      </AudioPlayerProvider>
    </ThemeProvider>
  );
}
