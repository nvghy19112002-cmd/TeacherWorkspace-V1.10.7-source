import { maskComments, readGroup } from './latex';

/** Balanced removal preserves an enclosing immini and its figure. */
export function previewStem(source: string): string {
  let text = maskComments(source);
  const re = /\\(choiceTF|choice|shortans|loigiai)\b(?:\s*\[[^\]]*\])?\s*/g;
  let match;
  while ((match = re.exec(text))) {
    let end = re.lastIndex;
    const count = match[1].startsWith('choice') ? 4 : 1;
    for (let i = 0; i < count; i++) {
      while (/\s/.test(text[end] ?? '') && end < text.length) end++;
      const group = readGroup(text, end);
      if (!group) break;
      end = group.end;
    }
    text = text.slice(0, match.index) + text.slice(end);
    re.lastIndex = match.index;
  }
  return text;
}

/** Keep local drawing declarations out of prose without evaluating them. */
export function drawingDeclarations(source: string): { text: string; setup: string } {
  let text = maskComments(source);
  const setups: string[] = [];
  const hidden = text.replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, (s) =>
    ' '.repeat(s.length),
  );
  const re =
    /\\(?:def\s*\\[A-Za-z@]+[^{]*|(?:newcommand|renewcommand|providecommand)\*?\s*(?:\{\\[A-Za-z@]+\}|\\[A-Za-z@]+)(?:\s*\[[^\]]*\])*|tikzset|tdplotsetmaincoords)\s*\{/g;
  const ranges: Array<{ start: number; end: number }> = [];
  let match;
  while ((match = re.exec(hidden))) {
    let group = readGroup(text, match.index + match[0].length - 1);
    if (!group) continue;
    if (match[0].startsWith('\\tdplotsetmaincoords')) {
      let next = group.end;
      while (/\s/.test(text[next] ?? '') && next < text.length) next++;
      group = readGroup(text, next);
      if (!group) continue;
    }
    setups.push(text.slice(match.index, group.end));
    ranges.push({ start: match.index, end: group.end });
    re.lastIndex = group.end;
  }
  for (const range of ranges.reverse()) text = text.slice(0, range.start) + text.slice(range.end);
  return { text, setup: setups.join('\n') };
}

export const MATH_PATTERN = String.raw`\$\$[\s\S]*?\$\$|(?<!\\)\$(?!\$)[\s\S]*?(?<!\\)\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\\begin\{(eqnarray\*?|align\*?|aligned|gather\*?|gathered|multline\*?|equation\*?)\}[\s\S]*?\\end\{\1\}`;

export function previewMathEnvironment(source: string): string {
  return source.replace(
    /^\\begin\{([^}]+)\}([\s\S]*)\\end\{\1\}$/,
    (_, env: string, body: string) => {
      if (env.startsWith('equation')) return body;
      if (env.startsWith('eqnarray')) return `\\begin{array}{rcl}${body}\\end{array}`;
      const layout = env.startsWith('align') ? 'aligned' : 'gathered';
      return `\\begin{${layout}}${body}\\end{${layout}}`;
    },
  );
}
