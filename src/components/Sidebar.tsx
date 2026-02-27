import { useMemo } from 'react';
import type { Song } from '../types';
import { Mic2, Disc, Library as LibIcon } from 'lucide-react';

interface SidebarProps {
  songs: Song[];
  filterType: 'All' | 'Artists' | 'Albums';
  setFilterType: (type: 'All' | 'Artists' | 'Albums') => void;
  filterValue: string;
  setFilterValue: (val: string) => void;
}

export function Sidebar({ songs, filterType, setFilterType, filterValue, setFilterValue }: SidebarProps) {
  const artists = useMemo(() => {
    const set = new Set(songs.map(s => s.artist));
    return Array.from(set).sort();
  }, [songs]);

  const albums = useMemo(() => {
    const set = new Set(songs.map(s => s.album));
    return Array.from(set).sort();
  }, [songs]);

  const MenuItem = ({ icon: Icon, label, type, active }: { icon: any, label: string, type: string, active: boolean }) => (
    <div 
      className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors text-sm
        ${active ? 'bg-blue-600 text-white font-medium' : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
      onClick={() => {
        setFilterType(type as any);
        setFilterValue('');
      }}
    >
      <Icon size={18} className={active ? 'text-white' : 'text-gray-500 dark:text-gray-400'} />
      {label}
    </div>
  );

  return (
    <div className="bg-[#f0f0f0] dark:bg-[#1e1e1e] flex flex-col overflow-y-auto shrink-0 py-4 h-full">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-4">Library</div>
      <MenuItem icon={LibIcon} label="Songs" type="All" active={filterType === 'All'} />
      <MenuItem icon={Mic2} label="Artists" type="Artists" active={filterType === 'Artists'} />
      <MenuItem icon={Disc} label="Albums" type="Albums" active={filterType === 'Albums'} />

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
    </div>
  );
}
