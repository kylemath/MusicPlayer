const KEYWORDS = new Set([
  'var', 'let', 'const', 'function', 'return', 'if', 'else',
  'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
  'new', 'typeof', 'instanceof', 'this', 'void', 'delete',
  'in', 'of', 'try', 'catch', 'finally', 'throw', 'class',
  'extends', 'import', 'export', 'default', 'from', 'async', 'await',
]);

const LITERALS = new Set([
  'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
]);

const AUDIO_VARS = new Set([
  'fft', 'waveform', 'volume', 'W', 'H',
]);

const P5_CONSTANTS = new Set([
  'PI', 'TWO_PI', 'HALF_PI', 'QUARTER_PI', 'TAU',
  'HSB', 'RGB', 'CENTER', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM',
  'CLOSE', 'BLEND', 'ADD', 'MULTIPLY', 'SCREEN', 'REPLACE',
  'DIFFERENCE', 'EXCLUSION', 'OVERLAY', 'HARD_LIGHT', 'SOFT_LIGHT',
  'DODGE', 'BURN', 'DEGREES', 'RADIANS', 'CORNER', 'CORNERS',
  'RADIUS', 'BASELINE', 'BOLD', 'ITALIC', 'NORMAL',
  'POINTS', 'LINES', 'TRIANGLES', 'TRIANGLE_FAN', 'TRIANGLE_STRIP',
  'QUADS', 'QUAD_STRIP',
]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function span(cls: string, text: string): string {
  return `<span class="hl-${cls}">${escapeHtml(text)}</span>`;
}

/**
 * Tokenize + highlight JavaScript/p5 code.
 * Returns an HTML string with <span class="hl-*"> wrappers.
 * Uses a linear scan so comments, strings and regexes are
 * handled correctly without a full parser.
 */
export function highlightCode(code: string): string {
  let out = '';
  let i = 0;
  const len = code.length;

  while (i < len) {
    const ch = code[i];

    // ─── Single-line comment ────────────────────
    if (ch === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i);
      const slice = end === -1 ? code.slice(i) : code.slice(i, end);
      out += span('comment', slice);
      i += slice.length;
      continue;
    }

    // ─── Multi-line comment ─────────────────────
    if (ch === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      const slice = end === -1 ? code.slice(i) : code.slice(i, end + 2);
      out += span('comment', slice);
      i += slice.length;
      continue;
    }

    // ─── Strings ────────────────────────────────
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < len) {
        if (code[j] === '\\') { j += 2; continue; }
        if (code[j] === quote) { j++; break; }
        j++;
      }
      out += span('string', code.slice(i, j));
      i = j;
      continue;
    }

    // ─── Numbers ────────────────────────────────
    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < len && /[0-9]/.test(code[i + 1]))) {
      let j = i;
      if (code[j] === '0' && (code[j + 1] === 'x' || code[j + 1] === 'X')) {
        j += 2;
        while (j < len && /[0-9a-fA-F]/.test(code[j])) j++;
      } else {
        while (j < len && /[0-9]/.test(code[j])) j++;
        if (j < len && code[j] === '.') {
          j++;
          while (j < len && /[0-9]/.test(code[j])) j++;
        }
        if (j < len && (code[j] === 'e' || code[j] === 'E')) {
          j++;
          if (j < len && (code[j] === '+' || code[j] === '-')) j++;
          while (j < len && /[0-9]/.test(code[j])) j++;
        }
      }
      out += span('number', code.slice(i, j));
      i = j;
      continue;
    }

    // ─── Identifiers + Keywords ─────────────────
    if (/[a-zA-Z_$]/.test(ch)) {
      let j = i + 1;
      while (j < len && /[a-zA-Z0-9_$]/.test(code[j])) j++;
      const word = code.slice(i, j);

      // Peek ahead for function call (identifier followed by `(`)
      let k = j;
      while (k < len && code[k] === ' ') k++;
      const isCall = k < len && code[k] === '(';

      if (KEYWORDS.has(word)) {
        out += span('keyword', word);
      } else if (LITERALS.has(word)) {
        out += span('literal', word);
      } else if (AUDIO_VARS.has(word)) {
        out += span('audio', word);
      } else if (P5_CONSTANTS.has(word)) {
        out += span('constant', word);
      } else if (word === 'setup' || word === 'draw') {
        out += span('defname', word);
      } else if (isCall) {
        out += span('fn', word);
      } else {
        out += escapeHtml(word);
      }
      i = j;
      continue;
    }

    // ─── Operators / punctuation ────────────────
    if ('+-*/%=<>!&|^~?:'.includes(ch)) {
      out += span('op', ch);
      i++;
      continue;
    }

    if ('{}()[]'.includes(ch)) {
      out += span('bracket', ch);
      i++;
      continue;
    }

    // ─── Everything else (whitespace, commas, dots, semicolons) ──
    out += escapeHtml(ch);
    i++;
  }

  return out;
}
