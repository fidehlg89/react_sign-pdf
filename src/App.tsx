/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { PDFDocument, rgb } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import SignatureCanvas from 'react-signature-canvas';
import { 
  FileUp, 
  Download, 
  PenTool, 
  Trash2, 
  RotateCcw, 
  Check, 
  X,
  FileText,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface SignaturePlacement {
  page: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  image: string; // base64
  aspectRatio: number;
}

export default function App() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSigning, setIsSigning] = useState(false);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'upload'>('draw');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureAspectRatio, setSignatureAspectRatio] = useState(2); // Default 2:1
  const [signatureScale, setSignatureScale] = useState(150); // Base width in px
  const [placements, setPlacements] = useState<SignaturePlacement[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  
  const sigCanvas = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle signature image upload
  const handleSignatureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        
        // Calculate aspect ratio
        const img = new Image();
        img.onload = () => {
          setSignatureAspectRatio(img.width / img.height);
          setSignatureImage(result);
          setIsSigning(false);
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setIsLoadingPdf(true);
      setPdfPages([]);
      setPdfFile(file);
      setPlacements([]);
      setCurrentPage(1);
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        
        // Import worker correctly for Vite
        const workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

        const loadingTask = pdfjs.getDocument({
          data: arrayBuffer,
          useSystemFonts: true,
          disableFontFace: false,
        });
        
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;
        const renderedPages: string[] = [];

        for (let i = 1; i <= totalPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 }); // Increased scale for better quality
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d", { alpha: false }); // Disable alpha for better performance
          
          if (!context) continue;
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          // Use a white background for the canvas
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          
          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };
          
          // @ts-ignore
          await page.render(renderContext).promise;
          renderedPages.push(canvas.toDataURL("image/png", 0.8));
        }

        if (renderedPages.length > 0) {
          setPdfPages(renderedPages);
        } else {
          throw new Error("No se pudieron renderizar las páginas");
        }
      } catch (error) {
        console.error("Error loading PDF:", error);
        alert("Lo sentimos, hubo un problema al procesar este PDF. Asegúrate de que no esté protegido con contraseña o dañado.");
        setPdfFile(null);
      } finally {
        setIsLoadingPdf(false);
      }
    }
  };

  // Save drawing as signature
  const saveSignature = () => {
    if (sigCanvas.current) {
      if (sigCanvas.current.isEmpty()) return;
      const canvas = sigCanvas.current.getTrimmedCanvas();
      const dataUrl = canvas.toDataURL("image/png");
      
      setSignatureAspectRatio(canvas.width / canvas.height);
      setSignatureImage(dataUrl);
      setIsSigning(false);
    }
  };

  const clearSignature = () => {
    sigCanvas.current?.clear();
  };

  // Add placement when clicking on PDF
  const handlePdfClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!signatureImage || !containerRef.current || isLoadingPdf || isDragging) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const width = signatureScale;
    const height = width / signatureAspectRatio;

    const newPlacement: SignaturePlacement = {
      page: currentPage,
      xPercent: ((x - (width / 2)) / rect.width) * 100,
      yPercent: ((y - (height / 2)) / rect.height) * 100,
      widthPercent: (width / rect.width) * 100,
      heightPercent: (height / rect.height) * 100,
      image: signatureImage,
      aspectRatio: signatureAspectRatio
    };

    setPlacements([...placements, newPlacement]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !signatureImage || isLoadingPdf || isDragging) {
      setMousePos(null);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleDragEnd = (index: number, info: any) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const placement = placements[index];
    
    // Calculate final position in percentages
    // The info.point is absolute, we need relative to container
    // However, it's easier to use info.offset or calculate from current position
    // Since we're using frame motion drag, we'll update the state
    
    const newXPercent = Math.max(0, Math.min(100 - placement.widthPercent, placement.xPercent + (info.offset.x / rect.width * 100)));
    const newYPercent = Math.max(0, Math.min(100 - placement.heightPercent, placement.yPercent + (info.offset.y / rect.height * 100)));

    const newPlacements = [...placements];
    newPlacements[index] = {
      ...placement,
      xPercent: newXPercent,
      yPercent: newYPercent
    };
    
    setPlacements(newPlacements);
    setTimeout(() => setIsDragging(false), 100);
  };

  const removePlacement = (index: number) => {
    setPlacements(placements.filter((_, i) => i !== index));
  };

  // Export signed PDF
  const downloadSignedPdf = async () => {
    if (!pdfFile || placements.length === 0) return;
    setIsProcessing(true);

    try {
      const existingPdfBytes = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();

      // Embed each unique signature image once to save space
      const signatureCache = new Map<string, any>();

      for (const placement of placements) {
        if (placement.page > pages.length) continue;
        
        const page = pages[placement.page - 1];
        const { width: pageWidth, height: pageHeight } = page.getSize();
        
        // Calculate PDF coordinates (origin is bottom-left)
        const xPos = (placement.xPercent / 100) * pageWidth;
        const yPos = pageHeight - ((placement.yPercent / 100) * pageHeight) - ((placement.heightPercent / 100) * pageHeight);
        const pWidth = (placement.widthPercent / 100) * pageWidth;
        const pHeight = (placement.heightPercent / 100) * pageHeight;

        let signatureImageEmbed;
        if (signatureCache.has(placement.image)) {
          signatureImageEmbed = signatureCache.get(placement.image);
        } else {
          const signatureImageBytes = await fetch(placement.image).then(res => res.arrayBuffer());
          signatureImageEmbed = await pdfDoc.embedPng(signatureImageBytes);
          signatureCache.set(placement.image, signatureImageEmbed);
        }

        page.drawImage(signatureImageEmbed, {
          x: xPos,
          y: yPos,
          width: pWidth,
          height: pHeight,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `firmado_${pdfFile.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error signing PDF:', error);
      alert('Error crítico al firmar el PDF. Por favor, asegúrate de que el PDF original no sea demasiado pesado o complejo.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 italic-none">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">FirmaPDF</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100">
            <ShieldCheck className="w-3.5 h-3.5" />
            100% Seguro - Procesamiento Local
          </div>
          
          {pdfFile && (
            <button
              onClick={() => {
                setPdfFile(null);
                setPdfPages([]);
                setPlacements([]);
              }}
              className="text-slate-500 hover:text-slate-700 text-sm font-medium flex items-center gap-1"
            >
              <RotateCcw className="w-4 h-4" />
              Resetear
            </button>
          )}
        </div>
      </header>

      <main className="pt-24 pb-12 px-4 max-w-7xl mx-auto">
        {!pdfFile ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-xl"
            >
              <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
                Firma tus documentos <span className="text-indigo-600">fácilmente</span>
              </h2>
              <p className="text-lg text-slate-600 mb-10 leading-relaxed">
                Sube tu PDF, dibuja tu firma y colócala donde la necesites. 
                Tus archivos nunca salen de tu navegador, garantizando máxima seguridad.
              </p>

              <label className="group relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-300 rounded-2xl bg-white hover:bg-indigo-50 hover:border-indigo-300 transition-all cursor-pointer">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <div className="p-4 bg-indigo-50 rounded-full mb-4 group-hover:bg-white transition-colors">
                    <FileUp className="w-8 h-8 text-indigo-600" />
                  </div>
                  <p className="mb-2 text-sm text-slate-700">
                    <span className="font-semibold">Haz clic para subir un PDF</span> o arrastra y suelta
                  </p>
                  <p className="text-xs text-slate-500">Documentos PDF (Max. 50MB)</p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".pdf" 
                  onChange={handleFileUpload} 
                />
              </label>
            </motion.div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar / Tools */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-24">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                  Herramientas
                </h3>
                
                <div className="space-y-4">
                  {!signatureImage ? (
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => {
                          setSignatureMode('draw');
                          setIsSigning(true);
                        }}
                        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-95"
                      >
                        <PenTool className="w-5 h-5" />
                        Dibujar Firma
                      </button>
                      
                      <button
                        onClick={() => {
                          setSignatureMode('upload');
                          setIsSigning(true);
                        }}
                        className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-indigo-600 border-2 border-indigo-100 rounded-xl font-medium flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95"
                      >
                        <Upload className="w-5 h-5" />
                        Subir Imagen
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center">
                        <img 
                          src={signatureImage} 
                          alt="Tu firma" 
                          className="max-h-20 object-contain" 
                        />
                        <button
                          onClick={() => {
                            setSignatureImage(null);
                            setIsSigning(true);
                          }}
                          className="mt-3 text-xs text-indigo-600 font-semibold hover:underline"
                        >
                          Cambiar firma
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-500 uppercase">Tamaño de firma</label>
                          <span className="text-xs font-mono text-indigo-600 font-bold">{signatureScale}px</span>
                        </div>
                        <input 
                          type="range" 
                          min="50" 
                          max="400" 
                          value={signatureScale} 
                          onChange={(e) => setSignatureScale(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                      
                      <p className="text-sm text-slate-500 text-center">
                        Haz clic en el PDF para colocar tu firma.
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 italic-none">
                    <h4 className="text-xs font-semibold text-slate-400 mb-3">ACCIONES</h4>
                    <button
                      onClick={downloadSignedPdf}
                      disabled={placements.length === 0 || isProcessing}
                      className={cn(
                        "w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all",
                        placements.length === 0 || isProcessing
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-100"
                      )}
                    >
                      {isProcessing ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                      ) : (
                        <Download className="w-5 h-5" />
                      )}
                      Finalizar y Descargar
                    </button>
                  </div>
                </div>

                {placements.length > 0 && (
                  <div className="mt-8 italic-none">
                    <h4 className="text-xs font-semibold text-slate-400 mb-3 uppercase">Firmas colocadas ({placements.length})</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {placements.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-xs font-medium text-slate-600">Pág. {p.page}</span>
                          <button 
                            onClick={() => removePlacement(idx)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Viewport */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-slate-200/50 p-4 rounded-2xl flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || isLoadingPdf}
                    className="p-2 bg-white rounded-lg border border-slate-300 disabled:opacity-50 hover:bg-slate-50 shadow-sm"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-bold bg-white px-4 py-2 rounded-lg border border-slate-300 shadow-sm min-w-[100px] text-center">
                    {isLoadingPdf ? 'Cargando...' : `Página ${currentPage} / ${pdfPages.length}`}
                  </span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(pdfPages.length, p + 1))}
                    disabled={currentPage === pdfPages.length || isLoadingPdf}
                    className="p-2 bg-white rounded-lg border border-slate-300 disabled:opacity-50 hover:bg-slate-50 shadow-sm"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="text-xs text-slate-500 italic">
                  {isLoadingPdf ? 'Procesando páginas...' : (signatureImage ? 'Haz clic en el documento para firmar' : 'Crea una firma primero')}
                </div>
              </div>

              <div 
                ref={containerRef}
                className={cn(
                  "relative bg-white shadow-2xl rounded-sm mx-auto overflow-hidden group",
                  signatureImage && !isLoadingPdf ? "cursor-crosshair" : "cursor-default"
                )}
                onClick={!isLoadingPdf ? handlePdfClick : undefined}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setMousePos(null)}
                style={{ width: 'fit-content', minWidth: '300px', minHeight: '400px' }}
              >
                {isLoadingPdf ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-[2px] z-10">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                      <FileText className="absolute inset-0 m-auto w-6 h-6 text-indigo-600" />
                    </div>
                    <p className="mt-4 text-sm font-bold text-slate-600 animate-pulse">
                      Preparando documento...
                    </p>
                  </div>
                ) : null}

                {/* Grid Overlay for alignment */}
                {isDragging && (
                  <div className="absolute inset-0 pointer-events-none z-10 grid grid-cols-12 grid-rows-12">
                    {Array.from({ length: 144 }).map((_, i) => (
                      <div key={i} className="border-[0.5px] border-indigo-500/10" />
                    ))}
                  </div>
                )}

                {pdfPages.length > 0 && (
                  <img 
                    id={`pdf-page-${currentPage}`}
                    src={pdfPages[currentPage - 1]} 
                    alt={`Hoja ${currentPage}`}
                    className={cn(
                      "max-w-full h-auto pointer-events-none select-none transition-opacity duration-300",
                      isLoadingPdf ? "opacity-0" : "opacity-100"
                    )}
                  />
                )}

                {/* Ghost Signature */}
                {signatureImage && mousePos && !isLoadingPdf && !isDragging && (
                  <div 
                    className="absolute pointer-events-none border border-indigo-400 border-dashed bg-indigo-400/5 z-20"
                    style={{
                      left: mousePos.x - (signatureScale / 2),
                      top: mousePos.y - (signatureScale / signatureAspectRatio / 2),
                      width: signatureScale,
                      height: signatureScale / signatureAspectRatio,
                    }}
                  >
                    <img src={signatureImage} className="w-full h-full object-contain opacity-50" />
                  </div>
                )}

                {/* Render placements on current page */}
                {placements.filter(p => p.page === currentPage).map((p, idx) => {
                  const globalIdx = placements.indexOf(p);
                  return (
                    <motion.div
                      key={globalIdx}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      drag
                      dragMomentum={false}
                      dragConstraints={containerRef}
                      onDragStart={() => setIsDragging(true)}
                      onDragEnd={(_, info) => handleDragEnd(globalIdx, info)}
                      className="absolute border border-indigo-400 group/sig cursor-move z-30 touch-none active:bg-indigo-50/20"
                      style={{
                        left: `${p.xPercent}%`,
                        top: `${p.yPercent}%`,
                        width: `${p.widthPercent}%`,
                        height: `${p.heightPercent}%`,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <img src={p.image} className="w-full h-full object-contain pointer-events-none" />
                      <button 
                        onClick={() => removePlacement(globalIdx)}
                        className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/sig:opacity-100 transition-opacity shadow-lg z-40"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  );
                })}
                
                {/* Visual indicator for where user clicks if signature exists */}
                {signatureImage && (
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-20 pointer-events-none">
                    <div className="w-full h-full bg-indigo-400/10" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Signature Modal */}
      <AnimatePresence>
        {isSigning && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSigning(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl p-8 rounded-3xl shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">Crea tu firma</h3>
                  <p className="text-sm text-slate-500">Elige cómo quieres firmar el documento</p>
                </div>
                <button 
                  onClick={() => setIsSigning(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-100 mb-6">
                <button
                  onClick={() => setSignatureMode('draw')}
                  className={cn(
                    "flex-1 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 border-b-2",
                    signatureMode === 'draw' 
                      ? "border-indigo-600 text-indigo-600" 
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  <PenTool className="w-4 h-4" />
                  Dibujar
                </button>
                <button
                  onClick={() => setSignatureMode('upload')}
                  className={cn(
                    "flex-1 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 border-b-2",
                    signatureMode === 'upload' 
                      ? "border-indigo-600 text-indigo-600" 
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  <Upload className="w-4 h-4" />
                  Subir Imagen
                </button>
              </div>

              {signatureMode === 'draw' ? (
                <>
                  <div className="border-2 border-slate-200 rounded-2xl bg-slate-50 overflow-hidden mb-6">
                    <SignatureCanvas 
                      ref={sigCanvas}
                      penColor="#1e293b"
                      canvasProps={{
                        className: "w-full h-64 cursor-crosshair"
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <button
                      onClick={clearSignature}
                      className="px-6 py-3 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-5 h-5" />
                      Limpiar
                    </button>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setIsSigning(false)}
                        className="px-6 py-3 text-slate-400 font-semibold hover:text-slate-600 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={saveSignature}
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-100"
                      >
                        <Check className="w-5 h-5" />
                        Guardar
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="italic-none">
                  <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 transition-all cursor-pointer group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <div className="p-4 bg-white rounded-full mb-4 shadow-sm group-hover:scale-110 transition-transform">
                        <ImageIcon className="w-8 h-8 text-indigo-600" />
                      </div>
                      <p className="mb-2 text-sm text-slate-700">
                        <span className="font-semibold">Haz clic para subir imagen</span>
                      </p>
                      <p className="text-xs text-slate-500">PNG, JPG, WebP con fondo transparente recomendado</p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleSignatureUpload} 
                    />
                  </label>
                  
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setIsSigning(false)}
                      className="px-6 py-3 text-slate-400 font-semibold hover:text-slate-600 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Security Indicator */}
      <footer className="py-8 border-t border-slate-100 text-center">
        <p className="text-sm text-slate-400 font-medium flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-green-500" />
          Tus datos se procesan localmente. Privacidad garantizada.
        </p>
      </footer>
    </div>
  );
}
