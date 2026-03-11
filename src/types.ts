export interface Song {
  id: string; // File path or relative path
  title: string;
  artist: string;
  album: string;
  duration: number;
  // Basic tags
  trackNumber?: number;
  year?: number;
  genre?: string;
  fileHandle: FileSystemFileHandle;
  // Extended tags
  albumArtist?: string;
  composer?: string;
  diskNumber?: number;
  totalTracks?: number;
  totalDiscs?: number;
  bpm?: number;
  initialKey?: string;
  isrc?: string;
  copyright?: string;
  encodedBy?: string;
  encoderSettings?: string;
  comment?: string;
  label?: string;
  lyrics?: string;
  replayGainTrack?: number;
  replayGainAlbum?: number;
  language?: string;
  mood?: string;
  musicbrainzRecordingId?: string;
  musicbrainzAlbumId?: string;
  musicbrainzArtistId?: string;
  musicbrainzAlbumArtistId?: string;
  // Audio format / technical
  container?: string;
  codec?: string;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  lossless?: boolean;
  codecProfile?: string;
}

export interface Playlist {
  id: string;
  name: string;
  songIds: string[];
}

export interface PlayHistoryEntry {
  id: string;
  songId: string;
  playedAt: number;
  listenedSeconds: number;
  songDuration: number;
}

export interface SongPlayStats {
  songId: string;
  playCount: number;
  playDurations: number[];
  totalListenedSeconds: number;
  lastPlayedAt: number;
}

export interface PlayHistoryState {
  entries: PlayHistoryEntry[];
  stats: Record<string, SongPlayStats>;
}

export interface HistoryViewItem {
  entry: PlayHistoryEntry;
  song: Song;
  stats?: SongPlayStats;
}

export type FilterType = 'All' | 'Artists' | 'Albums' | 'Playlist' | 'History';

export interface LibraryState {
  songs: Song[];
  artists: string[];
  albums: string[];
  isLoading: boolean;
  error: string | null;
}

export type SongSortColumn = 'title' | 'artist' | 'album' | 'duration' | 'genre';
export type HistorySortColumn = 'title' | 'artist' | 'album' | 'playedAt' | 'listenedSeconds' | 'playCount';
export type SortColumn = SongSortColumn | HistorySortColumn;
export type SortDirection = 'asc' | 'desc';
