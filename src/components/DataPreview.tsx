import React from 'react';
import { Download, Table as TableIcon, FileSpreadsheet } from 'lucide-react';
import { motion } from 'motion/react';
import { ExtractedItem, downloadExcel } from '../services/excelService';

interface DataPreviewProps {
  data: ExtractedItem[];
  onReset: () => void;
}

export const DataPreview: React.FC<DataPreviewProps> = ({ data, onReset }) => {
  if (data.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto mt-12 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xl"
    >
      <div className="px-6 py-4 bg-slate-50 border-bottom border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 text-green-700 rounded-lg">
            <TableIcon size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Resultados Escaneados</h3>
            <p className="text-xs text-slate-500">{data.length} artículos encontrados</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={onReset}
            className="flex-1 sm:flex-none px-4 py-2 border border-slate-300 text-slate-600 font-medium rounded-lg hover:bg-slate-100 transition-colors"
          >
            Nuevo Escaneo
          </button>
          <button
            onClick={() => downloadExcel(data)}
            className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-shadow hover:shadow-lg flex items-center justify-center gap-2"
          >
            <FileSpreadsheet size={18} />
            Descargar Excel
          </button>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-50 shadow-sm">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Cant.</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">SKU / ID</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Artículo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((item, idx) => (
              <motion.tr 
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="hover:bg-slate-50/80 transition-colors"
              >
                <td className="px-6 py-4 font-mono text-sm text-slate-600 bg-slate-50/30 w-24">
                  {item.cantidad}
                </td>
                <td className="px-6 py-4 font-mono text-sm text-blue-600 font-bold bg-blue-50/10 w-32">
                  {item.sku}
                </td>
                <td className="px-6 py-4 text-sm text-slate-800 font-medium">
                  {item.articulo}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {data.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-slate-400 italic">No se identificaron datos relevantes.</p>
        </div>
      )}
    </motion.div>
  );
};
