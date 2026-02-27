export interface Song {
  id: string; // File path or relative path
  title: string;
  artist: string;
  album: string;
  duration: number;
  trackNumber?: number;
  year?: number;
  genre?: string;
  fileHandle: FileSystemFileHandle;
}

export interface LibraryState {
  songs: Song[];
  artists: string[];
  albums: string[];
  isLoading: boolean;
  error: string | null;
}
