import { get, set } from 'idb-keyval';
import type { PlayHistoryState, Playlist } from './types';

const DIRECTORY_HANDLE_KEY = 'music_directory_handle';
const SONGS_CACHE_KEY = 'music_songs_cache';
const PLAYLISTS_KEY = 'music_playlists';
const PLAY_HISTORY_KEY = 'music_play_history';

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

export async function getPlayHistory(): Promise<PlayHistoryState> {
  const history = await get<PlayHistoryState>(PLAY_HISTORY_KEY);
  return history ?? { entries: [], stats: {} };
}

export async function savePlayHistory(history: PlayHistoryState) {
  await set(PLAY_HISTORY_KEY, history);
}

// ── Album artwork (stored as Blob, keyed per album) ─────────────────────────
// Each album gets its own IndexedDB entry so reads are O(1) and we never
// load unrelated artwork when the user switches songs.

function artworkDbKey(artist: string, album: string): string {
  return `artwork_blob::${artist.toLowerCase().trim()}::${album.toLowerCase().trim()}`;
}

export async function getArtworkBlob(artist: string, album: string): Promise<Blob | undefined> {
  return await get<Blob>(artworkDbKey(artist, album));
}

export async function saveArtworkBlob(artist: string, album: string, blob: Blob): Promise<void> {
  await set(artworkDbKey(artist, album), blob);
}

// ── Artist images ─────────────────────────────────────────────────────────────
// Artist image CDNs (e.g. TheAudioDB's r2.theaudiodb.com) don't send
// Access-Control-Allow-Origin headers, so we can't fetch() their blobs.
// <img src> loads cross-origin images fine without CORS, so we store the
// URL string instead of a blob and let the browser handle the network request.

function artistUrlDbKey(artist: string): string {
  return `artist_url::${artist.toLowerCase().trim()}`;
}

export async function getArtistUrl(artist: string): Promise<string | undefined> {
  return await get<string>(artistUrlDbKey(artist));
}

export async function saveArtistUrl(artist: string, url: string): Promise<void> {
  await set(artistUrlDbKey(artist), url);
}

// ── Artist grouping overrides ─────────────────────────────────────────────────
// Record<variantName, canonicalName> — populated by the LLM grouping feature
// or by manual edits.  Applied on top of local normalization in artistNorm.ts.

const ARTIST_OVERRIDES_KEY = 'artist_group_overrides';

export async function getArtistGroupOverrides(): Promise<Record<string, string>> {
  return (await get<Record<string, string>>(ARTIST_OVERRIDES_KEY)) ?? {};
}

export async function saveArtistGroupOverrides(
  overrides: Record<string, string>,
): Promise<void> {
  await set(ARTIST_OVERRIDES_KEY, overrides);
}
