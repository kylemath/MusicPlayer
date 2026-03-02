import { get, set } from 'idb-keyval';
import type { Playlist } from './types';

const DIRECTORY_HANDLE_KEY = 'music_directory_handle';
const SONGS_CACHE_KEY = 'music_songs_cache';
const PLAYLISTS_KEY = 'music_playlists';

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle) {
  await set(DIRECTORY_HANDLE_KEY, handle);
}

export async function getDirectoryHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  return await get(DIRECTORY_HANDLE_KEY);
}

// We can't easily serialize FileSystemFileHandle in the cache alongside the rest of the song,
// but actually, IndexedDB *can* store FileSystemFileHandle!
export async function saveSongsCache(songs: any[]) {
  await set(SONGS_CACHE_KEY, songs);
}

export async function getSongsCache(): Promise<any[] | undefined> {
  return await get(SONGS_CACHE_KEY);
}

export async function getPlaylists(): Promise<Playlist[]> {
  const list = await get<Playlist[]>(PLAYLISTS_KEY);
  return list ?? [];
}

export async function savePlaylists(playlists: Playlist[]) {
  await set(PLAYLISTS_KEY, playlists);
}
