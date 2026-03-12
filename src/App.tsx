import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { FilterType, HistorySortColumn, HistoryViewItem, PlayHistoryEntry, PlayHistoryState, RepeatMode, Song, SongSortColumn, SortDirection } from './types';
import { getDirectoryHandle, saveDirectoryHandle, getSongsCache, saveSongsCache, getPlaylists, savePlaylists, getPlayHistory, savePlayHistory, getArtworkBlob, saveArtworkBlob, getArtistUrl, saveArtistUrl, getArtistGroupOverrides, saveArtistGroupOverrides, getQueue, saveQueue, getPlaybackPreferences, savePlaybackPreferences } from './db';
import { getCanonicalArtist, artistGroupKey } from './lib/artistNorm';
import type { AlbumArtworkResult } from './lib/artwork';
import { searchArtistImage, searchAlbumArtwork } from './lib/artwork';
import { collectFiles, parseMetadataInBackground } from './lib/scanner';
import { Player } from './components/Player';
import { Sidebar } from './components/Sidebar';
import { Library } from './components/Library';
import { Visualizer } from './components/Visualizer';
import { SongDetailsPane } from './components/NowPlaying';
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

function buildShuffledSongIds(songs: Song[], anchorSongId?: string, avoidFirstSongId?: string): string[] {
  const ids = songs.map(song => song.id);
  if (ids.length <= 1) return ids;
  if (anchorSongId && ids.includes(anchorSongId)) {
    const rest = shuffleArray(ids.filter(id => id !== anchorSongId));
    return [anchorSongId, ...rest];
  }
  const shuffled = shuffleArray(ids);
  if (avoidFirstSongId && shuffled.length > 1 && shuffled[0] === avoidFirstSongId) {
    const swapIndex = 1 + Math.floor(Math.random() * (shuffled.length - 1));
    [shuffled[0], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[0]];
  }
  return shuffled;
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
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userQueue, setUserQueueState] = useState<string[]>([]);

  const [filterType, setFilterType] = useState<FilterType>('All');
  const [filterValue, setFilterValue] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchQueryDebounced, setSearchQueryDebounced] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearchQueryDebounced(searchQuery), 150);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  const [sortColumn, setSortColumn] = useState<SongSortColumn>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [historySortColumn, setHistorySortColumn] = useState<HistorySortColumn>('playedAt');
  const [historySortDirection, setHistorySortDirection] = useState<SortDirection>('desc');
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [playlists, setPlaylistsState] = useState<{ id: string; name: string; songIds: string[] }[]>([]);
  const [playHistory, setPlayHistoryState] = useState<PlayHistoryState>({ entries: [], stats: {} });
  const [artistGroupOverrides, setArtistGroupOverridesState] = useState<Record<string, string>>({});

  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [showVisualizer, setShowVisualizer] = useState(true);
  const [showSongDetails, setShowSongDetails] = useState(true);
  const [isVizMaximized, setIsVizMaximized] = useState(false);

  const seekRef = useRef<((time: number) => void) | null>(null);
  const shuffleCycleRef = useRef<{ contextKey: string; order: string[] }>({ contextKey: '', order: [] });

  // ─── Artwork cache ────────────────────────────────────────────────────────
  // In-memory map: "${artist}::${album}" -> object URL (created from Blob).
  // Blobs live in IndexedDB; object URLs are re-created each session.
  const [artworkCache, setArtworkCache] = useState<Map<string, string>>(new Map());

  function artworkCacheKey(artist: string, album: string) {
    return `${artist.toLowerCase().trim()}::${album.toLowerCase().trim()}`;
  }

  // ─── Artist avatar cache ──────────────────────────────────────────────────
  // Same pattern as artwork but keyed by artist name only.
  const [artistCache, setArtistCache] = useState<Map<string, string>>(new Map());

  function artistCacheKey(artist: string) {
    return artist.toLowerCase().trim();
  }

  // ─── Resizable column widths (px) ───────────────────────────────────────
  const [sidebarW, setSidebarW] = useState(220);
  const [vizPanelW, setVizPanelW] = useState(520);
  const [detailsPanelW, setDetailsPanelW] = useState(280);

  const abortRef = useRef<AbortController | null>(null);

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
      const history = await getPlayHistory();
      setPlayHistoryState(history);
      const overrides = await getArtistGroupOverrides();
      setArtistGroupOverridesState(overrides);
      const q = await getQueue();
      setUserQueueState(q);
      const playbackPreferences = await getPlaybackPreferences();
      setShuffleOn(playbackPreferences.shuffleOn);
      setRepeatMode(playbackPreferences.repeatMode);
      setShowSongDetails(playbackPreferences.showSongDetails);
    }
    init();
  }, [doScan]);

  useEffect(() => {
    savePlaybackPreferences({ shuffleOn, repeatMode, showSongDetails });
  }, [shuffleOn, repeatMode, showSongDetails]);

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

  const songMap = useMemo(() => new Map(songs.map(song => [song.id, song])), [songs]);
  const displaySong = selectedSong ?? currentSong;

  const historyItems = useMemo(() => {
    const songMap = new Map(songs.map(song => [song.id, song]));
    return playHistory.entries
      .slice()
      .sort((a, b) => b.playedAt - a.playedAt)
      .reduce<HistoryViewItem[]>((items, entry) => {
        const song = songMap.get(entry.songId);
        if (!song) return items;
        items.push({ entry, song, stats: playHistory.stats[entry.songId] });
        return items;
      }, []);
  }, [playHistory.entries, playHistory.stats, songs]);

  const filteredHistoryItems = useMemo(() => {
    let list = historyItems;
    if (searchQueryDebounced.trim()) {
      const q = searchQueryDebounced.trim().toLowerCase();
      const tagged: Record<string, string> = {};
      const tagRegex = /(artist|album|title|name|genre):\s*([^\s]+)/gi;
      let m;
      while ((m = tagRegex.exec(q)) !== null) tagged[m[1].toLowerCase()] = m[2].toLowerCase();
      const rest = q.replace(/(artist|album|title|name|genre):\s*[^\s]+/gi, '').replace(/\s+/g, ' ').trim();
      const terms = rest ? rest.split(/\s+/).filter(Boolean) : [];
      list = list.filter(({ song }) => {
        if (tagged.artist && !song.artist.toLowerCase().includes(tagged.artist)) return false;
        if (tagged.album && !song.album.toLowerCase().includes(tagged.album)) return false;
        if ((tagged.title || tagged.name) && !song.title.toLowerCase().includes((tagged.title || tagged.name))) return false;
        if (tagged.genre && !(song.genre || '').toLowerCase().includes(tagged.genre)) return false;
        if (terms.length === 0 && Object.keys(tagged).length > 0) return true;
        if (terms.length === 0) return true;
        const all = `${song.title} ${song.artist} ${song.album} ${song.genre || ''}`.toLowerCase();
        return terms.every(t => all.includes(t));
      });
    }
    return list;
  }, [historyItems, searchQueryDebounced]);

  const sortedHistoryItems = useMemo(() => {
    const list = [...filteredHistoryItems];
    list.sort((a, b) => {
      if (historySortColumn === 'playedAt') {
        return historySortDirection === 'asc'
          ? a.entry.playedAt - b.entry.playedAt
          : b.entry.playedAt - a.entry.playedAt;
      }
      if (historySortColumn === 'listenedSeconds') {
        return historySortDirection === 'asc'
          ? a.entry.listenedSeconds - b.entry.listenedSeconds
          : b.entry.listenedSeconds - a.entry.listenedSeconds;
      }
      if (historySortColumn === 'playCount') {
        const aCount = a.stats?.playCount ?? 1;
        const bCount = b.stats?.playCount ?? 1;
        return historySortDirection === 'asc' ? aCount - bCount : bCount - aCount;
      }
      const aValue = String(a.song[historySortColumn] ?? '').toLowerCase();
      const bValue = String(b.song[historySortColumn] ?? '').toLowerCase();
      const cmp = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return historySortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredHistoryItems, historySortColumn, historySortDirection]);

  const queueSongs = useMemo(() => {
    return userQueue.map(id => songMap.get(id)).filter((s): s is Song => Boolean(s));
  }, [songMap, userQueue]);

  const songListForView = useMemo(() => {
    if (filterType === 'History') return sortedHistoryItems.map(item => item.song);
    if (filterType === 'Queue') return queueSongs;
    let list = songs;
    if (filterType === 'Artists' && filterValue) {
      // Match by canonical name so "Kid Cudi feat. X" rows still show when
      // the user has selected "Kid Cudi" from the grouped sidebar list.
      const targetKey = artistGroupKey(filterValue);
      list = list.filter(s =>
        artistGroupKey(getCanonicalArtist(s.artist, artistGroupOverrides)) === targetKey
      );
    } else if (filterType === 'Albums' && filterValue) {
      list = list.filter(s => s.album === filterValue);
    } else if (filterType === 'Playlist' && filterValue) {
      const pl = playlists.find(p => p.id === filterValue);
      const ids = pl ? new Set(pl.songIds) : new Set<string>();
      list = list.filter(s => ids.has(s.id));
    }
    return list;
  }, [songs, filterType, filterValue, playlists, sortedHistoryItems]);

  const visibleSongs = useMemo(() => {
    let list = songListForView;
    if (searchQueryDebounced.trim()) {
      const q = searchQueryDebounced.trim().toLowerCase();
      const tagged: Record<string, string> = {};
      const tagRegex = /(artist|album|title|name|genre):\s*([^\s]+)/gi;
      let m;
      while ((m = tagRegex.exec(q)) !== null) tagged[m[1].toLowerCase()] = m[2].toLowerCase();
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
    if (filterType === 'History' || filterType === 'Queue') return list;
    return [...list].sort((a, b) => {
      let va: string | number = (a as any)[sortColumn] ?? '';
      let vb: string | number = (b as any)[sortColumn] ?? '';
      if (sortColumn === 'duration') {
        va = Number(va) || 0; vb = Number(vb) || 0;
        return sortDirection === 'asc' ? va - vb : vb - va;
      }
      va = String(va).toLowerCase(); vb = String(vb).toLowerCase();
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [songListForView, searchQueryDebounced, sortColumn, sortDirection, playlists, filterType]);

  const playbackContextKey = useMemo(() => (
    `${filterType}::${filterValue}::${searchQueryDebounced}::${sortColumn}::${sortDirection}::${visibleSongs.map(song => song.id).join('|')}`
  ), [filterType, filterValue, searchQueryDebounced, sortColumn, sortDirection, visibleSongs]);

  const syncShuffleCycle = useCallback((contextSongs: Song[], contextKey: string, options?: { anchorSongId?: string; avoidFirstSongId?: string }) => {
    shuffleCycleRef.current = {
      contextKey,
      order: buildShuffledSongIds(contextSongs, options?.anchorSongId, options?.avoidFirstSongId),
    };
  }, []);

  const ensureShuffleCycle = useCallback((anchorSongId?: string) => {
    if (!shuffleOn) return [];
    const current = shuffleCycleRef.current;
    const visibleSongIds = new Set(visibleSongs.map(song => song.id));
    const isValid =
      current.contextKey === playbackContextKey &&
      current.order.length === visibleSongs.length &&
      current.order.every(id => visibleSongIds.has(id));
    if (!isValid) {
      syncShuffleCycle(visibleSongs, playbackContextKey, { anchorSongId });
    }
    return shuffleCycleRef.current.order;
  }, [shuffleOn, visibleSongs, playbackContextKey, syncShuffleCycle]);

  useEffect(() => {
    if (!shuffleOn) {
      shuffleCycleRef.current = { contextKey: '', order: [] };
      return;
    }
    ensureShuffleCycle(currentSong?.id);
  }, [shuffleOn, visibleSongs, playbackContextKey, currentSong?.id, ensureShuffleCycle]);

  const playSong = useCallback((song: Song, options?: { source?: 'manual' | 'advance' }) => {
    if (shuffleOn && options?.source !== 'advance') {
      syncShuffleCycle(visibleSongs, playbackContextKey, { anchorSongId: song.id });
    }
    setCurrentSong(song);
    setSelectedSong(song);
    setIsPlaying(true);
  }, [shuffleOn, visibleSongs, playbackContextKey, syncShuffleCycle]);

  const playSongById = useCallback((songId: string, options?: { source?: 'manual' | 'advance' }) => {
    const song = songMap.get(songId);
    if (song) playSong(song, options);
  }, [songMap, playSong]);

  const selectSong = useCallback((song: Song) => { setSelectedSong(song); }, []);
  const currentVisibleIndex = currentSong ? visibleSongs.findIndex(s => s.id === currentSong.id) : -1;
  const displaySongStats = displaySong ? playHistory.stats[displaySong.id] : undefined;

  const addToQueue = useCallback((song: Song) => {
    setUserQueueState(prev => {
      const next = [...prev, song.id];
      saveQueue(next);
      return next;
    });
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setUserQueueState(prev => {
      const next = prev.filter((_, i) => i !== index);
      saveQueue(next);
      return next;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setUserQueueState([]);
    saveQueue([]);
  }, []);

  const nextSong = useCallback(() => {
    if (!currentSong) return;
    if (shuffleOn) {
      const order = ensureShuffleCycle(currentSong.id);
      const currentIndex = order.indexOf(currentSong.id);
      if (currentIndex < 0) return;
      const nextSongId = order[currentIndex + 1];
      if (nextSongId) {
        playSongById(nextSongId, { source: 'advance' });
        return;
      }
      if (repeatMode === 'context' && visibleSongs.length > 0) {
        syncShuffleCycle(visibleSongs, playbackContextKey, { avoidFirstSongId: currentSong.id });
        const restartSongId = shuffleCycleRef.current.order[0];
        if (restartSongId) playSongById(restartSongId, { source: 'advance' });
      }
      return;
    }
    if (currentVisibleIndex < 0) return;
    if (currentVisibleIndex < visibleSongs.length - 1) {
      playSong(visibleSongs[currentVisibleIndex + 1], { source: 'advance' });
      return;
    }
    if (repeatMode === 'context' && visibleSongs.length > 0) {
      playSong(visibleSongs[0], { source: 'advance' });
    }
  }, [currentSong, shuffleOn, ensureShuffleCycle, playSongById, repeatMode, visibleSongs, playbackContextKey, currentVisibleIndex, playSong, syncShuffleCycle]);

  const prevSong = useCallback(() => {
    if (!currentSong) return;
    if (shuffleOn) {
      const order = ensureShuffleCycle(currentSong.id);
      const currentIndex = order.indexOf(currentSong.id);
      if (currentIndex < 0) return;
      if (currentIndex > 0) {
        playSongById(order[currentIndex - 1], { source: 'advance' });
        return;
      }
      if (repeatMode === 'context' && order.length > 0) {
        playSongById(order[order.length - 1], { source: 'advance' });
      }
      return;
    }
    if (currentVisibleIndex < 0) return;
    if (currentVisibleIndex > 0) {
      playSong(visibleSongs[currentVisibleIndex - 1], { source: 'advance' });
      return;
    }
    if (repeatMode === 'context' && visibleSongs.length > 0) {
      playSong(visibleSongs[visibleSongs.length - 1], { source: 'advance' });
    }
  }, [currentSong, shuffleOn, ensureShuffleCycle, playSongById, repeatMode, currentVisibleIndex, playSong, visibleSongs]);

  const setPlaylists = useCallback((next: (prev: typeof playlists) => typeof playlists) => {
    setPlaylistsState(prev => {
      const updated = typeof next === 'function' ? next(prev) : next;
      savePlaylists(updated);
      return updated;
    });
  }, []);

  const appendPlayHistory = useCallback((entry: Omit<PlayHistoryEntry, 'id'>) => {
    setPlayHistoryState(prev => {
      const stats = prev.stats[entry.songId] ?? {
        songId: entry.songId,
        playCount: 0,
        playDurations: [],
        totalListenedSeconds: 0,
        lastPlayedAt: entry.playedAt,
      };
      const next: PlayHistoryState = {
        entries: [
          ...prev.entries,
          { ...entry, id: `hist-${entry.songId}-${entry.playedAt}-${Math.random().toString(36).slice(2, 8)}` },
        ],
        stats: {
          ...prev.stats,
          [entry.songId]: {
            ...stats,
            playCount: stats.playCount + 1,
            playDurations: [...stats.playDurations, entry.listenedSeconds],
            totalListenedSeconds: stats.totalListenedSeconds + entry.listenedSeconds,
            lastPlayedAt: entry.playedAt,
          },
        },
      };
      savePlayHistory(next);
      return next;
    });
  }, []);

  // Tracks which album/artist lookups have already been attempted this session
  // so we don't re-hit APIs for the same key after a failure.
  const autoSearchedRef = useRef(new Set<string>());

  // When the current song changes: load cached artwork from IndexedDB, and if
  // nothing is cached, automatically search external APIs and persist the result.
  useEffect(() => {
    if (!currentSong) return;
    let cancelled = false;

    const { artist, album } = currentSong;
    const albumKey = artworkCacheKey(artist, album);
    const canonical = getCanonicalArtist(artist, artistGroupOverrides);
    const aRawKey = artistCacheKey(artist);
    const aCanonKey = artistCacheKey(canonical);

    // ── Album artwork ──
    if (!artworkCache.has(albumKey)) {
      getArtworkBlob(artist, album).then(async (blob) => {
        if (cancelled) return;
        if (blob) {
          setArtworkCache(prev => new Map(prev).set(albumKey, URL.createObjectURL(blob)));
          return;
        }
        if (autoSearchedRef.current.has(`alb:${albumKey}`)) return;
        autoSearchedRef.current.add(`alb:${albumKey}`);
        try {
          const result = await searchAlbumArtwork(album, artist);
          if (cancelled) return;
          const res = await fetch(result.imageUrl);
          if (!res.ok || cancelled) return;
          const dlBlob = await res.blob();
          if (cancelled) return;
          await saveArtworkBlob(artist, album, dlBlob);
          setArtworkCache(prev => new Map(prev).set(albumKey, URL.createObjectURL(dlBlob)));
        } catch { /* auto-search miss — user can still retry manually */ }
      });
    }

    // ── Artist image ──
    if (!artistCache.has(aRawKey) || !artistCache.has(aCanonKey)) {
      Promise.all([
        getArtistUrl(artist),
        aCanonKey !== aRawKey ? getArtistUrl(canonical) : Promise.resolve(undefined),
      ]).then(async ([rawUrl, canonUrl]) => {
        if (cancelled) return;
        const existing = rawUrl || canonUrl;
        if (existing) {
          setArtistCache(prev => {
            const next = new Map(prev);
            next.set(aRawKey, existing);
            next.set(aCanonKey, existing);
            return next;
          });
          return;
        }
        if (autoSearchedRef.current.has(`art:${aCanonKey}`)) return;
        autoSearchedRef.current.add(`art:${aCanonKey}`);
        try {
          const url = await searchArtistImage(artist);
          if (cancelled) return;
          await saveArtistUrl(artist, url);
          if (aCanonKey !== aRawKey) await saveArtistUrl(canonical, url);
          setArtistCache(prev => {
            const next = new Map(prev);
            next.set(aRawKey, url);
            next.set(aCanonKey, url);
            return next;
          });
        } catch { /* auto-search miss */ }
      });
    }

    return () => { cancelled = true; };
  }, [currentSong, artistGroupOverrides]);

  // Album name → artwork object URL, for sidebar thumbnails.
  // Iterates songs once (memoised) and picks the first cached artwork per album.
  const albumArtworks = useMemo(() => {
    const map = new Map<string, string>();
    const checked = new Set<string>();
    for (const song of songs) {
      if (map.has(song.album)) continue;
      const key = artworkCacheKey(song.artist, song.album);
      if (checked.has(key)) continue;
      checked.add(key);
      const url = artworkCache.get(key);
      if (url) map.set(song.album, url);
    }
    return map;
  }, [songs, artworkCache]);

  // Called by NowPlayingPane when a search succeeds.
  // 1. Fetches the image and stores the Blob in IndexedDB.
  // 2. Creates a durable object URL and adds it to the in-memory cache.
  // 3. Returns the object URL so NowPlayingPane can display it immediately.
  // All other songs from the same album will pick up the URL on next render
  // because they share the same artworkCacheKey.
  const handleArtworkFound = useCallback(async (
    artist: string,
    album: string,
    result: AlbumArtworkResult,
  ): Promise<string> => {
    const res = await fetch(result.imageUrl);
    if (!res.ok) throw new Error('Artwork download failed.');
    const blob = await res.blob();
    await saveArtworkBlob(artist, album, blob);
    const url = URL.createObjectURL(blob);
    const key = artworkCacheKey(artist, album);
    setArtworkCache(prev => new Map(prev).set(key, url));
    return url;
  }, []);

  // Search, persist, and cache an artist image URL.
  // We store the URL string (not a blob) because artist CDNs block fetch() via CORS.
  // <img src> loads these fine — the browser doesn't enforce CORS on image elements.
  const handleArtistImageFound = useCallback(async (artist: string): Promise<string> => {
    const url = await searchArtistImage(artist);
    const canonical = getCanonicalArtist(artist, artistGroupOverrides);
    const canonKey = artistCacheKey(canonical);
    const rawKey = artistCacheKey(artist);

    await saveArtistUrl(artist, url);
    if (canonKey !== rawKey) await saveArtistUrl(canonical, url);

    setArtistCache(prev => {
      const next = new Map(prev);
      next.set(rawKey, url);
      next.set(canonKey, url);
      return next;
    });
    return url;
  }, [artistGroupOverrides]);

  const handleArtistGroupOverridesChange = useCallback(
    (next: Record<string, string>) => {
      setArtistGroupOverridesState(next);
      saveArtistGroupOverrides(next);
    },
    [],
  );

  const handleAnalyserReady = useCallback((node: AnalyserNode) => setAnalyser(node), []);

  const toggleVizMaximized = useCallback(() => setIsVizMaximized((v) => !v), []);

  // ─── Resize handlers ────────────────────────────────
  const handleSidebarDrag = useCallback((delta: number) => {
    setSidebarW(w => clamp(w + delta, 140, 600));
  }, []);

  const handleLibraryVizDrag = useCallback((delta: number) => {
    setVizPanelW(w => Math.max(200, w - delta));
  }, []);

  const handleDetailsPanelDrag = useCallback((delta: number) => {
    setDetailsPanelW(w => clamp(w - delta, 220, 480));
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
        onTrackEnd={nextSong}
        onAnalyserReady={handleAnalyserReady}
        shuffleOn={shuffleOn}
        onShuffleToggle={() => setShuffleOn(s => !s)}
        repeatMode={repeatMode}
        onRepeatModeChange={setRepeatMode}
        playlists={playlists}
        onAddToPlaylist={(songId, playlistId) => {
          setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, songIds: p.songIds.includes(songId) ? p.songIds : [...p.songIds, songId] } : p));
        }}
        onCreatePlaylistAndAdd={(songId, name) => {
          const id = `pl-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          setPlaylists(prev => [...prev, { id, name, songIds: [songId] }]);
        }}
        onTrackSessionComplete={appendPlayHistory}
        onArtistClick={(artist) => { setFilterType('Artists'); setFilterValue(artist); }}
        onAlbumClick={(album)  => { setFilterType('Albums');  setFilterValue(album); }}
        albumArtworkUrl={currentSong ? artworkCache.get(artworkCacheKey(currentSong.artist, currentSong.album)) : undefined}
        artistAvatarUrl={currentSong ? (artistCache.get(artistCacheKey(currentSong.artist)) ?? artistCache.get(artistCacheKey(getCanonicalArtist(currentSong.artist, artistGroupOverrides)))) : undefined}
        seekRef={seekRef}
        showSongDetails={showSongDetails}
        onSongDetailsToggle={() => setShowSongDetails(v => !v)}
      />

      <div className={`flex flex-1 overflow-hidden ${isVizMaximized ? 'flex-col' : ''}`}>
        {/* ── Sidebar (hidden when viz maximized) ── */}
        {!isVizMaximized && (
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
            historyItems={filteredHistoryItems}
            currentSong={currentSong}
            artistAvatars={artistCache}
            albumArtworks={albumArtworks}
            artistGroupOverrides={artistGroupOverrides}
            onArtistGroupOverridesChange={handleArtistGroupOverridesChange}
            userQueue={userQueue}
            queueSongs={queueSongs}
            onRemoveFromQueue={removeFromQueue}
            onClearQueue={clearQueue}
            onPlayHistoryItem={playSong}
            onPlaylistsChange={setPlaylists}
          />
        </div>
        )}

        {!isVizMaximized && <ResizeHandle onDrag={handleSidebarDrag} />}

        {/* ── Library (hidden when viz maximized) ── */}
        {!isVizMaximized && (
        <div className="flex-1 flex flex-col relative bg-white dark:bg-[#121212] min-w-[50px] h-full overflow-hidden">
          {loading && (
            <div className="absolute inset-0 z-10 bg-white/80 dark:bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
              <div className="text-lg font-medium">{loadingStatus}</div>
            </div>
          )}
          <div className="flex items-center px-4 py-1 bg-gray-50 dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-800 shrink-0">
            <span className="flex-1 text-xs text-gray-500">
              {loadingStatus || (filterType === 'History' ? `${filteredHistoryItems.length} plays` : filterType === 'Queue' ? `${queueSongs.length} queued` : `${songs.length} songs`)}
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
            songs={visibleSongs}
            historyItems={sortedHistoryItems}
            mode={filterType}
            sortColumn={filterType === 'History' ? historySortColumn : sortColumn}
            sortDirection={filterType === 'History' ? historySortDirection : sortDirection}
            onSort={(col, dir) => {
              if (filterType === 'History') {
                setHistorySortColumn(col as HistorySortColumn);
                setHistorySortDirection(dir);
                return;
              }
              setSortColumn(col as SongSortColumn);
              setSortDirection(dir);
            }}
            onPlay={playSong}
            onSelect={selectSong}
            onAddToQueue={addToQueue}
            currentSongId={currentSong?.id}
            selectedSongId={selectedSong?.id}
            contextSongId={currentVisibleIndex >= 0 ? currentSong?.id : undefined}
            onRescan={() => doScan(dirHandle)}
          />
        </div>
        )}

        {/* ── Song Details pane (hidden when viz maximized) ── */}
        {!isVizMaximized && showSongDetails && displaySong && (
          <>
            <ResizeHandle onDrag={handleDetailsPanelDrag} />
            <div className="shrink-0 h-full" style={{ width: detailsPanelW }}>
              <SongDetailsPane
                song={displaySong}
                isCurrentSong={displaySong.id === currentSong?.id}
                stats={displaySongStats}
                playlists={playlists}
                artworkUrl={artworkCache.get(artworkCacheKey(displaySong.artist, displaySong.album))}
                onArtworkFound={handleArtworkFound}
                artistUrl={artistCache.get(artistCacheKey(displaySong.artist)) ?? artistCache.get(artistCacheKey(getCanonicalArtist(displaySong.artist, artistGroupOverrides)))}
                onArtistImageFound={handleArtistImageFound}
                onPlay={() => playSong(displaySong)}
                onAddToQueue={() => addToQueue(displaySong)}
                onAddToPlaylist={(songId, playlistId) => {
                  setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, songIds: p.songIds.includes(songId) ? p.songIds : [...p.songIds, songId] } : p));
                }}
                onCreatePlaylistAndAdd={(songId, name) => {
                  const id = `pl-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                  setPlaylists(prev => [...prev, { id, name, songIds: [songId] }]);
                }}
                onArtistClick={(artist) => { setFilterType('Artists'); setFilterValue(artist); }}
                onAlbumClick={(album)  => { setFilterType('Albums');  setFilterValue(album); }}
              />
            </div>
          </>
        )}

        {/* ── Visualizer ── */}
        {showVisualizer && (
          <>
            {!isVizMaximized && <ResizeHandle onDrag={handleLibraryVizDrag} />}
            <div
              className={`h-full flex flex-col ${isVizMaximized ? 'flex-1 min-w-0' : 'shrink-0'}`}
              style={isVizMaximized ? undefined : { width: vizPanelW }}
            >
              <Visualizer
                analyser={analyser}
                isMaximized={isVizMaximized}
                onMaximizeToggle={toggleVizMaximized}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
