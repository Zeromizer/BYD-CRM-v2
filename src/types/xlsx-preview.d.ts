declare module 'xlsx-preview' {
  interface XlsxPreviewOptions {
    output?: 'string' | 'arrayBuffer';
    separateSheets?: boolean;
    minimumRows?: number;
    minimumCols?: number;
  }

  export function xlsx2Html(
    data: ArrayBuffer | Blob | File,
    options?: XlsxPreviewOptions
  ): Promise<string | string[] | ArrayBuffer | ArrayBuffer[]>;
}
