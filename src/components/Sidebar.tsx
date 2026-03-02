import { useMemo, useState } from 'react';
import type { Song } from '../types';
import { Mic2, Disc, Library as LibIcon, Search, ListMusic, Plus } from 'lucide-react';

interface PlaylistItem {
  id: string;
  name: string;
  songIds: string[];
}

interface SidebarProps {
  songs: Song[];
  filterType: 'All' | 'Artists' | 'Albums' | 'Playlist';
  setFilterType: (type: 'All' | 'Artists' | 'Albums' | 'Playlist') => void;
  filterValue: string;
  setFilterValue: (val: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  playlists: PlaylistItem[];
  onPlaylistsChange: (updater: (prev: PlaylistItem[]) => PlaylistItem[]) => void;
}

export function Sidebar({
  songs,
  filterType,
  setFilterType,
  filterValue,
  setFilterValue,
  searchQuery,
  onSearchChange,
  playlists,
  onPlaylistsChange,
}: SidebarProps) {
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);

  const artists = useMemo(() => {
    const set = new Set(songs.map(s => s.artist));
    return Array.from(set).sort();
  }, [songs]);

  const albums = useMemo(() => {
    const set = new Set(songs.map(s => s.album));
    return Array.from(set).sort();
  }, [songs]);

  const MenuItem = ({ icon: Icon, label, type, active }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; type: 'All' | 'Artists' | 'Albums' | 'Playlist'; active: boolean }) => (
    <div 
      className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors text-sm
        ${active ? 'bg-blue-600 text-white font-medium' : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
      onClick={() => {
        setFilterType(type);
        setFilterValue(type === 'Playlist' ? '' : '');
      }}
    >
      <Icon size={18} className={active ? 'text-white' : 'text-gray-500 dark:text-gray-400'} />
      {label}
    </div>
  );

  const addPlaylist = () => {
    const name = newPlaylistName.trim();
    if (name) {
      onPlaylistsChange(prev => [...prev, { id: `pl-${Date.now()}-${Math.random().toString(36).slice(2)}`, name, songIds: [] }]);
      setNewPlaylistName('');
      setShowNewPlaylist(false);
    }
  };

  return (
    <div className="bg-[#f0f0f0] dark:bg-[#1e1e1e] flex flex-col overflow-hidden h-full">
      {/* Quick search */}
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
        <MenuItem icon={LibIcon} label="Songs" type="All" active={filterType === 'All'} />
        <MenuItem icon={Mic2} label="Artists" type="Artists" active={filterType === 'Artists'} />
        <MenuItem icon={Disc} label="Albums" type="Albums" active={filterType === 'Albums'} />
        <MenuItem icon={ListMusic} label="Playlists" type="Playlist" active={filterType === 'Playlist'} />

        {filterType === 'Artists' && (
          <div className="mt-6 flex flex-col">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-4">All Artists</div>
            {artists.map(a => (
              <div 
                key={a}
                className={`px-8 py-1 text-sm cursor-pointer truncate ${filterValue === a ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                onClick={() => setFilterValue(a)}
              >
                {a}
              </div>
            ))}
          </div>
        )}

        {filterType === 'Albums' && (
          <div className="mt-6 flex flex-col">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-4">All Albums</div>
            {albums.map(a => (
              <div 
                key={a}
                className={`px-8 py-1 text-sm cursor-pointer truncate ${filterValue === a ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                onClick={() => setFilterValue(a)}
              >
                {a}
              </div>
            ))}
          </div>
        )}

        {filterType === 'Playlist' && (
          <div className="mt-6 flex flex-col">
            <div className="flex items-center justify-between px-4 mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Playlists</span>
              <button
                onClick={() => setShowNewPlaylist(true)}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-800"
                title="New playlist"
              >
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
      </div>
    </div>
  );
}
