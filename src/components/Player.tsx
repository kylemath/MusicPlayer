import { useEffect, useRef, useState, useCallback } from 'react';
import type { Song } from '../types';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';

interface PlayerProps {
  currentSong: Song | null;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  onAnalyserReady?: (analyser: AnalyserNode) => void;
}

export function Player({ currentSong, isPlaying, setIsPlaying, onNext, onPrev, onAnalyserReady }: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);

  const ensureAudioContext = useCallback(() => {
    if (audioCtxRef.current || !audioRef.current) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaElementSource(audioRef.current);
    sourceRef.current = source;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;

    source.connect(analyser);
    analyser.connect(ctx.destination);

    onAnalyserReady?.(analyser);
  }, [onAnalyserReady]);

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

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-20 bg-gray-100 dark:bg-[#181818] flex items-center justify-between px-6 shrink-0 z-20 shadow-sm border-b border-gray-200 dark:border-gray-800">
      {/* Controls */}
      <div className="flex items-center gap-4 w-1/4">
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

      {/* Volume + Logo */}
      <div className="flex items-center justify-end gap-2 w-1/4">
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
