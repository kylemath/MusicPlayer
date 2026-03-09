import { useRef, useCallback } from 'react';

interface ResizeHandleProps {
  onDrag: (delta: number) => void;
  /** If true, resize vertically (delta in Y). Default is horizontal (delta in X). */
  vertical?: boolean;
}

export function ResizeHandle({ onDrag, vertical }: ResizeHandleProps) {
  const lastRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    lastRef.current = vertical ? e.clientY : e.clientX;

    const onMouseMove = (ev: MouseEvent) => {
      const pos = vertical ? ev.clientY : ev.clientX;
      const delta = pos - lastRef.current;
      lastRef.current = pos;
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
    document.body.style.cursor = vertical ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
  }, [onDrag, vertical]);

  return (
    <div
      className={`shrink-0 bg-transparent hover:bg-blue-500/40 active:bg-blue-500/60 transition-colors relative group ${
        vertical
          ? 'h-[5px] cursor-row-resize'
          : 'w-[5px] cursor-col-resize'
      }`}
      onMouseDown={handleMouseDown}
    >
      <div
        className={`absolute bg-gray-300 dark:bg-gray-700 group-hover:bg-blue-500 group-active:bg-blue-400 transition-colors ${
          vertical
            ? 'inset-x-0 top-1/2 -translate-y-1/2 h-[1px]'
            : 'inset-y-0 left-1/2 -translate-x-1/2 w-[1px]'
        }`}
      />
    </div>
  );
}
