import { useEffect, useRef } from 'react';

declare const p5: any;

interface MiniP5PreviewProps {
  sketchCode: string;
  audioDataRef: React.MutableRefObject<any>;
}

export function MiniP5Preview({ sketchCode, audioDataRef }: MiniP5PreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<any>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const W = container.clientWidth || 96;
    const H = container.clientHeight || 56;

    // Use a lower frame rate for previews to save CPU
    try {
      // eslint-disable-next-line no-new-func
      const compiledInit = new Function(
        '__scope__',
        `with(__scope__) {\n${sketchCode}\nreturn { setup: typeof setup === 'function' ? setup : undefined, draw: typeof draw === 'function' ? draw : undefined };\n}`
      );

      const sketch = (p: any) => {
        const scopeProxy = new Proxy(p, {
          get(_target, prop: string) {
            if (prop === 'fft')      return audioDataRef.current.fft;
            if (prop === 'waveform') return audioDataRef.current.waveform;
            if (prop === 'volume')   return audioDataRef.current.volume;
            if (prop === 'bpm')      return audioDataRef.current.bpm ?? 120;
            if (prop === 'W') return W;
            if (prop === 'H') return H;

            const val = (p as any)[prop];
            if (typeof val === 'function') return val.bind(p);
            return val;
          },
          has(_target, prop: string) {
            if (['fft', 'waveform', 'volume', 'bpm', 'W', 'H'].includes(prop)) return true;
            return prop in p;
          },
        });

        let userFns: any;
        try {
          userFns = compiledInit(scopeProxy);
        } catch (e: any) {
          return;
        }

        if (userFns.setup) {
          p.setup = function () {
            try { 
              userFns.setup(); 
              p.frameRate(15); // limit framerate for preview
            } catch (e: any) { }
          };
        } else {
          p.setup = () => { 
            p.createCanvas(W, H); 
            p.frameRate(15);
          };
        }

        if (userFns.draw) {
          p.draw = function () {
            try { userFns.draw(); }
            catch (e: any) { p.noLoop(); }
          };
        }
      };

      p5InstanceRef.current = new p5(sketch, container);
    } catch (e: any) {
      // ignore preview errors
    }

    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
        p5InstanceRef.current = null;
      }
    };
  }, [sketchCode, audioDataRef]);

  return <div ref={containerRef} className="w-full h-full overflow-hidden pointer-events-none" />;
}
