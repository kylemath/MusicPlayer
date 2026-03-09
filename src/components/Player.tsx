import { useEffect, useRef, useState, useCallback } from 'react';
import type { Song } from '../types';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, ListPlus, SlidersHorizontal } from 'lucide-react';

interface PlaylistItem {
  id: string;
  name: string;
  songIds: string[];
}

interface PlayerProps {
  currentSong: Song | null;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  onAnalyserReady?: (analyser: AnalyserNode) => void;
  shuffleOn?: boolean;
  onShuffleToggle?: () => void;
  playlists?: PlaylistItem[];
  onAddToPlaylist?: (songId: string, playlistId: string) => void;
  onCreatePlaylistAndAdd?: (songId: string, name: string) => void;
}

// ─── EQ definitions ──────────────────────────────────
const EQ_BANDS = [
  { freq: 60,   label: '60'  },
  { freq: 170,  label: '170' },
  { freq: 350,  label: '350' },
  { freq: 1000, label: '1K'  },
  { freq: 3500, label: '3.5K'},
  { freq: 10000,label: '10K' },
] as const;

type EqGains = number[]; // one per band, in dB (-12 to +12)

const EQ_PRESETS: Record<string, EqGains> = {
  Flat:    [0,  0,  0,  0,  0,  0],
  Loud:    [6,  4,  0, -1,  3,  5],
  Quiet:   [-2, 0,  3,  4,  2, -1],
  Bass:    [8,  5,  1,  0,  0,  0],
  Treble:  [0,  0,  0,  1,  4,  7],
  Vocal:   [-2, 0,  3,  5,  3,  0],
};

