/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { ImageUpload } from './components/ImageUpload';
import { DataPreview } from './components/DataPreview';
import { extractTableData, getLocalApiKey, setLocalApiKey } from './services/geminiService';
import { ExtractedItem } from './services/excelService';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, FileSpreadsheet, Scan, Clock, History, Settings, Key, Check, X } from 'lucide-react';

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(getLocalApiKey());
  const [keyInput, setKeyInput] = useState(getLocalApiKey());
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalApiKey(keyInput);
    setApiKey(keyInput);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setShowSettings(false);
    }, 1200);
  };

  const handleImageSelect = (file: File) => {
    setFileType(file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImage(result);
      processImage(result, file.type);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (base64: string, mimeType: string) => {
    setIsProcessing(true);
    setError(null);
    setExtractedData([]);

    try {
      const data = await extractTableData(base64, mimeType);
      setExtractedData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado al procesar el archivo.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setImage(null);
    setFileType(null);
    setExtractedData([]);
    setError(null);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 font-sans selection:bg-blue-900/50 selection:text-blue-200 italic-serif-headers relative overflow-x-hidden">
      {/* Floating Settings Gear */}
      <div className="absolute top-6 right-6 z-40">
        <button
          onClick={() => {
            setKeyInput(getLocalApiKey());
            setShowSettings(true);
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all text-sm font-medium shadow-lg hover:shadow-xl cursor-pointer"
        >
          <Settings size={16} className={apiKey ? "text-green-400 animate-spin" : "text-slate-400"} style={{ animationDuration: '6s' }} />
          <span>Ajustes de API</span>
          {apiKey && (
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse animate-duration-1000" title="API Key propia activa o configurada" />
          )}
        </button>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 md:p-8 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowSettings(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-950 text-blue-400 flex items-center justify-center">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-100">Ajustes de API Key</h3>
                  <p className="text-xs text-slate-400">Configuración para uso fuera de Google AI Studio</p>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                En el entorno de **Google AI Studio**, las llamadas se conectan automáticamente y el backend las resuelve sin requerir configuración extra. <br /><br />
                Si has descargado esta aplicación, la has subido a tu propio servidor o si estás usándola de forma externa/estática, introduce tu clave personal de <strong>Gemini API</strong> para habilitar las llamadas directas en el navegador. No se enviará a ningún servidor y se almacena únicamente de forma local en tu navegador.
              </p>

              <form onSubmit={handleSaveKey} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Tu Gemini API Key
                  </label>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none transition-colors font-mono"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Puedes obtener una clave gratuita en:{" "}
                    <a
                      href="https://aistudio.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline inline-flex items-center gap-0.5"
                    >
                      Google AI Studio
                    </a>
                  </p>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setKeyInput("");
                      setLocalApiKey("");
                      setApiKey("");
                      setSaveSuccess(true);
                      setTimeout(() => {
                        setSaveSuccess(false);
                        setShowSettings(false);
                      }, 1000);
                    }}
                    className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800/40 rounded-xl transition-colors text-sm font-medium cursor-pointer"
                  >
                    Borrar Clave
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors text-sm font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    {saveSuccess ? (
                      <>
                        <Check size={16} />
                        <span>¡Guardado!</span>
                      </>
                    ) : (
                      <span>Guardar</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.05] overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
      </div>

      <main className="relative z-10 px-4 py-12 md:py-20 max-w-7xl mx-auto">
        {/* Header Section */}
        <header className="mb-16 text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950 text-blue-400 font-mono text-[10px] uppercase tracking-widest font-bold mb-6 border border-blue-800 shadow-sm"
          >
            <Scan size={14} className="animate-pulse" />
            AI Document Scanner v1.1
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-sans font-bold tracking-tighter text-white mb-6"
          >
            Archivo a <span className="text-green-400 italic font-serif">Excel</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto"
          >
            Extrae datos de columnas <span className="font-semibold text-slate-200">Cant.</span> y <span className="font-semibold text-slate-200">Artículo</span> de imágenes o PDFs con precisión de IA.
          </motion.p>
        </header>

        <section className="space-y-8">
          <ImageUpload 
            onImageSelect={handleImageSelect}
            selectedImage={image}
            fileType={fileType}
            onClear={handleClear}
            isProcessing={isProcessing}
          />

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="max-w-2xl mx-auto overflow-hidden"
              >
                <div className="bg-red-950/40 border border-red-800 text-red-300 p-4 rounded-xl flex items-center gap-3">
                  <AlertCircle size={20} className="flex-shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {(extractedData.length > 0 || isProcessing) && (
            <DataPreview 
              data={extractedData} 
              onReset={handleClear}
            />
          )}
        </section>

        {/* Features / Info Section */}
        {!image && !isProcessing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 px-4"
          >
            <div className="p-8 bg-slate-900/50 rounded-2xl border border-slate-800 shadow-sm hover:border-slate-700 hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-blue-950 text-blue-400 flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Scan size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-3">Mapeo Inteligente</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Nuestra IA identifica automáticamente las columnas correspondientes incluso si el diseño de la tabla varía.
              </p>
            </div>
            
            <div className="p-8 bg-slate-900/50 rounded-2xl border border-slate-800 shadow-sm hover:border-slate-700 hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-green-950 text-green-400 flex items-center justify-center mb-6 group-hover:bg-green-600 group-hover:text-white transition-colors">
                <FileSpreadsheet size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-3">Exportación Instantánea</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Genera archivos .xlsx nativos listos para usar en Excel, Numbers o Google Sheets sin configuraciones manuales.
              </p>
            </div>
            
            <div className="p-8 bg-slate-900/50 rounded-2xl border border-slate-800 shadow-sm hover:border-slate-700 hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-purple-950 text-purple-400 flex items-center justify-center mb-6 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Clock size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-3">Ahorro de Tiempo</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Elimina la transcripción manual de largos listados de artículos. Digitaliza facturas en segundos.
              </p>
            </div>
          </motion.div>
        )}
      </main>

      <footer className="py-12 px-4 border-t border-slate-800 text-center">
        <p className="text-slate-500 text-sm font-medium">
          Potenciado por <span className="text-slate-400 font-semibold">Gemini Pro Vision</span> & Google AI Studio
        </p>
      </footer>
    </div>
  );
}
