import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FilterType, HistoryViewItem, Song } from '../types';
import { Mic2, Disc, Library as LibIcon, Search, ListMusic, Plus, History, Sparkles, X, ChevronDown, ChevronRight, ListOrdered, Trash2 } from 'lucide-react';
import { buildArtistGroups, buildGroupingPrompt, parseLLMOverrides, getCanonicalArtist, artistGroupKey } from '../lib/artistNorm';

interface PlaylistItem { id: string; name: string; songIds: string[]; }

function MenuItem({
  icon: Icon, label, active, onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors text-sm
        ${active ? 'bg-blue-600 text-white font-medium' : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
      onClick={onClick}
    >
      <Icon size={18} className={active ? 'text-white' : 'text-gray-500 dark:text-gray-400'} />
      {label}
    </div>
  );
}

interface SidebarProps {
  songs: Song[];
  filterType: FilterType;
  setFilterType: (type: FilterType) => void;
  filterValue: string;
  setFilterValue: (val: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  playlists: PlaylistItem[];
  historyItems: HistoryViewItem[];
  currentSong: Song | null;
  artistAvatars?: Map<string, string>;
  albumArtworks?: Map<string, string>;
  artistGroupOverrides: Record<string, string>;
  onArtistGroupOverridesChange: (overrides: Record<string, string>) => void;
  userQueue: string[];
  queueSongs: Song[];
  onRemoveFromQueue: (index: number) => void;
  onClearQueue: () => void;
  onPlayHistoryItem: (song: Song) => void;
  onPlaylistsChange: (updater: (prev: PlaylistItem[]) => PlaylistItem[]) => void;
}

export function Sidebar({
  songs, filterType, setFilterType, filterValue, setFilterValue,
  searchQuery, onSearchChange, playlists, historyItems, currentSong,
  artistAvatars, albumArtworks, artistGroupOverrides, onArtistGroupOverridesChange,
  userQueue, queueSongs, onRemoveFromQueue, onClearQueue,
  onPlayHistoryItem, onPlaylistsChange,
}: SidebarProps) {
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const artistListRef = useRef<HTMLDivElement>(null);
  const albumListRef = useRef<HTMLDivElement>(null);
  const artistItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const albumItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── AI grouping modal state ──────────────────────────────────────────────
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiEndpoint, setAiEndpoint] = useState(() => localStorage.getItem('ai_endpoint') ?? 'https://api.openai.com/v1');
  const [aiKey, setAiKey] = useState(() => localStorage.getItem('ai_key') ?? '');
  const [aiModel, setAiModel] = useState(() => localStorage.getItem('ai_model') ?? 'gpt-4o-mini');
  const [aiRunning, setAiRunning] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showOverridesPanel, setShowOverridesPanel] = useState(false);

  // ── Artist groups (memoised, includes overrides) ─────────────────────────
  const artistGroups = useMemo(
    () => buildArtistGroups(songs, artistGroupOverrides),
    [songs, artistGroupOverrides],
  );

  // Key for current song's canonical artist — used for scroll-to and highlight
  const currentCanonicalArtistKey = useMemo(() => {
    if (!currentSong) return '';
    return artistGroupKey(getCanonicalArtist(currentSong.artist, artistGroupOverrides));
  }, [currentSong, artistGroupOverrides]);

  const albums = useMemo(() => {
    const set = new Set(songs.map(s => s.album));
    return Array.from(set).sort();
  }, [songs]);

  // Scroll sidebar to current artist/album when switching views
  useEffect(() => {
    if (filterType !== 'Artists' || !currentCanonicalArtistKey) return;
    const el = artistItemRefs.current[currentCanonicalArtistKey];
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [filterType, currentCanonicalArtistKey]);

  useEffect(() => {
    if (filterType !== 'Albums' || !currentSong?.album) return;
    const el = albumItemRefs.current[currentSong.album];
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [filterType, currentSong?.album]);

  const addPlaylist = () => {
    const name = newPlaylistName.trim();
    if (name) {
      onPlaylistsChange(prev => [...prev, { id: `pl-${Date.now()}-${Math.random().toString(36).slice(2)}`, name, songIds: [] }]);
      setNewPlaylistName('');
      setShowNewPlaylist(false);
    }
  };

  const formatTime = (time: number) => {
    if (!time || Number.isNaN(time)) return '0:00';
    return `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
  };

  const formatPlayedAt = (playedAt: number) =>
    new Date(playedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  // ── AI grouping ──────────────────────────────────────────────────────────
  const runAiGrouping = useCallback(async () => {
    setAiRunning(true);
    setAiError(null);
    setAiResult(null);

    // Save config to localStorage for next time
    localStorage.setItem('ai_endpoint', aiEndpoint);
    localStorage.setItem('ai_key', aiKey);
    localStorage.setItem('ai_model', aiModel);

    try {
      const canonicalNames = artistGroups.map(g => g.canonical);
      const prompt = buildGroupingPrompt(canonicalNames);

      const res = await fetch(`${aiEndpoint.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aiKey}`,
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`API error ${res.status}: ${err}`);
      }

      const data = await res.json() as { choices: Array<{ message: { content: string } }> };
      const raw = data.choices[0]?.message?.content ?? '';
      const newMappings = parseLLMOverrides(raw);

      // Merge with existing overrides
      const merged = { ...artistGroupOverrides, ...newMappings };
      onArtistGroupOverridesChange(merged);

      const count = Object.keys(newMappings).length;
      setAiResult(`✓ Applied ${count} grouping${count !== 1 ? 's' : ''}.`);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setAiRunning(false);
    }
  }, [aiEndpoint, aiKey, aiModel, artistGroups, artistGroupOverrides, onArtistGroupOverridesChange]);

  const overrideEntries = Object.entries(artistGroupOverrides);

  return (
    <div className="bg-[#f0f0f0] dark:bg-[#1e1e1e] flex flex-col overflow-hidden h-full">
      {/* Search */}
      <div className="shrink-0 p-2 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search… artist: album:"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-4">Library</div>
        <MenuItem icon={LibIcon} label="Songs" active={filterType === 'All'} onClick={() => { setFilterType('All'); setFilterValue(''); }} />
        <MenuItem icon={Mic2} label="Artists" active={filterType === 'Artists'} onClick={() => { setFilterType('Artists'); setFilterValue(''); }} />
        <MenuItem icon={Disc} label="Albums" active={filterType === 'Albums'} onClick={() => { setFilterType('Albums'); setFilterValue(''); }} />
        <MenuItem icon={ListMusic} label="Playlists" active={filterType === 'Playlist'} onClick={() => { setFilterType('Playlist'); setFilterValue(''); }} />
        <div
          className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors text-sm
            ${filterType === 'Queue' ? 'bg-blue-600 text-white font-medium' : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
          onClick={() => { setFilterType('Queue'); setFilterValue(''); }}
        >
          <ListOrdered size={18} className={filterType === 'Queue' ? 'text-white' : 'text-gray-500 dark:text-gray-400'} />
          Queue
          {userQueue.length > 0 && (
            <span className={`ml-auto text-[10px] px-1.5 rounded-full ${filterType === 'Queue' ? 'bg-white/20 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
              {userQueue.length}
            </span>
          )}
        </div>
        <MenuItem icon={History} label="History" active={filterType === 'History'} onClick={() => { setFilterType('History'); setFilterValue(''); }} />

        {/* ── Artist list ── */}
        {filterType === 'Artists' && (
          <div ref={artistListRef} className="mt-4 flex flex-col">
            <div className="flex items-center justify-between px-4 mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Artists
                <span className="ml-1.5 font-normal normal-case text-gray-400">({artistGroups.length})</span>
              </span>
              <button
                type="button"
                onClick={() => { setShowAiModal(true); setAiResult(null); setAiError(null); }}
                title="Group artists with AI"
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                <Sparkles size={10} />
                AI Group
              </button>
            </div>

            {artistGroups.map(group => {
              const isSelected = artistGroupKey(filterValue) === group.key;
              const isPlaying = currentCanonicalArtistKey === group.key;
              const avatarUrl = artistAvatars?.get(group.key);
              return (
                <div
                  ref={(el) => { artistItemRefs.current[group.key] = el; }}
                  key={group.key}
                  className={`pl-3 pr-4 py-1 text-sm cursor-pointer transition-colors flex items-center gap-2 min-w-0 ${
                    isSelected && isPlaying
                      ? 'bg-violet-600 text-white font-medium'
                      : isSelected
                        ? 'bg-blue-600 text-white'
                        : isPlaying
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-l-2 border-emerald-500'
                          : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                  onClick={() => setFilterValue(group.canonical)}
                >
                  <div className="w-6 h-6 rounded-full shrink-0 overflow-hidden bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-gray-400">
                    {avatarUrl
                      ? <img src={avatarUrl} alt={group.canonical} className="w-full h-full object-cover" />
                      : group.canonical.charAt(0).toUpperCase()
                    }
                  </div>
                  <span className="truncate flex-1">{group.canonical}</span>
                  {group.variantCount > 1 && (
                    <span
                      title={`${group.variantCount} artist name variants grouped`}
                      className={`text-[9px] shrink-0 px-1 rounded-full ${isSelected || isPlaying ? 'bg-white/20 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                    >
                      {group.variantCount}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Album list ── */}
        {filterType === 'Albums' && (
          <div ref={albumListRef} className="mt-4 flex flex-col">
            <div className="px-4 mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Albums
                <span className="ml-1.5 font-normal normal-case text-gray-400">({albums.length})</span>
              </span>
            </div>
            {albums.map(a => {
              const isSelected = filterValue === a;
              const isPlaying = currentSong?.album === a;
              const thumbUrl = albumArtworks?.get(a);
              return (
                <div
                  ref={(el) => { albumItemRefs.current[a] = el; }}
                  key={a}
                  className={`pl-3 pr-4 py-1 text-sm cursor-pointer transition-colors flex items-center gap-2 min-w-0 ${
                    isSelected && isPlaying
                      ? 'bg-violet-600 text-white font-medium'
                      : isSelected
                        ? 'bg-blue-600 text-white'
                        : isPlaying
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-l-2 border-emerald-500'
                          : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                  onClick={() => setFilterValue(a)}
                >
                  <div className="w-6 h-6 rounded shrink-0 overflow-hidden bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-[10px] text-gray-500 dark:text-gray-400">
                    {thumbUrl
                      ? <img src={thumbUrl} alt={a} className="w-full h-full object-cover" />
                      : <Disc size={12} />
                    }
                  </div>
                  <span className="truncate flex-1">{a}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Playlist list ── */}
        {filterType === 'Playlist' && (
          <div className="mt-6 flex flex-col">
            <div className="flex items-center justify-between px-4 mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Playlists</span>
              <button onClick={() => setShowNewPlaylist(true)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-800" title="New playlist">
                <Plus size={16} />
              </button>
            </div>
            {showNewPlaylist && (
              <div className="px-4 py-2 flex gap-1">
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPlaylist()}
                  placeholder="Playlist name"
                  className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                />
                <button onClick={addPlaylist} className="px-2 py-1 text-sm bg-blue-600 text-white rounded">Add</button>
              </div>
            )}
            {playlists.map(pl => (
              <div
                key={pl.id}
                className={`px-8 py-1 text-sm cursor-pointer truncate ${filterValue === pl.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                onClick={() => { setFilterValue(pl.id); setFilterType('Playlist'); }}
              >
                {pl.name} <span className="text-xs opacity-70">({pl.songIds.length})</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Queue list ── */}
        {filterType === 'Queue' && (
          <div className="mt-6 flex flex-col">
            <div className="flex items-center justify-between px-4 mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Up Next</span>
              {queueSongs.length > 0 && (
                <button
                  type="button"
                  onClick={onClearQueue}
                  className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-red-400 hover:text-red-500 transition-colors"
                  title="Clear queue"
                >
                  <Trash2 size={10} />
                  Clear
                </button>
              )}
            </div>
            {queueSongs.length > 0 ? queueSongs.map((song, i) => (
              <div key={`${song.id}-${i}`} className="flex items-center gap-2 pl-4 pr-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors group">
                <span className="text-[10px] text-gray-400 w-4 shrink-0 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate text-gray-800 dark:text-gray-200">{song.title}</div>
                  <div className="text-[11px] truncate text-gray-500 dark:text-gray-400">{song.artist}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveFromQueue(i)}
                  title="Remove from queue"
                  className="p-1 rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            )) : (
              <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">Queue is empty.</div>
            )}
          </div>
        )}

        {/* ── History list ── */}
        {filterType === 'History' && (
          <div className="mt-6 flex flex-col">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-4">Recently Played</div>
            {historyItems.length > 0 ? historyItems.map(({ entry, song, stats }) => (
              <button key={entry.id} type="button" className="px-4 py-2 text-left hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors" onClick={() => onPlayHistoryItem(song)}>
                <div className="text-sm truncate text-gray-800 dark:text-gray-200">{song.title}</div>
                <div className="text-xs truncate text-gray-500 dark:text-gray-400">{song.artist} · listened {formatTime(entry.listenedSeconds)}</div>
                <div className="text-[11px] truncate text-gray-400 dark:text-gray-500">{formatPlayedAt(entry.playedAt)} · {stats?.playCount ?? 1} plays</div>
              </button>
            )) : (
              <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">No listening history yet.</div>
            )}
          </div>
        )}
      </div>

      {/* ── AI grouping modal ─────────────────────────────────────────────── */}
      {showAiModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end" onClick={() => setShowAiModal(false)}>
          <div
            className="w-full bg-white dark:bg-[#1a1a1a] border-t border-gray-200 dark:border-gray-700 rounded-t-2xl p-4 shadow-2xl max-h-[85%] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                  <Sparkles size={16} className="text-violet-500" />
                  AI Artist Grouping
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Sends your artist list to an LLM to detect spelling / case duplicates.
                  Works with OpenAI, Anthropic (via proxy), OpenRouter, or local Ollama.
                </div>
              </div>
              <button type="button" onClick={() => setShowAiModal(false)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
                <X size={16} />
              </button>
            </div>

            {/* Config */}
            <div className="space-y-2 mb-4">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">API Endpoint</label>
                <input
                  type="text"
                  value={aiEndpoint}
                  onChange={(e) => setAiEndpoint(e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  placeholder="https://api.openai.com/v1"
                />
                <div className="text-[10px] text-gray-400 mt-0.5">Ollama: http://localhost:11434/v1 · OpenRouter: https://openrouter.ai/api/v1</div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">API Key</label>
                  <input
                    type="password"
                    value={aiKey}
                    onChange={(e) => setAiKey(e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                    placeholder="sk-... (leave blank for Ollama)"
                  />
                </div>
                <div className="w-36">
                  <label className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Model</label>
                  <input
                    type="text"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                    placeholder="gpt-4o-mini"
                  />
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              {artistGroups.length} canonical artists · {Object.keys(artistGroupOverrides).length} existing overrides
            </div>

            {/* Run button */}
            <button
              type="button"
              onClick={runAiGrouping}
              disabled={aiRunning}
              className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-medium flex items-center justify-center gap-2"
            >
              <Sparkles size={14} />
              {aiRunning ? 'Grouping…' : 'Group Artists with AI'}
            </button>

            {aiResult && <div className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{aiResult}</div>}
            {aiError  && <div className="mt-3 text-sm text-red-500 dark:text-red-400">{aiError}</div>}

            {/* Existing overrides */}
            {overrideEntries.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowOverridesPanel(v => !v)}
                  className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  {showOverridesPanel ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  {overrideEntries.length} active override{overrideEntries.length !== 1 ? 's' : ''}
                </button>
                {showOverridesPanel && (
                  <div className="mt-2 space-y-1 text-[11px]">
                    {overrideEntries.map(([variant, canonical]) => (
                      <div key={variant} className="flex items-center gap-2 justify-between">
                        <span className="text-gray-500 dark:text-gray-400 truncate flex-1">{variant} → <strong className="text-gray-800 dark:text-gray-200">{canonical}</strong></span>
                        <button
                          type="button"
                          onClick={() => {
                            const { [variant]: _removed, ...rest } = artistGroupOverrides;
                            onArtistGroupOverridesChange(rest);
                          }}
                          className="text-red-400 hover:text-red-600 shrink-0"
                          title="Remove override"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => onArtistGroupOverridesChange({})}
                      className="mt-1 text-red-400 hover:text-red-600"
                    >
                      Clear all overrides
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
