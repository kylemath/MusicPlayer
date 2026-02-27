import * as mm from 'music-metadata';
import type { Song } from '../types';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.flac', '.wav', '.aac', '.ogg', '.wma']);

function getExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

function stripExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(0, idx) : name;
}

/**
 * iTunes-style libraries are typically organized as:
 *   Artist/Album/01 Song.mp3
 * We use the path segments to infer metadata instantly.
 */
function inferFromPath(path: string, fileName: string): { title: string; artist: string; album: string } {
  const parts = path.split('/');
  const title = stripExtension(fileName).replace(/^\d+[\s.\-_]+/, '');

  if (parts.length >= 3) {
    return { artist: parts[parts.length - 3], album: parts[parts.length - 2], title };
  }
  if (parts.length >= 2) {
    return { artist: parts[parts.length - 2], album: 'Unknown Album', title };
  }
  return { artist: 'Unknown Artist', album: 'Unknown Album', title };
}

export interface FileEntry {
  path: string;
  handle: FileSystemFileHandle;
}

/**
 * Phase 1: Walk the directory tree as fast as possible.
 * Returns Song objects with metadata inferred from file paths.
 * No file reads or ID3 parsing — this is nearly instant even for 10k+ files.
 */
export async function collectFiles(
  dirHandle: FileSystemDirectoryHandle,
  onProgress?: (count: number) => void
): Promise<Song[]> {
  const songs: Song[] = [];

  async function walk(handle: FileSystemDirectoryHandle, currentPath: string) {
    for await (const entry of (handle as any).values()) {
      if (entry.kind === 'file') {
        if (AUDIO_EXTENSIONS.has(getExtension(entry.name))) {
          const fullPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
          const inferred = inferFromPath(fullPath, entry.name);
          songs.push({
            id: fullPath,
            title: inferred.title,
            artist: inferred.artist,
            album: inferred.album,
            duration: 0,
            fileHandle: entry as FileSystemFileHandle,
          });
          if (onProgress && songs.length % 200 === 0) {
            onProgress(songs.length);
          }
        }
      } else if (entry.kind === 'directory') {
        const childPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        await walk(entry as FileSystemDirectoryHandle, childPath);
      }
    }
  }

  await walk(dirHandle, '');
  return songs;
}

const BATCH_SIZE = 50;
const YIELD_MS = 4; // yield to the browser between batches

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Phase 2: Parse ID3 tags in small batches, yielding to the main thread
 * between each batch so the UI stays responsive. Calls onBatch with
 * updated Song objects after each batch completes.
 */
export async function parseMetadataInBackground(
  songs: Song[],
  onBatch: (updated: Map<string, Partial<Song>>) => void,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<void> {
  let done = 0;
  const total = songs.length;

  for (let i = 0; i < songs.length; i += BATCH_SIZE) {
    if (signal?.aborted) return;

    const batch = songs.slice(i, i + BATCH_SIZE);
    const updates = new Map<string, Partial<Song>>();

    await Promise.all(
      batch.map(async (song) => {
        try {
          const file = await song.fileHandle.getFile();
          const metadata = await mm.parseBlob(file, { duration: true, skipCovers: true });

          const update: Partial<Song> = {};
          if (metadata.common.title) update.title = metadata.common.title;
          if (metadata.common.artist || metadata.common.albumartist) {
            update.artist = metadata.common.artist || metadata.common.albumartist!;
          }
          if (metadata.common.album) update.album = metadata.common.album;
          if (metadata.format.duration) update.duration = metadata.format.duration;
          if (metadata.common.track?.no) update.trackNumber = metadata.common.track.no;
          if (metadata.common.year) update.year = metadata.common.year;
          if (metadata.common.genre?.[0]) update.genre = metadata.common.genre[0];

          if (Object.keys(update).length > 0) {
            updates.set(song.id, update);
          }
        } catch {
          // path-inferred metadata is already good enough
        }
      })
    );

    done += batch.length;
    if (updates.size > 0) {
      onBatch(updates);
    }
    if (onProgress) {
      onProgress(done, total);
    }

    // Yield to the browser so the UI thread can paint
    await sleep(YIELD_MS);
  }
}
