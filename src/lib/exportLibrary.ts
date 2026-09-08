import { zipSync, type Zippable } from "fflate";
import { getAllPlaylists } from "./db/playlists";
import { getAudioBlob, getSongsForPlaylist } from "./db/songs";
import { getCover } from "./db/covers";

interface ManifestSong {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  favorite: boolean;
  mimeType: string;
  audioFile: string;
}

interface ManifestPlaylist {
  id: string;
  name: string;
  coverFile?: string;
  songs: ManifestSong[];
}

/** Bundles every playlist, song, and audio file into a single downloadable
 * .zip — since everything lives only in this browser's IndexedDB (by
 * design, for privacy/legal reasons), this is the only way to move a
 * library to another device or protect against clearing browser data. */
export async function exportLibraryAsZip(): Promise<Blob> {
  const playlists = await getAllPlaylists();
  const files: Zippable = {};
  const manifestPlaylists: ManifestPlaylist[] = [];

  for (const playlist of playlists) {
    const songs = await getSongsForPlaylist(playlist.id);
    const manifestSongs: ManifestSong[] = [];

    for (const song of songs) {
      const blob = await getAudioBlob(song.id);
      const ext = song.mimeType.split("/")[1]?.split(";")[0] || "bin";
      const audioFile = `audio/${song.id}.${ext}`;
      if (blob) files[audioFile] = new Uint8Array(await blob.arrayBuffer());
      manifestSongs.push({
        id: song.id,
        title: song.title,
        artist: song.artist,
        durationSec: song.durationSec,
        favorite: song.favorite,
        mimeType: song.mimeType,
        audioFile,
      });
    }

    let coverFile: string | undefined;
    if (playlist.coverHash) {
      const coverBlob = await getCover(playlist.coverHash);
      if (coverBlob) {
        coverFile = `covers/${playlist.coverHash}`;
        files[coverFile] = new Uint8Array(await coverBlob.arrayBuffer());
      }
    }

    manifestPlaylists.push({ id: playlist.id, name: playlist.name, coverFile, songs: manifestSongs });
  }

  const manifest = { exportedAt: new Date().toISOString(), playlists: manifestPlaylists };
  files["library.json"] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped as BlobPart], { type: "application/zip" });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
