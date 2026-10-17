import { prepareTexPreview, type TexPreviewSettings } from './texPreview';

export function prepareTikzPreview(source: string, setup: string, settings: TexPreviewSettings) {
  const cropped = String.raw`
\IfFileExists{preview.sty}{\usepackage[active,tightpage]{preview}}{\PackageError{TeacherWorkspace}{preview.sty missing}{Install preview in TeX Live Manager}}
\setlength\PreviewBorder{4pt}
`;
  return prepareTexPreview(
    `\\begin{ex}\n\\begin{preview}\n${source}\n\\end{preview}\n\\end{ex}`,
    setup,
    {
      integrated: settings.mode !== 'project',
      additionalPreamble: settings.additionalPreamble + cropped,
    },
  );
}
