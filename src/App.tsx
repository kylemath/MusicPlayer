import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Song, SortColumn, SortDirection } from './types';
import { getDirectoryHandle, saveDirectoryHandle, getSongsCache, saveSongsCache, getPlaylists, savePlaylists } from './db';
import { collectFiles, parseMetadataInBackground } from './lib/scanner';
import { Player } from './components/Player';
import { Sidebar } from './components/Sidebar';
import { Library } from './components/Library';
import { Visualizer } from './components/Visualizer';
import { ResizeHandle } from './components/ResizeHandle';
import { FolderOpen, Loader2, Activity } from 'lucide-react';

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [hasPermission, setHasPermission] = useState(false);
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [filterType, setFilterType] = useState<'All' | 'Artists' | 'Albums' | 'Playlist'>('All');
  const [filterValue, setFilterValue] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchQueryDebounced, setSearchQueryDebounced] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearchQueryDebounced(searchQuery), 150);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  const [sortColumn, setSortColumn] = useState<SortColumn>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [shuffleOn, setShuffleOn] = useState(false);
  const [playlists, setPlaylistsState] = useState<{ id: string; name: string; songIds: string[] }[]>([]);

  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [showVisualizer, setShowVisualizer] = useState(true);

  // ─── Resizable column widths (px) ───────────────────
  const [sidebarW, setSidebarW] = useState(220);
  const [vizPanelW, setVizPanelW] = useState(520);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function init() {
      const handle = await getDirectoryHandle();
      if (handle) {
        setDirHandle(handle);
        const perm = await (handle as any).queryPermission({ mode: 'read' });
        if (perm === 'granted') {
          setHasPermission(true);
          const cache = await getSongsCache();
          if (cache && cache.length > 0) {
            setSongs(cache);
          } else {
            await doScan(handle);
          }
        }
      }
      const list = await getPlaylists();
      setPlaylistsState(list);
    }
    init();
  }, []);

  const requestPermission = async () => {
    if (!dirHandle) return;
    const perm = await (dirHandle as any).requestPermission({ mode: 'read' });
    if (perm === 'granted') {
      setHasPermission(true);
      const cache = await getSongsCache();
      if (cache && cache.length > 0) {
        setSongs(cache);
      } else {
        await doScan(dirHandle);
      }
    }
  };

  const selectFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      setDirHandle(handle);
      await saveDirectoryHandle(handle);
      setHasPermission(true);
      await doScan(handle);
    } catch (e) {
      console.error(e);
    }
  };

  const doScan = useCallback(async (handle: FileSystemDirectoryHandle) => {
    abortRef.current?.abort();
    setLoading(true);
    setLoadingStatus('Walking directory tree...');

    try {
      const initialSongs = await collectFiles(handle, (count) => {
        setLoadingStatus(`Found ${count} files...`);
      });
      setLoadingStatus(`Found ${initialSongs.length} songs. Loading...`);
      setSongs(initialSongs);
      setLoading(false);

      const controller = new AbortController();
      abortRef.current = controller;
      setLoadingStatus(`Enriching metadata: 0 / ${initialSongs.length}`);

      await parseMetadataInBackground(
        initialSongs,
        (updates) => {
          setSongs(prev => {
            const next = [...prev];
            for (let i = 0; i < next.length; i++) {
              const update = updates.get(next[i].id);
              if (update) next[i] = { ...next[i], ...update };
            }
            return next;
          });
        },
        (done, total) => setLoadingStatus(`Enriching metadata: ${done} / ${total}`),
        controller.signal
      );

      setSongs(current => { saveSongsCache(current); return current; });
      setLoadingStatus('');
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, []);

  const playSong = (song: Song) => { setCurrentSong(song); setIsPlaying(true); };

  // Build current view list: filter by view (artist/album/playlist) -> search -> sort -> optional shuffle
  const songListForView = useMemo(() => {
    let list = songs;
    if (filterType === 'Artists' && filterValue) {
      list = list.filter(s => s.artist === filterValue);
    } else if (filterType === 'Albums' && filterValue) {
      list = list.filter(s => s.album === filterValue);
    } else if (filterType === 'Playlist' && filterValue) {
      const pl = playlists.find(p => p.id === filterValue);
      const ids = pl ? new Set(pl.songIds) : new Set<string>();
      list = list.filter(s => ids.has(s.id));
    }
    return list;
  }, [songs, filterType, filterValue, playlists]);

  const queue = useMemo(() => {
    let list = songListForView;
    if (searchQueryDebounced.trim()) {
      const q = searchQueryDebounced.trim().toLowerCase();
      const tagged: Record<string, string> = {};
      const tagRegex = /(artist|album|title|name|genre):\s*([^\s]+)/gi;
      let m;
      while ((m = tagRegex.exec(q)) !== null) {
        tagged[m[1].toLowerCase()] = m[2].toLowerCase();
      }
      const rest = q.replace(/(artist|album|title|name|genre):\s*[^\s]+/gi, '').replace(/\s+/g, ' ').trim();
      const terms = rest ? rest.split(/\s+/).filter(Boolean) : [];
      list = list.filter(s => {
        if (tagged.artist && !s.artist.toLowerCase().includes(tagged.artist)) return false;
        if (tagged.album && !s.album.toLowerCase().includes(tagged.album)) return false;
        if ((tagged.title || tagged.name) && !s.title.toLowerCase().includes((tagged.title || tagged.name))) return false;
        if (tagged.genre && !(s.genre || '').toLowerCase().includes(tagged.genre)) return false;
        if (terms.length === 0 && Object.keys(tagged).length > 0) return true;
        if (terms.length === 0) return true;
        const all = `${s.title} ${s.artist} ${s.album} ${s.genre || ''}`.toLowerCase();
        return terms.every(t => all.includes(t));
      });
    }
    const sorted = [...list].sort((a, b) => {
      let va: string | number = (a as any)[sortColumn] ?? '';
      let vb: string | number = (b as any)[sortColumn] ?? '';
      if (sortColumn === 'duration') {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
        return sortDirection === 'asc' ? va - vb : vb - va;
      }
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return shuffleOn ? shuffleArray(sorted) : sorted;
  }, [songListForView, searchQueryDebounced, sortColumn, sortDirection, shuffleOn, playlists]);

  const currentQueueIndex = currentSong ? queue.findIndex(s => s.id === currentSong.id) : -1;

  const nextSong = () => {
    if (!currentSong || currentQueueIndex < 0) return;
    if (currentQueueIndex < queue.length - 1) playSong(queue[currentQueueIndex + 1]);
  };

  const prevSong = () => {
    if (!currentSong || currentQueueIndex < 0) return;
    if (currentQueueIndex > 0) playSong(queue[currentQueueIndex - 1]);
  };

  const setPlaylists = useCallback((next: (prev: typeof playlists) => typeof playlists) => {
    setPlaylistsState(prev => {
      const updated = typeof next === 'function' ? next(prev) : next;
      savePlaylists(updated);
      return updated;
    });
  }, []);

  const handleAnalyserReady = useCallback((node: AnalyserNode) => setAnalyser(node), []);

  // ─── Resize handlers ────────────────────────────────
  const handleSidebarDrag = useCallback((delta: number) => {
    setSidebarW(w => clamp(w + delta, 140, 600));
  }, []);

  const handleLibraryVizDrag = useCallback((delta: number) => {
    setVizPanelW(w => Math.max(200, w - delta));
  }, []);

  // ─── Welcome screen ────────────────────────────────
  if (!hasPermission || !dirHandle) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
        <div className="p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col items-center max-w-md text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center mb-6">
            <FolderOpen size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Welcome to Local Player</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Select your music folder to get started. We'll read your local audio files and organize them automatically.
          </p>
          {dirHandle ? (
            <button onClick={requestPermission} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors w-full">
              Grant Permission to Music Folder
            </button>
          ) : (
            <button onClick={selectFolder} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors w-full">
              Select Music Folder
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Main layout ───────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden text-gray-800 dark:text-gray-100 dark:bg-gray-900">
      <Player
        currentSong={currentSong}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        onNext={nextSong}
        onPrev={prevSong}
        onAnalyserReady={handleAnalyserReady}
        shuffleOn={shuffleOn}
        onShuffleToggle={() => setShuffleOn(s => !s)}
        playlists={playlists}
        onAddToPlaylist={(songId, playlistId) => {
          setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, songIds: p.songIds.includes(songId) ? p.songIds : [...p.songIds, songId] } : p));
        }}
        onCreatePlaylistAndAdd={(songId, name) => {
          const id = `pl-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          setPlaylists(prev => [...prev, { id, name, songIds: [songId] }]);
        }}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <div className="shrink-0 h-full border-r border-gray-300 dark:border-gray-800 flex flex-col" style={{ width: sidebarW }}>
          <Sidebar
            songs={songs}
            filterType={filterType}
            setFilterType={setFilterType}
            filterValue={filterValue}
            setFilterValue={setFilterValue}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            playlists={playlists}
            onPlaylistsChange={setPlaylists}
          />
        </div>

        <ResizeHandle onDrag={handleSidebarDrag} />

        {/* ── Library ── */}
        <div className="flex-1 flex flex-col relative bg-white dark:bg-[#121212] min-w-[50px] h-full overflow-hidden">
          {loading && (
            <div className="absolute inset-0 z-10 bg-white/80 dark:bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
              <div className="text-lg font-medium">{loadingStatus}</div>
            </div>
          )}
          <div className="flex items-center px-4 py-1 bg-gray-50 dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-800 shrink-0">
            <span className="flex-1 text-xs text-gray-500">
              {loadingStatus || `${songs.length} songs`}
            </span>
            <button
              onClick={() => setShowVisualizer(v => !v)}
              className={`p-1 rounded transition-colors ${showVisualizer ? 'text-blue-500 bg-blue-500/10' : 'text-gray-400 hover:text-gray-200'}`}
              title="Toggle Visualizer"
            >
              <Activity size={14} />
            </button>
          </div>
          <Library
            songs={queue}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={(col, dir) => { setSortColumn(col); setSortDirection(dir); }}
            onPlay={playSong}
            currentSongId={currentSong?.id}
            onRescan={() => doScan(dirHandle)}
          />
        </div>

        {/* ── Visualizer (canvas + preset cards + editor pill) ── */}
        {showVisualizer && (
          <>
            <ResizeHandle onDrag={handleLibraryVizDrag} />
            <div className="shrink-0 h-full flex flex-col" style={{ width: vizPanelW }}>
              <Visualizer analyser={analyser} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
