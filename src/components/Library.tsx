import { useMemo } from 'react';
import { List } from 'react-window';
import type { Song } from '../types';
import { RefreshCw } from 'lucide-react';

interface LibraryProps {
  songs: Song[];
  filterType: 'All' | 'Artists' | 'Albums';
  filterValue: string;
  onPlay: (song: Song) => void;
  currentSongId?: string;
  onRescan: () => void;
}

interface RowExtraProps {
  filteredSongs: Song[];
  currentSongId?: string;
  onPlay: (song: Song) => void;
}

const ROW_HEIGHT = 28;

function formatTime(time: number) {
  if (!time || isNaN(time)) return '';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function SongRow(
  props: { ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: "listitem" }; index: number; style: React.CSSProperties } & RowExtraProps
) {
  const { index, style, filteredSongs, currentSongId, onPlay } = props;
  const song = filteredSongs[index];
  if (!song) return null;

  const isCurrent = song.id === currentSongId;
  const isEven = index % 2 === 0;

  return (
    <div
      style={style}
      className={`flex items-center px-4 text-sm cursor-default select-none
        ${isCurrent
          ? 'bg-blue-600 text-white'
          : isEven
            ? 'bg-white dark:bg-[#121212] text-gray-800 dark:text-gray-200 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600'
            : 'bg-[#f8f9fa] dark:bg-[#161616] text-gray-800 dark:text-gray-200 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600'}`}
      onDoubleClick={() => onPlay(song)}
    >
      <div className="w-8 flex-shrink-0 text-gray-400 text-xs">{index + 1}</div>
      <div className="flex-1 min-w-0 pr-4 truncate font-medium">{song.title}</div>
      <div className="w-16 flex-shrink-0 text-right pr-4 tabular-nums">{formatTime(song.duration)}</div>
      <div className="flex-1 min-w-0 pr-4 truncate">{song.artist}</div>
      <div className="flex-1 min-w-0 pr-4 truncate">{song.album}</div>
      <div className="w-24 flex-shrink-0 truncate">{song.genre || ''}</div>
      <div className="w-16 flex-shrink-0"></div>
    </div>
  );
}

export function Library({ songs, filterType, filterValue, onPlay, currentSongId, onRescan }: LibraryProps) {
  const filteredSongs = useMemo(() => {
    let result = songs;
    if (filterType === 'Artists' && filterValue) {
      result = result.filter(s => s.artist === filterValue);
    } else if (filterType === 'Albums' && filterValue) {
      result = result.filter(s => s.album === filterValue);
    }
    return result;
  }, [songs, filterType, filterValue]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center px-4 py-2 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-[#1a1a1a]">
        <div className="w-8 flex-shrink-0"></div>
        <div className="flex-1 min-w-0 pr-4">Name</div>
        <div className="w-16 flex-shrink-0 text-right pr-4">Time</div>
        <div className="flex-1 min-w-0 pr-4">Artist</div>
        <div className="flex-1 min-w-0 pr-4">Album</div>
        <div className="w-24 flex-shrink-0">Genre</div>
        <div className="w-16 flex-shrink-0 flex justify-end">
          <button onClick={onRescan} className="hover:text-blue-500 transition-colors" title="Rescan Library">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Virtualized Table Body */}
      <div className="flex-1 overflow-hidden">
        {filteredSongs.length > 0 ? (
          <List
            rowComponent={SongRow}
            rowCount={filteredSongs.length}
            rowHeight={ROW_HEIGHT}
            rowProps={{ filteredSongs, currentSongId, onPlay }}
            overscanCount={20}
            style={{ height: '100%' }}
          />
        ) : (
          <div className="p-8 text-center text-gray-500">No songs found.</div>
        )}
      </div>
    </div>
  );
}
