import { useCallback, useEffect, useMemo, useRef } from 'react';
import { List } from 'react-window';
import type { FilterType, HistoryViewItem, Song, SortColumn, SortDirection } from '../types';
import { RefreshCw, ArrowUp, ArrowDown } from 'lucide-react';

interface LibraryProps {
  songs: Song[];
  historyItems?: HistoryViewItem[];
  mode?: FilterType;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn, direction: SortDirection) => void;
  onPlay: (song: Song) => void;
  currentSongId?: string;
  contextSongId?: string;
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

interface HistoryRowExtraProps {
  items: HistoryViewItem[];
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

function formatPlayedAt(time: number) {
  return new Date(time).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function HistoryRow(props: { ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: "listitem" }; index: number; style: React.CSSProperties } & HistoryRowExtraProps) {
  const { index, style, items, currentSongId, onPlay } = props;
  const item = items[index];
  if (!item) return null;

  const isCurrent = item.song.id === currentSongId;
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
      onDoubleClick={() => onPlay(item.song)}
    >
      <div className="w-8 flex-shrink-0 text-gray-400 text-xs">{index + 1}</div>
      <div className="flex-1 min-w-[180px] pr-4 truncate font-medium">{item.song.title}</div>
      <div className="w-40 flex-shrink-0 pr-4 truncate">{item.song.artist}</div>
      <div className="w-36 flex-shrink-0 pr-4 text-xs tabular-nums text-gray-500 dark:text-gray-400">{formatPlayedAt(item.entry.playedAt)}</div>
      <div className="w-20 flex-shrink-0 pr-4 text-right tabular-nums">{formatTime(item.entry.listenedSeconds)}</div>
      <div className="w-16 flex-shrink-0 pr-4 text-right tabular-nums">{item.stats?.playCount ?? 1}</div>
      <div className="flex-1 min-w-[140px] pr-4 truncate">{item.song.album}</div>
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
  className = '',
}: {
  label: string;
  column: SortColumn;
  currentColumn: SortColumn;
  direction: SortDirection;
  onSort: (col: SortColumn, dir: SortDirection) => void;
  className?: string;
}) {
  const isActive = currentColumn === column;
  const handleClick = useCallback(() => {
    onSort(column, isActive && direction === 'asc' ? 'desc' : 'asc');
  }, [column, isActive, direction, onSort]);
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex items-center gap-0.5 hover:text-blue-600 dark:hover:text-blue-400 text-left ${className}`}
    >
      {label}
      {isActive && (direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
    </button>
  );
}

export function Library({
  songs,
  historyItems = [],
  mode = 'All',
  sortColumn,
  sortDirection,
  onSort,
  onPlay,
  currentSongId,
  contextSongId,
  onRescan,
}: LibraryProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const rowProps: SongRowExtraProps = { songs, currentSongId, onPlay };
  const historyRowProps: HistoryRowExtraProps = { items: historyItems, currentSongId, onPlay };
  const isHistoryMode = mode === 'History';
  const contextIndex = useMemo(() => {
    if (!contextSongId) return -1;
    if (isHistoryMode) {
      return historyItems.findIndex((item) => item.song.id === contextSongId);
    }
    return songs.findIndex((song) => song.id === contextSongId);
  }, [contextSongId, historyItems, isHistoryMode, songs]);

  useEffect(() => {
    if (contextIndex < 0) return;

    const frame = requestAnimationFrame(() => {
      const scrollContainer = bodyRef.current?.firstElementChild as HTMLElement | null;
      if (!scrollContainer) return;

      const viewportHeight = bodyRef.current?.clientHeight ?? 0;
      const targetTop = Math.max(0, contextIndex * ROW_HEIGHT - Math.max(0, viewportHeight / 2 - ROW_HEIGHT * 2));
      scrollContainer.scrollTo({ top: targetTop, behavior: 'smooth' });
    });

    return () => cancelAnimationFrame(frame);
  }, [contextIndex]);

  return (
    <div className="flex-1 flex flex-col overflow-x-auto bg-gray-50 dark:bg-[#1a1a1a]">
      <div className={`${isHistoryMode ? 'min-w-[840px]' : 'min-w-[660px]'} flex-1 flex flex-col min-h-0 bg-white dark:bg-[#121212]`}>
        {/* Table Header */}
        <div className="flex items-center px-4 py-2 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-[#1a1a1a] shrink-0">
          <div className="w-8 flex-shrink-0"></div>
          {isHistoryMode ? (
            <>
              <div className="flex-1 min-w-[180px] pr-4">
                <SortHeader label="Name" column="title" currentColumn={sortColumn} direction={sortDirection} onSort={onSort} />
              </div>
              <div className="w-40 flex-shrink-0 pr-4">
                <SortHeader label="Artist" column="artist" currentColumn={sortColumn} direction={sortDirection} onSort={onSort} />
              </div>
              <div className="w-36 flex-shrink-0 pr-4">
                <SortHeader label="Played" column="playedAt" currentColumn={sortColumn} direction={sortDirection} onSort={onSort} />
              </div>
              <div className="w-20 flex-shrink-0 pr-4 text-right">
                <SortHeader label="Listened" column="listenedSeconds" currentColumn={sortColumn} direction={sortDirection} onSort={onSort} className="ml-auto" />
              </div>
              <div className="w-16 flex-shrink-0 pr-4 text-right">
                <SortHeader label="Plays" column="playCount" currentColumn={sortColumn} direction={sortDirection} onSort={onSort} className="ml-auto" />
              </div>
              <div className="flex-1 min-w-[140px] pr-4">
                <SortHeader label="Album" column="album" currentColumn={sortColumn} direction={sortDirection} onSort={onSort} />
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
          <div className="w-16 flex-shrink-0 flex justify-end">
            <button onClick={onRescan} className="hover:text-blue-500 transition-colors" title="Rescan Library">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Virtualized Table Body */}
        <div ref={bodyRef} className="flex-1 overflow-hidden min-h-0 bg-white dark:bg-[#121212]">
          {isHistoryMode ? (
            historyItems.length > 0 ? (
              <List
                rowComponent={HistoryRow}
                rowCount={historyItems.length}
                rowHeight={ROW_HEIGHT}
                rowProps={historyRowProps}
                overscanCount={20}
                style={{ height: '100%', width: '100%' }}
              />
            ) : (
              <div className="p-8 text-center text-gray-500">No play history yet.</div>
            )
          ) : songs.length > 0 ? (
            <List
              rowComponent={SongRow}
              rowCount={songs.length}
              rowHeight={ROW_HEIGHT}
              rowProps={rowProps}
              overscanCount={20}
              style={{ height: '100%', width: '100%' }}
            />
          ) : (
            <div className="p-8 text-center text-gray-500">
              No songs found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
