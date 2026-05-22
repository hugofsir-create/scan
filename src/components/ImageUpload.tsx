import React, { useCallback, useState } from 'react';
import { Upload, X, FileImage, ClipboardCheck, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  selectedImage: string | null;
  fileType: string | null;
  onClear: () => void;
  isProcessing: boolean;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ 
  onImageSelect, 
  selectedImage,
  fileType,
  onClear, 
  isProcessing 
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!isProcessing) setIsDragging(true);
  }, [isProcessing]);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isProcessing) return;

    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      onImageSelect(file);
    }
  }, [onImageSelect, isProcessing]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageSelect(file);
    }
  };

  const isPdf = fileType === 'application/pdf';

  return (
    <div className="w-full max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {!selectedImage ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer group",
              isDragging 
                ? "border-blue-500 bg-blue-950/40" 
                : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60"
            )}
            onClick={() => document.getElementById('image-input')?.click()}
          >
            <input
              id="image-input"
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              onChange={handleInputChange}
            />
            
            <div className="w-16 h-16 rounded-full bg-blue-950/80 border border-blue-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-blue-400" />
            </div>
            
            <h3 className="text-xl font-semibold text-slate-100 mb-2">
              Sube tu imagen o PDF
            </h3>
            <p className="text-slate-400 text-center max-w-sm mb-6 text-sm">
              Arrastra y suelta o haz clic para buscar facturas o remitos en imagen o PDF.
            </p>
            
            <div className="flex gap-4 text-xs font-medium text-slate-500 uppercase tracking-widest">
              <span className="flex items-center gap-1"><FileImage size={14} /> JPG / PNG</span>
              <span className="flex items-center gap-1"><FileText size={14} /> PDF</span>
              <span className="flex items-center gap-1"><ClipboardCheck size={14} /> OCR IA</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-xl"
          >
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                disabled={isProcessing}
                className="p-2 bg-slate-950/80 backdrop-blur hover:bg-slate-900 text-slate-200 rounded-full shadow-md transition-colors disabled:opacity-50 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="min-h-[300px] flex items-center justify-center bg-slate-950">
              {isPdf ? (
                <div className="flex flex-col items-center gap-4 py-20 pb-24">
                  <div className="p-6 bg-red-950/50 border border-red-800 text-red-400 rounded-2xl">
                    <FileText size={64} />
                  </div>
                  <span className="font-medium text-slate-300">Documento PDF Cargado</span>
                </div>
              ) : (
                <img 
                  src={selectedImage} 
                  alt="Preview" 
                  className={cn(
                    "w-full max-h-[500px] object-contain transition-opacity pb-4",
                    isProcessing && "opacity-50"
                  )}
                />
              )}
            </div>
            
            {isProcessing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/20 backdrop-blur-[2px]">
                <div className="relative w-full h-1 overflow-hidden bg-white/30">
                  <motion.div 
                    className="absolute inset-0 bg-blue-500"
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 1.5, 
                      ease: "linear" 
                    }}
                  />
                </div>
                <div className="mt-4 px-6 py-2 bg-slate-900/90 text-white text-sm font-medium rounded-full flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                  />
                  Analizando documento...
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
