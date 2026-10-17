import {
  drawingDeclarations,
  previewStem,
  MATH_PATTERN,
  previewMathEnvironment,
} from '../domain/previewSource';
import { TikzPreview } from './TikzPreview';
import { commandBlock, maskComments, parseChoices, readGroup } from '../domain/latex';
import katex from 'katex';
import type { ReactNode } from 'react';
import 'katex/dist/katex.min.css';

function Math({ value, display }: { value: string; display: boolean }) {
  return (
    <span
      className={display ? 'qb-math display' : 'qb-math'}
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(value, {
          displayMode: display,
          throwOnError: false,
          trust: false,
          strict: 'ignore',
          output: 'htmlAndMathml',
          macros: {
            '\\heva': '\\left\\{\\begin{aligned}#1\\end{aligned}\\right.',
            '\\hoac': '\\left[\\begin{aligned}#1\\end{aligned}\\right.',
          },
        }),
      }}
    />
  );
}

function cleanText(value: string): string {
  return maskComments(value)
    .replace(/^\s*%.*$/gm, '')
    .replace(/\\begin\{ex\}(?:\[[^\]]*\])?/g, '')
    .replace(/\\end\{ex\}/g, '')
    .replace(/\\(?:textbf|textit|emph)\{([^{}]*)\}/g, '$1')
    .replace(/\\par\b/g, '\n')
    .replace(/\\\\(?![a-zA-Z])/g, '\n')
    .trim();
}