export function Player({
  currentSong,
  isPlaying,
  setIsPlaying,
  onNext,
  onPrev,
  onAnalyserReady,
  shuffleOn = false,
  onShuffleToggle,
  playlists = [],
  onAddToPlaylist,
  onCreatePlaylistAndAdd,
}: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const eqRef = useRef<HTMLDivElement>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.25);
  const [muted, setMuted] = useState(false);
  const [playlistMenuOpen, setPlaylistMenuOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const [eqOpen, setEqOpen] = useState(false);
  const [eqGains, setEqGains] = useState<EqGains>([...EQ_PRESETS.Flat]);
  const [eqPreset, setEqPreset] = useState('Flat');

  const ensureAudioContext = useCallback(() => {
    if (audioCtxRef.current || !audioRef.current) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaElementSource(audioRef.current);
    sourceRef.current = source;

    // Build EQ filter chain: source -> [filters] -> analyser -> destination
    const filters = EQ_BANDS.map((band, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
      filter.frequency.value = band.freq;
      filter.Q.value = 1.0;
      filter.gain.value = eqGains[i];
      return filter;
    });
    eqFiltersRef.current = filters;

    // Chain: source -> f0 -> f1 -> ... -> fN -> analyser -> dest
    let prev: AudioNode = source;
    for (const f of filters) {
      prev.connect(f);
      prev = f;
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;

    prev.connect(analyser);
    analyser.connect(ctx.destination);

    onAnalyserReady?.(analyser);
  }, [onAnalyserReady]);

  // Sync EQ gains to filter nodes whenever they change
  useEffect(() => {
    eqFiltersRef.current.forEach((f, i) => {
      if (eqGains[i] !== undefined) {
        f.gain.value = eqGains[i];
      }
    });
  }, [eqGains]);

  useEffect(() => {
    if (currentSong && audioRef.current) {
      ensureAudioContext();

      const loadAudio = async () => {
        try {
          const file = await currentSong.fileHandle.getFile();
          const url = URL.createObjectURL(file);
          audioRef.current!.src = url;
          audioRef.current!.volume = volume;
          if (audioCtxRef.current?.state === 'suspended') {
            audioCtxRef.current.resume();
          }
          if (isPlaying) {
            audioRef.current!.play().catch(e => console.error(e));
          }
        } catch (e) {
          console.error("Failed to load audio file", e);
        }
      };
      loadAudio();

      return () => {
        if (audioRef.current && audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
        }
      };
    }
  }, [currentSong]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        if (audioCtxRef.current?.state === 'suspended') {
          audioCtxRef.current.resume();
        }
        audioRef.current.play().catch(e => console.error(e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVolume(v);
    setMuted(false);
  };

  const toggleMute = () => {
    setMuted(m => !m);
  };

  useEffect(() => {
    if (!playlistMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setPlaylistMenuOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [playlistMenuOpen]);

  useEffect(() => {
    if (!eqOpen) return;
    const close = (e: MouseEvent) => {
      if (eqRef.current && !eqRef.current.contains(e.target as Node)) setEqOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [eqOpen]);

  const applyPreset = (name: string) => {
    const gains = EQ_PRESETS[name];
    if (gains) {
      setEqGains([...gains]);
      setEqPreset(name);
    }
  };

  const handleBandChange = (bandIndex: number, value: number) => {
    setEqGains(prev => {
      const next = [...prev];
      next[bandIndex] = value;
      return next;
    });
    setEqPreset('Custom');
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-20 bg-gray-100 dark:bg-[#181818] flex items-center justify-between px-6 shrink-0 z-20 shadow-sm border-b border-gray-200 dark:border-gray-800">
      {/* Controls */}
      <div className="flex items-center gap-2 w-1/4">
        <button
          onClick={onShuffleToggle}
          className={`p-1.5 rounded transition ${shuffleOn ? 'text-blue-600 dark:text-blue-400 bg-blue-500/20' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}
          title="Shuffle"
        >
          <Shuffle size={20} />
        </button>
        <button className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition" onClick={onPrev}>
          <SkipBack size={24} fill="currentColor" />
        </button>
        <button
          className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
        </button>
        <button className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition" onClick={onNext}>
          <SkipForward size={24} fill="currentColor" />
        </button>
      </div>

      {/* Center LCD Screen */}
      <div className="flex-1 flex justify-center max-w-xl">
        <div className="bg-[#e4e4e4] dark:bg-[#282828] border border-gray-300 dark:border-black rounded w-full h-14 flex flex-col justify-center px-4 relative overflow-hidden shadow-inner">
          {currentSong ? (
            <>
              <div className="text-center font-medium text-sm truncate px-12">
                {currentSong.title}
              </div>
              <div className="text-center text-xs text-gray-500 dark:text-gray-400 truncate">
                {currentSong.artist} - {currentSong.album}
              </div>

              <div className="absolute bottom-1 left-4 text-[10px] text-gray-500">{formatTime(currentTime)}</div>
              <div className="absolute bottom-1 right-4 text-[10px] text-gray-500">-{formatTime(duration - currentTime)}</div>

              {/* Add to playlist icon */}
              {(onAddToPlaylist || onCreatePlaylistAndAdd) && (
                <div className="absolute top-1 right-2" ref={menuRef}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPlaylistMenuOpen(v => !v); }}
                    className="p-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700"
                    title="Add to playlist"
                  >
                    <ListPlus size={16} />
                  </button>
                  {playlistMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
                      <div className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">Add to playlist</div>
                      {playlists.map((pl) => (
                        <button
                          key={pl.id}
                          onClick={() => {
                            if (currentSong && onAddToPlaylist) onAddToPlaylist(currentSong.id, pl.id);
                            setPlaylistMenuOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          {pl.name}
                        </button>
                      ))}
                      <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1 px-2">
                        <input
                          type="text"
                          value={newPlaylistName}
                          onChange={(e) => setNewPlaylistName(e.target.value)}
                          placeholder="New playlist name"
                          className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        />
                        <button
                          onClick={() => {
                            if (currentSong && newPlaylistName.trim() && onCreatePlaylistAndAdd) {
                              onCreatePlaylistAndAdd(currentSong.id, newPlaylistName.trim());
                              setNewPlaylistName('');
                              setPlaylistMenuOpen(false);
                            }
                          }}
                          className="mt-1 w-full py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                        >
                          Create &amp; add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-300 dark:bg-gray-700">
                <div className="h-full bg-blue-500" style={{ width: `${(currentTime / duration) * 100}%` }}></div>
              </div>
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                step="0.1"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </>
          ) : (
            <div className="text-center text-gray-400 dark:text-gray-500 text-sm">Local Player</div>
          )}
        </div>
      </div>

      {/* EQ + Volume + Logo */}
      <div className="flex items-center justify-end gap-2 w-1/4">
        {/* ── Equalizer toggle + popover ── */}
        <div className="relative" ref={eqRef}>
          <button
            onClick={() => setEqOpen(v => !v)}
            className={`p-1.5 rounded transition ${eqOpen || eqPreset !== 'Flat' ? 'text-blue-600 dark:text-blue-400 bg-blue-500/20' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}
            title="Equalizer"
          >
            <SlidersHorizontal size={18} />
          </button>

          {eqOpen && (
            <div className="absolute right-0 top-full mt-2 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 p-3 w-[280px]">
              {/* Preset chips */}
              <div className="flex flex-wrap gap-1 mb-3">
                {Object.keys(EQ_PRESETS).map(name => (
                  <button
                    key={name}
                    onClick={() => applyPreset(name)}
                    className={`px-2 py-0.5 text-[11px] rounded-full border transition-colors ${
                      eqPreset === name
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {name}
                  </button>
                ))}
                {eqPreset === 'Custom' && (
                  <span className="px-2 py-0.5 text-[11px] rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-transparent">
                    Custom
                  </span>
                )}
              </div>

              {/* Band sliders */}
              <div className="flex items-end justify-between gap-1">
                {EQ_BANDS.map((band, i) => (
                  <div key={band.freq} className="flex flex-col items-center gap-1">
                    <span className="text-[9px] text-gray-500 tabular-nums w-7 text-center">
                      {eqGains[i] > 0 ? '+' : ''}{eqGains[i].toFixed(0)}
                    </span>
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={1}
                      value={eqGains[i]}
                      onChange={(e) => handleBandChange(i, Number(e.target.value))}
                      className="eq-slider accent-blue-500"
                      style={{
                        writingMode: 'vertical-lr' as any,
                        direction: 'rtl',
                        width: '18px',
                        height: '80px',
                        appearance: 'slider-vertical' as any,
                      }}
                    />
                    <span className="text-[9px] text-gray-400 dark:text-gray-500">{band.label}</span>
                  </div>
                ))}
              </div>

              {/* dB scale labels */}
              <div className="flex justify-between mt-1 px-1">
                <span className="text-[8px] text-gray-400">-12 dB</span>
                <span className="text-[8px] text-gray-400">0</span>
                <span className="text-[8px] text-gray-400">+12 dB</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Volume ── */}
        <button onClick={toggleMute} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition">
          {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={muted ? 0 : volume}
          onChange={handleVolumeChange}
          className="w-24 accent-blue-500 cursor-pointer"
        />
        <span className="ml-2 relative select-none" aria-label="KyleAmp">
          <span
            className="text-xl font-extrabold tracking-tight"
            style={{
              color: 'transparent',
              textShadow: '0 1px 1px rgba(255,255,255,0.25)',
            }}
          >
            KyleAmp
          </span>
          <span
            className="absolute inset-0 text-xl font-extrabold tracking-tight"
            style={{
              background: 'linear-gradient(180deg, #a8a8a8 0%, #6a6a6a 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            KyleAmp
          </span>
        </span>
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={onNext}
        crossOrigin="anonymous"
      />
    </div>
  );
}
