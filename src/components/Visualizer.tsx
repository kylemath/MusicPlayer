import { useEffect, useRef, useState, useCallback } from 'react';
import { Play as PlayIcon, AlertTriangle } from 'lucide-react';
import { DEFAULT_SKETCH, PRESET_SKETCHES } from '../lib/defaultSketches';
import { CodeEditor } from './CodeEditor';

declare const p5: any;

interface VisualizerProps {
  analyser: AnalyserNode | null;
}

interface AudioData {
  fft: Uint8Array;
  waveform: Float32Array;
  volume: number;
}

const PRESET_PREVIEWS: Record<string, { gradient: string; label: string }> = {
  'Synaptic Garden': { gradient: 'linear-gradient(135deg, #1a0a2e 0%, #4a1a6a 50%, #2d5a27 100%)', label: 'Neural growth' },
  'Temporal Strata': { gradient: 'linear-gradient(180deg, #2c1810 0%, #4a3520 30%, #1e3a5f 100%)', label: 'Spectrum layers' },
  'Phase Portrait': { gradient: 'linear-gradient(135deg, #0a0a12 0%, #1a3a5c 50%, #5c1a3a 100%)', label: 'Phase space' },
  'Resonance Field': { gradient: 'linear-gradient(135deg, #0d1b0d 0%, #1a3d1a 50%, #0d2d3d 100%)', label: 'Wave interference' },
  'Spectral Decomposition': { gradient: 'linear-gradient(135deg, #1a1a2e 0%, #2e1a4a 50%, #4a2e1a 100%)', label: 'Living Mondrian' },
};

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
      setSelectedPresetName(name);
    }
  };

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* ── Canvas (fills top) ── */}
      <div
        ref={canvasContainerRef}
        className="flex-1 min-h-0 relative overflow-hidden bg-black w-full"
      >
        {!analyser && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm z-10 pointer-events-none">
            Play a song to activate
          </div>
        )}
      </div>

      {/* ── Card catalogue: preset selector with preview ── */}
      <div className="shrink-0 px-2 py-2 bg-[#0d1117] border-t border-gray-800">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin" style={{ scrollbarWidth: 'thin' }}>
          {Object.keys(PRESET_SKETCHES).map((name) => {
            const preview = PRESET_PREVIEWS[name] ?? { gradient: 'linear-gradient(135deg, #1a1a2e, #2e2e4a)', label: name };
            const isSelected = selectedPresetName === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => loadPreset(name)}
                className={`shrink-0 w-24 rounded-lg overflow-hidden border-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0d1117] ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-700 hover:border-gray-500'
                }`}
              >
                <div
                  className="h-14 w-full"
                  style={{ background: preview.gradient }}
                />
                <div className="px-1.5 py-1 bg-[#161b22] text-[10px] font-medium text-gray-300 truncate text-center">
                  {name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Lower pill: editable code boundary ── */}
      <div className="shrink-0 px-3 pb-3">
        <div className="rounded-[2rem] overflow-hidden bg-[#0d1117] border border-gray-800 shadow-lg flex flex-col min-h-0" style={{ maxHeight: '220px' }}>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#161b22] border-b border-gray-800 shrink-0">
            <button
              onClick={handleRun}
              className="flex items-center gap-1 px-2 py-0.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded transition"
              title="Run (Cmd+Enter)"
            >
              <PlayIcon size={12} /> Run
            </button>
            {error && (
              <div className="flex items-center gap-1 text-red-400 text-xs truncate max-w-[200px]" title={error}>
                <AlertTriangle size={12} /> {error}
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden" style={{ height: '140px' }}>
            <CodeEditor
              value={code}
              onChange={setCode}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
