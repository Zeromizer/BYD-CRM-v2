declare module 'xlsx-populate' {
  interface Cell {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value(): any
    value(value: string | number | boolean | Date | null | undefined): Cell
    address(): string
  }

  interface Row {
    cell(columnNumber: number): Cell
  }

  interface Sheet {
    name(): string
    cell(address: string): Cell
    cell(row: number, column: number): Cell
    row(rowNumber: number): Row
    usedRange(): Range | undefined
  }

  interface Range {
    startCell(): Cell
    endCell(): Cell
  }

  interface Workbook {
    sheet(name: string): Sheet | undefined
    sheet(index: number): Sheet | undefined
    sheets(): Sheet[]
    outputAsync(type?: string): Promise<Blob | ArrayBuffer>
  }

  interface XlsxPopulate {
    fromDataAsync(data: ArrayBuffer | Blob | Uint8Array): Promise<Workbook>
    fromBlankAsync(): Promise<Workbook>
  }

  const xlsxPopulate: XlsxPopulate
  export default xlsxPopulate
}
