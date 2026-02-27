import { useRef, useMemo } from 'react';
import { highlightCode } from '../lib/highlighter';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

const FONT = "'SF Mono', Monaco, Menlo, 'Courier New', monospace";
const FONT_SIZE = '11px';
const LINE_HEIGHT = '1.7';
const PADDING = '12px';

export function CodeEditor({ value, onChange, onKeyDown }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const highlighted = useMemo(() => highlightCode(value), [value]);

  const handleScroll = () => {
    if (preRef.current && textareaRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const sharedStyle: React.CSSProperties = {
    fontFamily: FONT,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    padding: PADDING,
    margin: 0,
    border: 'none',
    whiteSpace: 'pre',
    wordWrap: 'normal',
    overflowWrap: 'normal',
    tabSize: 2,
    letterSpacing: '0px',
    boxSizing: 'border-box' as const,
  };

  return (
    <div className="code-editor relative flex-1 min-h-0 overflow-hidden bg-[#0d1117]">
      {/* Highlighted layer behind */}
      <pre
        ref={preRef}
        className="absolute inset-0 overflow-auto pointer-events-none m-0 select-none"
        style={sharedStyle}
        aria-hidden="true"
      >
        <code dangerouslySetInnerHTML={{ __html: highlighted + '\n' }} />
      </pre>

      {/* Transparent textarea on top */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onScroll={handleScroll}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="absolute inset-0 w-full h-full bg-transparent text-transparent caret-[#58a6ff] resize-none outline-none"
        style={{
          ...sharedStyle,
          caretColor: '#58a6ff',
          color: 'transparent',
        }}
        placeholder="Write your p5.js sketch here..."
      />
    </div>
  );
}
