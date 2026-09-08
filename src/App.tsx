import { ThemeProvider } from "@/context/ThemeContext";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { AudioPlayerProvider } from "@/context/AudioPlayerContext";
import { LibraryProvider } from "@/context/LibraryContext";
import { UiStateProvider } from "@/context/UiStateContext";
import { AppShell } from "@/components/layout/AppShell";

export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <AudioPlayerProvider>
          <LibraryProvider>
            <UiStateProvider>
              <AppShell />
            </UiStateProvider>
          </LibraryProvider>
        </AudioPlayerProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
