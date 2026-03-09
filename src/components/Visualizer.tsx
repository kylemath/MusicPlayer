import { useEffect, useRef, useState, useCallback } from 'react';
import { Play as PlayIcon, Zap } from 'lucide-react';
import { DEFAULT_SKETCH, PRESET_SKETCHES } from '../lib/defaultSketches';
import { CodeEditor } from './CodeEditor';
import { ResizeHandle } from './ResizeHandle';
import { MiniP5Preview } from './MiniP5Preview';

declare const p5: any;

interface VisualizerProps {
  analyser: AnalyserNode | null;
}

interface AudioData {
  fft: Uint8Array;
  waveform: Float32Array;
  volume: number;
}

export function Visualizer({ analyser }: VisualizerProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<any>(null);
  const audioDataRef = useRef<AudioData>({
    fft: new Uint8Array(1024),
    waveform: new Float32Array(1024),
    volume: 0,
  });
  const rafRef = useRef<number>(0);

  const [code, setCode] = useState(DEFAULT_SKETCH);
  const [error, setError] = useState<string | null>(null);
  const [selectedPresetName, setSelectedPresetName] = useState<string>('Synaptic Garden');
  const [canvasHeight, setCanvasHeight] = useState(200);
  const [catalogueHeight, setCatalogueHeight] = useState(192);
  const [autorun, setAutorun] = useState(false);

  // Continuously read analyser data
  useEffect(() => {
    if (!analyser) return;

    const fftBuf = new Uint8Array(analyser.frequencyBinCount);
    const wavBuf = new Float32Array(analyser.fftSize);

    function tick() {
      analyser!.getByteFrequencyData(fftBuf);
      analyser!.getFloatTimeDomainData(wavBuf);

      let sum = 0;
      for (let i = 0; i < wavBuf.length; i++) sum += wavBuf[i] * wavBuf[i];

      audioDataRef.current = { fft: fftBuf, waveform: wavBuf, volume: Math.sqrt(sum / wavBuf.length) };
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser]);

  const destroySketch = useCallback(() => {
    if (p5InstanceRef.current) {
      p5InstanceRef.current.remove();
      p5InstanceRef.current = null;
    }
  }, []);

  const runSketch = useCallback((sketchCode: string) => {
    destroySketch();
    setError(null);

    const container = canvasContainerRef.current;
    if (!container) return;

    container.querySelectorAll('canvas').forEach(c => c.remove());

    const W = container.clientWidth;
    const H = container.clientHeight;

    if (W === 0 || H === 0) return;

    try {
      // eslint-disable-next-line no-new-func
      const compiledInit = new Function(
        '__scope__',
        `with(__scope__) {\n${sketchCode}\nreturn { setup: typeof setup === 'function' ? setup : undefined, draw: typeof draw === 'function' ? draw : undefined };\n}`
      );

      const sketch = (p: any) => {
        const scopeProxy = new Proxy(p, {
          get(_target, prop: string) {
            if (prop === 'fft') return audioDataRef.current.fft;
            if (prop === 'waveform') return audioDataRef.current.waveform;
            if (prop === 'volume') return audioDataRef.current.volume;
            if (prop === 'W') return W;
            if (prop === 'H') return H;

            const val = (p as any)[prop];
            if (typeof val === 'function') return val.bind(p);
            return val;
          },
          has(_target, prop: string) {
            if (['fft', 'waveform', 'volume', 'W', 'H'].includes(prop)) return true;
            return prop in p;
          },
        });

        let userFns: any;
        try {
          userFns = compiledInit(scopeProxy);
        } catch (e: any) {
          setError(e.message);
          return;
        }

        if (userFns.setup) {
          p.setup = function () {
            try { userFns.setup(); }
            catch (e: any) { setError(e.message); }
          };
        } else {
          p.setup = () => { p.createCanvas(W, H); };
        }

        if (userFns.draw) {
          p.draw = function () {
            try { userFns.draw(); }
            catch (e: any) { setError(e.message); p.noLoop(); }
          };
        }
      };

      p5InstanceRef.current = new p5(sketch, container);
    } catch (e: any) {
      setError(e.message);
    }
  }, [destroySketch]);

  // Run sketch on mount
  useEffect(() => {
    const timer = setTimeout(() => runSketch(code), 200);
    return () => {
      clearTimeout(timer);
      destroySketch();
    };
  }, []);

  // Autorun: debounced run when code changes
  useEffect(() => {
    if (!autorun) return;
    const timer = setTimeout(() => runSketch(code), 400);
    return () => clearTimeout(timer);
  }, [autorun, code, runSketch]);

  const handleRun = () => runSketch(code);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target as HTMLTextAreaElement;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = code.substring(0, start) + '  ' + code.substring(end);
      setCode(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  };

  const loadPreset = (name: string) => {
    const preset = PRESET_SKETCHES[name];
    if (preset) {
      setCode(preset);
      runSketch(preset);
      setSelectedPresetName(name);
    }
  };

  const handleCanvasResize = useCallback((delta: number) => {
    setCanvasHeight((h) => Math.max(120, Math.min(500, h + delta)));
  }, []);

  const handleCatalogueResize = useCallback((delta: number) => {
    setCatalogueHeight((h) => Math.max(80, Math.min(400, h + delta)));
  }, []);

  return (
    <div className="flex flex-col h-full min-w-0 bg-gray-50 dark:bg-[#121212]">
      {/* ── Canvas (resizable height) ── */}
      <div
        ref={canvasContainerRef}
        className="shrink-0 relative overflow-hidden bg-black w-full rounded-3xl mx-2 mt-2"
        style={{ height: canvasHeight }}
      >
        {!analyser && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm z-10 pointer-events-none">
            Play a song to activate
          </div>
        )}
      </div>

      <ResizeHandle onDrag={handleCanvasResize} vertical />

      {/* ── Card catalogue: preset selector with preview ── */}
      <div className="shrink-0 px-2 py-2 bg-gray-50 dark:bg-[#1a1a1a] border-y border-gray-200 dark:border-gray-800 shadow-inner min-h-0 overflow-hidden" style={{ maxHeight: catalogueHeight }}>
        <div className="flex flex-wrap gap-2 overflow-y-auto overflow-x-hidden pb-1 scrollbar-thin" style={{ scrollbarWidth: 'thin', maxHeight: catalogueHeight - 16 }}>
          {Object.keys(PRESET_SKETCHES).map((name) => {
            const isSelected = selectedPresetName === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => loadPreset(name)}
                className={`shrink-0 w-28 rounded-lg overflow-hidden border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#1a1a1a] shadow-sm bg-white dark:bg-black ${
                  isSelected ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <div className="h-16 w-full relative bg-black">
                  <MiniP5Preview sketchCode={PRESET_SKETCHES[name]!} audioDataRef={audioDataRef} />
                </div>
                <div className="px-1.5 py-1 bg-white dark:bg-[#161b22] text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate text-center border-t border-gray-100 dark:border-gray-800">
                  {name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <ResizeHandle onDrag={handleCatalogueResize} vertical />

      {/* ── Lower section: editable code boundary ── */}
      <div className="flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-[#121212]">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-800 shrink-0 shadow-sm z-10">
          <button
            onClick={handleRun}
            className="flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs rounded transition shadow-sm"
            title="Run (Cmd+Enter)"
          >
            <PlayIcon size={12} className="text-green-600 dark:text-green-400" /> Run
          </button>
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={autorun}
              onChange={(e) => setAutorun(e.target.checked)}
              className="rounded border-gray-400 dark:border-gray-500"
            />
            <Zap size={12} className="text-amber-500" />
            <span>Autorun</span>
          </label>
          {error ? (
            <div className="flex items-center gap-2 flex-1 min-w-0" title={error}>
              <div className="error-dance shrink-0" aria-hidden>
                <svg viewBox="0 0 64 64" className="w-8 h-8 text-red-500 dark:text-red-400">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M 22 26 L 26 30 M 26 26 L 22 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M 38 26 L 42 30 M 42 26 L 38 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M 20 44 Q 32 52 44 44" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                  <ellipse cx="28" cy="18" rx="3" ry="4" fill="currentColor" opacity="0.6" />
                  <ellipse cx="36" cy="18" rx="3" ry="4" fill="currentColor" opacity="0.6" />
                </svg>
              </div>
              <span className="text-red-500 dark:text-red-400 text-xs truncate">{error}</span>
            </div>
          ) : null}
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          <CodeEditor
            value={code}
            onChange={setCode}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
    </div>
  );
}
