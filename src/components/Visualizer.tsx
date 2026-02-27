import { useEffect, useRef, useState, useCallback } from 'react';
import { Play as PlayIcon, AlertTriangle, ChevronDown } from 'lucide-react';
import { DEFAULT_SKETCH, PRESET_SKETCHES } from '../lib/defaultSketches';
import { CodeEditor } from './CodeEditor';
import { ResizeHandle } from './ResizeHandle';

declare const p5: any;

interface VisualizerProps {
  analyser: AnalyserNode | null;
  canvasWidth: number;
  onCanvasResize: (delta: number) => void;
}

interface AudioData {
  fft: Uint8Array;
  waveform: Float32Array;
  volume: number;
}

export function Visualizer({ analyser, canvasWidth, onCanvasResize }: VisualizerProps) {
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
  const [showPresets, setShowPresets] = useState(false);

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
    }
    setShowPresets(false);
  };

  return (
    <div className="flex h-full">
      {/* ── Canvas column ── */}
      <div
        ref={canvasContainerRef}
        className="relative overflow-hidden bg-black h-full shrink-0"
        style={{ width: canvasWidth }}
      >
        {!analyser && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm z-10 pointer-events-none">
            Play a song to activate
          </div>
        )}
      </div>

      {/* ── Handle between canvas & editor ── */}
      <ResizeHandle onDrag={onCanvasResize} />

      {/* ── Editor column ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-[#0d1117]">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-2 py-1 bg-[#161b22] border-b border-gray-800 shrink-0">
          <button
            onClick={handleRun}
            className="flex items-center gap-1 px-2 py-0.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded transition"
            title="Run (Cmd+Enter)"
          >
            <PlayIcon size={12} /> Run
          </button>

          <div className="relative">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="flex items-center gap-1 px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition"
            >
              Presets <ChevronDown size={12} />
            </button>
            {showPresets && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg z-30 min-w-[170px]">
                {Object.keys(PRESET_SKETCHES).map((name) => (
                  <div
                    key={name}
                    className="px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700 cursor-pointer"
                    onClick={() => loadPreset(name)}
                  >
                    {name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1" />

          {error && (
            <div className="flex items-center gap-1 text-red-400 text-xs truncate max-w-[220px]" title={error}>
              <AlertTriangle size={12} /> {error}
            </div>
          )}
        </div>

        {/* Syntax-highlighted code editor (fills remaining height) */}
        <CodeEditor
          value={code}
          onChange={setCode}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}
