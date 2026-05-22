import * as XLSX from 'xlsx';

export interface ExtractedItem {
  cantidad: string | number;
  sku: string | number;
  articulo: string;
}

export function downloadExcel(data: ExtractedItem[], fileName: string = 'datos_extraidos.xlsx') {
  const worksheetData = data.map(item => ({
    'SKU / Código': item.sku,
    'Cantidad': item.cantidad,
    'Artículo / Descripción': item.articulo
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultados');

  // Generation and Download
  XLSX.writeFile(workbook, fileName);
}
