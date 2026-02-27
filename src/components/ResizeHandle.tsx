import { useRef, useCallback } from 'react';

interface ResizeHandleProps {
  onDrag: (delta: number) => void;
}

export function ResizeHandle({ onDrag }: ResizeHandleProps) {
  const lastXRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    lastXRef.current = e.clientX;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - lastXRef.current;
      lastXRef.current = ev.clientX;
      onDrag(delta);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [onDrag]);

  return (
    <div
      className="w-[5px] shrink-0 cursor-col-resize bg-transparent hover:bg-blue-500/40 active:bg-blue-500/60 transition-colors relative group"
      onMouseDown={handleMouseDown}
    >
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-gray-300 dark:bg-gray-700 group-hover:bg-blue-500 group-active:bg-blue-400 transition-colors" />
    </div>
  );
}
