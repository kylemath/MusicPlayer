import { useCallback } from 'react';
import { List } from 'react-window';
import type { Song, SortColumn, SortDirection } from '../types';
import { RefreshCw, ArrowUp, ArrowDown } from 'lucide-react';

interface LibraryProps {
  songs: Song[];
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn, direction: SortDirection) => void;
  onPlay: (song: Song) => void;
  currentSongId?: string;
  onRescan: () => void;
}

const ROW_HEIGHT = 28;

function formatTime(time: number) {
  if (!time || isNaN(time)) return '';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface SongRowExtraProps {
  songs: Song[];
  currentSongId?: string;
  onPlay: (song: Song) => void;
}

function SongRow(props: { ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: "listitem" }; index: number; style: React.CSSProperties } & SongRowExtraProps) {
  const { index, style, songs, currentSongId, onPlay } = props;
  const song = songs[index];
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
      <div className="flex-1 min-w-[150px] pr-4 truncate font-medium">{song.title}</div>
      <div className="flex-1 min-w-[120px] pr-4 truncate">{song.artist}</div>
      <div className="w-16 flex-shrink-0 text-right pr-4 tabular-nums">{formatTime(song.duration)}</div>
      <div className="flex-1 min-w-[120px] pr-4 truncate">{song.album}</div>
      <div className="w-24 flex-shrink-0 truncate">{song.genre || ''}</div>
      <div className="w-16 flex-shrink-0"></div>
    </div>
  );
}

function SortHeader({
  label,
  column,
  currentColumn,
  direction,
  onSort,
}: {
  label: string;
  column: SortColumn;
  currentColumn: SortColumn;
  direction: SortDirection;
  onSort: (col: SortColumn, dir: SortDirection) => void;
}) {
  const isActive = currentColumn === column;
  const handleClick = useCallback(() => {
    onSort(column, isActive && direction === 'asc' ? 'desc' : 'asc');
  }, [column, isActive, direction, onSort]);
  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-0.5 hover:text-blue-600 dark:hover:text-blue-400 text-left"
    >
      {label}
      {isActive && (direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
    </button>
  );
}

export function Library({ songs, sortColumn, sortDirection, onSort, onPlay, currentSongId, onRescan }: LibraryProps) {
  const rowProps: SongRowExtraProps = { songs, currentSongId, onPlay };

  return (
    <div className="flex-1 flex flex-col overflow-x-auto bg-gray-50 dark:bg-[#1a1a1a]">
      <div className="min-w-[660px] flex-1 flex flex-col min-h-0 bg-white dark:bg-[#121212]">
        {/* Table Header */}
        <div className="flex items-center px-4 py-2 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-[#1a1a1a] shrink-0">
          <div className="w-8 flex-shrink-0"></div>
          <div className="flex-1 min-w-[150px] pr-4">
            <SortHeader label="Name" column="title" currentColumn={sortColumn} direction={sortDirection} onSort={onSort} />
          </div>
          <div className="flex-1 min-w-[120px] pr-4">
            <SortHeader label="Artist" column="artist" currentColumn={sortColumn} direction={sortDirection} onSort={onSort} />
          </div>
          <div className="w-16 flex-shrink-0 text-right pr-4">
            <SortHeader label="Time" column="duration" currentColumn={sortColumn} direction={sortDirection} onSort={onSort} />
          </div>
          <div className="flex-1 min-w-[120px] pr-4">
            <SortHeader label="Album" column="album" currentColumn={sortColumn} direction={sortDirection} onSort={onSort} />
          </div>
          <div className="w-24 flex-shrink-0">
            <SortHeader label="Genre" column="genre" currentColumn={sortColumn} direction={sortDirection} onSort={onSort} />
          </div>
          <div className="w-16 flex-shrink-0 flex justify-end">
            <button onClick={onRescan} className="hover:text-blue-500 transition-colors" title="Rescan Library">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Virtualized Table Body */}
        <div className="flex-1 overflow-hidden min-h-0 bg-white dark:bg-[#121212]">
          {songs.length > 0 ? (
            <List
              rowComponent={SongRow}
              rowCount={songs.length}
              rowHeight={ROW_HEIGHT}
              rowProps={rowProps}
              overscanCount={20}
              style={{ height: '100%', width: '100%' }}
            />
          ) : (
            <div className="p-8 text-center text-gray-500">No songs found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