const DRAWING_TOKEN = '⟦TW_DRAWING_PREVIEW⟧';
/** Read-only approximation: drawings stay explicit placeholders, never raw TikZ or remote files. */
function quickSource(value: string) {
  const figures: string[] = [];
  const declared = drawingDeclarations(value);
  let text = declared.text.replace(
    /\\begin\s*\{(tikzpicture|axis|picture|pspicture)\}[\s\S]*?\\end\s*\{\1\}/g,
    (full, env: string) => {
      if (env === 'tikzpicture') {
        const index = figures.push(full) - 1;
        return `⟦TW_TIKZ_${index}⟧`;
      }
      return DRAWING_TOKEN;
    },
  );
  for (const command of ['imminiL', 'immini', 'includegraphics', 'input', 'include']) {
    const re = new RegExp(`\\\\${command}\\b(?:\\s*\\[[^\\]]*\\])?\\s*\\{`, 'g');
    let match;
    while ((match = re.exec(text))) {
      const first = readGroup(text, match.index + match[0].length - 1);
      if (!first) continue;
      let end = first.end,
        replacement = DRAWING_TOKEN;
      if (command.startsWith('immini')) {
        let next = first.end;
        while (/\s/.test(text[next] ?? '') && next < text.length) next++;
        const second = readGroup(text, next);
        if (!second) continue;
        replacement = first.value + '\n' + second.value;
        end = second.end;
      }
      text = text.slice(0, match.index) + replacement + text.slice(end);
      re.lastIndex = match.index + replacement.length;
    }
  }
  // Layout wrappers affect the printed page, not the reader's responsive figure size.
  const wrapper = /\\resizebox\*?\s*\{/g;
  let wrapped;
  while ((wrapped = wrapper.exec(text))) {
    let cursor = wrapped.index + wrapped[0].length - 1;
    let last: ReturnType<typeof readGroup> = null;
    for (let i = 0; i < 3; i++) {
      while (/\s/.test(text[cursor] ?? '') && cursor < text.length) cursor++;
      last = readGroup(text, cursor);
      if (!last) break;
      cursor = last.end;
    }
    if (!last) continue;
    text = text.slice(0, wrapped.index) + last.value + text.slice(cursor);
    wrapper.lastIndex = wrapped.index;
  }
  const legacy = /\{\s*\\(bf|it)\b/g;
  let formatted;
  while ((formatted = legacy.exec(text))) {
    const group = readGroup(text, formatted.index);
    if (!group) continue;
    const body = group.value.replace(/^\s*\\(?:bf|it)\b\s*/, '');
    const replacement = `\\${formatted[1] === 'bf' ? 'textbf' : 'textit'}{${body}}`;
    text = text.slice(0, formatted.index) + replacement + text.slice(group.end);
    legacy.lastIndex = formatted.index + replacement.length;
  }
  return { text, figures };
}

function richText(value: string, depth = 0, renderTikz = true, setup = ''): ReactNode[] {
  if (depth > 12) return [value];
  const prepared = quickSource(value);
  const tables: ReactNode[] = [];
  prepared.text = prepared.text.replace(
    /\\begin\{tabular\}(?:\[[^\]]*\])?\s*\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g,
    (_, body: string) => {
      const rows = body
        .replace(/\\hline\b/g, '')
        .trim()
        .split(/\\\\/)
        .filter((r) => r.trim());
      const index = tables.length;
      tables.push(
        <span key={`table-${index}`} className="qb-preview-table-wrap">
          <table className="qb-preview-table">
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.split(/(?<!\\)&/).map((cell, j) => (
                    <td key={j}>{richText(cell.trim(), depth + 1, renderTikz, setup)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </span>,
      );
      return `⟦TW_TABLE_${index}⟧`;
    },
  );
  const styled: ReactNode[] = [];
  const styleRe = /\\(textbf|textit|emph|underline)\s*\{/g;
  let text = prepared.text,
    match;
  while ((match = styleRe.exec(text))) {
    const position = match.index;
    const insideMath = [...text.matchAll(new RegExp(MATH_PATTERN, 'g'))].some(
      (part) => position >= part.index! && position < part.index! + part[0].length,
    );
    if (insideMath) continue;
    const group = readGroup(text, match.index + match[0].length - 1);
    if (!group) continue;
    const restored = group.value.replace(
      /⟦TW_TIKZ_(\d+)⟧/g,
      (_, index: string) => prepared.figures[Number(index)],
    );
    const content = richText(restored, depth + 1, renderTikz, setup);
    const index = styled.length;
    styled.push(
      match[1] === 'textbf' ? (
        <strong key={`style-${index}`}>{content}</strong>
      ) : match[1] === 'underline' ? (
        <u key={`style-${index}`}>{content}</u>
      ) : (
        <em key={`style-${index}`}>{content}</em>
      ),
    );
    const token = `⟦TW_STYLE_${index}⟧`;
    text = text.slice(0, match.index) + token + text.slice(group.end);
    styleRe.lastIndex = match.index + token.length;
  }

  const partsSource = text
    .replace(/\\begin\{ex\}(?:\[[^\]]*\])?/g, '')
    .replace(/\\end\{ex\}/g, '')
    .replace(
      /\\begin\{(?:center|flushleft|flushright|itemize|enumerate|description|itemchoice|listEX)\}(?:\[[^\]]*\])?|\\end\{(?:center|flushleft|flushright|itemize|enumerate|description|itemchoice|listEX)\}|\\centering\b/g,
      '\n',
    )
    .replace(
      /\\(?:itemch|item)(?:\[([^\]]*)\])?/g,
      (_, label: string | undefined) => `\n${label || '•'} `,
    );
  const parts: string[] = [];
  const tokenRe = new RegExp(
    MATH_PATTERN + '|⟦TW_(?:DRAWING_PREVIEW|TIKZ_\\d+|STYLE_\\d+|TABLE_\\d+)⟧',
    'g',
  );
  let cursor = 0;
  for (const token of partsSource.matchAll(tokenRe)) {
    parts.push(partsSource.slice(cursor, token.index), token[0]);
    cursor = token.index! + token[0].length;
  }
  parts.push(partsSource.slice(cursor));
  return parts.map((part, index) => {
    const table = /^⟦TW_TABLE_(\d+)⟧$/.exec(part);
    if (table) return tables[Number(table[1])];
    if (part.startsWith('\\begin{'))
      return <Math key={index} value={previewMathEnvironment(part)} display />;
    const style = /^⟦TW_STYLE_(\d+)⟧$/.exec(part);
    if (style) return styled[Number(style[1])];
    const tikz = /^⟦TW_TIKZ_(\d+)⟧$/.exec(part);
    if (tikz)
      return renderTikz ? (
        <TikzPreview
          key={`${index}:${prepared.figures[Number(tikz[1])]}`}
          source={[setup, prepared.figures[Number(tikz[1])]].filter(Boolean).join('\n')}
        />
      ) : (
        <span key={index} className="qb-preview-drawing">
          Hình TikZ
        </span>
      );
    if (part === DRAWING_TOKEN)
      return (
        <span key={index} className="qb-preview-drawing">
          Hình vẽ / bảng: xem bản PDF để hiển thị đầy đủ.
        </span>
      );
    if (part.startsWith('$$') && part.endsWith('$$'))
      return <Math key={index} value={part.slice(2, -2)} display />;
    if (part.startsWith('\\[') && part.endsWith('\\]'))
      return <Math key={index} value={part.slice(2, -2)} display />;
    if (part.startsWith('$') && part.endsWith('$'))
      return <Math key={index} value={part.slice(1, -1)} display={false} />;
    if (part.startsWith('\\(') && part.endsWith('\\)'))
      return <Math key={index} value={part.slice(2, -2)} display={false} />;
    return (
      <span key={index}>
        {part
          .replace(/\r/g, '')
          .replace(/\n[ \t]*\n/g, '⟦TW_PAR⟧')
          .replace(/[ \t]*\n[ \t]*/g, ' ')
          .replace(/⟦TW_PAR⟧/g, '\n\n')
          .replace(/\\(?:par|newline|break|smallskip|medskip|bigskip)\b/g, '\n')
          .replace(/\\(?:qquad|quad|enspace)\b/g, '\u2003')
          .replace(/\\lq\b/g, '‘')
          .replace(/\\rq\b/g, '’')
          .replace(/\\(?:noindent|footnotesize|normalsize|small|large|Large|hfill)\b/g, '')
          .replace(/\\(?:hspace|vspace)\*?\s*\{[^}]*\}/g, '')
          .replace(/\\\\/g, '\n')
          .replace(/(?<!\\)[{}]/g, '')
          .replace(/\\([%&_#${}])/g, '$1')
          .replace(/\n[ \t]+/g, '\n')
          .replace(/\n{3,}/g, '\n\n')}
      </span>
    );
  });
}

export function QuestionPreview({
  source,
  answer = '',
  solution = '',
  onRequestCompile,
  renderTikz = true,
}: {
  source: string;
  answer?: string;
  solution?: string;
  onRequestCompile?: () => void;
  renderTikz?: boolean;
}) {
  const choices = parseChoices(source);
  const declared = drawingDeclarations(source);
  const questionSource = previewStem(declared.text);
  const detectedAnswer = answer || commandBlock(source, 'shortans');
  const detectedSolution = solution || commandBlock(source, 'loigiai');
  const cleanQuestion = cleanText(questionSource);

  return (
    <div className="qb-preview">
      {/\\(?:includegraphics|input|include)\b/.test(maskComments(source)) && (
        <p className="qb-preview-resource-note">
          Có tài nguyên ngoài.{' '}
          {onRequestCompile && <button onClick={onRequestCompile}>Mở PDF để đối chiếu</button>}
        </p>
      )}
      {cleanQuestion ? (
        <div className="qb-preview-question">
          {richText(questionSource, 0, renderTikz, declared.setup)}
        </div>
      ) : (
        <span className="muted">Chưa có nội dung để xem trước.</span>
      )}
      {choices.length > 0 && (
        <div className="qb-preview-choices">
          {choices.map((choice, index) => (
            <div key={index} className={`qb-preview-choice ${choice.correct ? 'correct' : ''}`}>
              <b>
                {/\\choiceTF\b/.test(maskComments(source))
                  ? `${String.fromCharCode(97 + index)})`
                  : `${String.fromCharCode(65 + index)}.`}
              </b>{' '}
              <span className="qb-choice-content">
                {richText(choice.value, 0, renderTikz, declared.setup)}
              </span>
            </div>
          ))}
        </div>
      )}
      {detectedAnswer && (
        <div className="qb-preview-answer">Đáp án: {richText(detectedAnswer)}</div>
      )}
      {detectedSolution && (
        <details className="qb-preview-solution" open>
          <summary>Lời giải</summary>
          <div className="qb-preview-question">
            {richText(detectedSolution, 0, renderTikz, declared.setup)}
          </div>
        </details>
      )}
    </div>
  );
}
