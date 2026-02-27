import { useState, useEffect, useRef, useCallback } from 'react';
import type { Song } from './types';
import { getDirectoryHandle, saveDirectoryHandle, getSongsCache, saveSongsCache } from './db';
import { collectFiles, parseMetadataInBackground } from './lib/scanner';
import { Player } from './components/Player';
import { Sidebar } from './components/Sidebar';
import { Library } from './components/Library';
import { Visualizer } from './components/Visualizer';
import { ResizeHandle } from './components/ResizeHandle';
import { FolderOpen, Loader2, Activity } from 'lucide-react';

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

  const [filterType, setFilterType] = useState<'All' | 'Artists' | 'Albums'>('All');
  const [filterValue, setFilterValue] = useState<string>('');

  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [showVisualizer, setShowVisualizer] = useState(true);

  // ─── Resizable column widths (px) ───────────────────
  const [sidebarW, setSidebarW] = useState(220);
  const [canvasW, setCanvasW] = useState(320);
  const [editorW, setEditorW] = useState(360);

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

  const nextSong = () => {
    if (!currentSong) return;
    const idx = songs.findIndex(s => s.id === currentSong.id);
    if (idx !== -1 && idx < songs.length - 1) playSong(songs[idx + 1]);
  };

  const prevSong = () => {
    if (!currentSong) return;
    const idx = songs.findIndex(s => s.id === currentSong.id);
    if (idx !== -1 && idx > 0) playSong(songs[idx - 1]);
  };

  const handleAnalyserReady = useCallback((node: AnalyserNode) => setAnalyser(node), []);

  // ─── Resize handlers ────────────────────────────────
  const handleSidebarDrag = useCallback((delta: number) => {
    setSidebarW(w => clamp(w + delta, 140, 400));
  }, []);

  const handleLibraryVizDrag = useCallback((delta: number) => {
    // Dragging right = library grows, viz panel shrinks (reduce canvas first, then editor)
    // Dragging left = library shrinks, viz panel grows (grow canvas first, then editor)
    setCanvasW(cw => {
      const newCw = clamp(cw - delta, 150, 800);
      return newCw;
    });
  }, []);

  const handleCanvasEditorDrag = useCallback((delta: number) => {
    // Paired resize: canvas grows, editor shrinks (and vice versa)
    setCanvasW(cw => {
      const newCw = clamp(cw + delta, 180, 800);
      const actualDelta = newCw - cw;
      setEditorW(ew => clamp(ew - actualDelta, 180, 800));
      return newCw;
    });
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
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <div className="shrink-0 h-full border-r border-gray-300 dark:border-gray-800" style={{ width: sidebarW }}>
          <Sidebar
            songs={songs}
            filterType={filterType}
            setFilterType={setFilterType}
            filterValue={filterValue}
            setFilterValue={setFilterValue}
          />
        </div>

        <ResizeHandle onDrag={handleSidebarDrag} />

        {/* ── Library ── */}
        <div className="flex-1 flex flex-col relative bg-white dark:bg-[#121212] min-w-[200px] h-full">
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
            songs={songs}
            filterType={filterType}
            filterValue={filterValue}
            onPlay={playSong}
            currentSongId={currentSong?.id}
            onRescan={() => doScan(dirHandle)}
          />
        </div>

        {/* ── Visualizer (canvas + editor) ── */}
        {showVisualizer && (
          <>
            <ResizeHandle onDrag={handleLibraryVizDrag} />
            <div className="shrink-0 h-full" style={{ width: canvasW + editorW + 5 }}>
              <Visualizer
                analyser={analyser}
                canvasWidth={canvasW}
                onCanvasResize={handleCanvasEditorDrag}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
