import React, { useState, useEffect, useRef } from 'react';
import { Drawer } from '../ui/Drawer';
import { X, Camera, Barcode, Check, AlertCircle, Loader2, Sparkles, RefreshCw, Zap } from 'lucide-react';
import { api } from '../../lib/api';
import type { PantryLocation, InventoryItem } from '../../types';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemAdded: (item: InventoryItem) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onItemAdded,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [isScanningCamera, setIsScanningCamera] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [hasBarcodeDetector, setHasBarcodeDetector] = useState(false);
  const [lookupResult, setLookupResult] = useState<{
    found: boolean;
    barcode: string;
    name: string;
    category: string;
    location: PantryLocation;
    quantity: string;
    imageUrl?: string | null;
    expiresAt: string;
  } | null>(null);
  const [isStock, setIsStock] = useState(false);
  const [restockCadenceDays, setRestockCadenceDays] = useState(14);
  const [isSaving, setIsSaving] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setHasBarcodeDetector('BarcodeDetector' in window);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setLookupResult(null);
      setManualCode('');
      setCameraError(null);
    }
  }, [isOpen]);

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanningCamera(false);
    setCameraLoading(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    setCameraLoading(true);
    setIsScanningCamera(true);

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      // Assign to video element if already mounted
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (e) {
          console.warn('Video play warning:', e);
        }
      }

      setCameraLoading(false);

      // Check BarcodeDetector support
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });

        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const detected = await barcodeDetector.detect(videoRef.current);
            if (detected && detected.length > 0) {
              const code = detected[0].rawValue;
              if (code) {
                if ('vibrate' in navigator) navigator.vibrate(100);
                stopCamera();
                handleLookup(code);
              }
            }
          } catch {}
        }, 400);
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError('Camera access was not granted or is unavailable on this device. You can enter the barcode digits manually below.');
      setIsScanningCamera(false);
      setCameraLoading(false);
    }
  };

  // Capture current video frame & scan (works on all devices, even without BarcodeDetector)
  const captureFrameAndScan = async () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // If BarcodeDetector supported, run on canvas
    if ('BarcodeDetector' in window) {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });
        const results = await detector.detect(canvas);
        if (results && results.length > 0 && results[0].rawValue) {
          stopCamera();
          handleLookup(results[0].rawValue);
          return;
        }
      } catch {}
    }

    // AI vision fallback to recognize item from photo frame
    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    stopCamera();
    setIsLookingUp(true);
    try {
      const res = await api.scanInventoryVision(base64, 'image/jpeg');
      if (res.items && res.items.length > 0) {
        const first = res.items[0];
        setLookupResult({
          found: true,
          barcode: 'CAMERA-SCAN',
          name: first.name,
          category: first.category,
          location: first.location,
          quantity: first.quantity,
          expiresAt: first.expiresAt,
        });
      } else {
        setCameraError('Could not recognize food item in frame. Please enter name or barcode below.');
      }
    } catch (e: any) {
      setCameraError('Scan recognition failed. Please enter the barcode digits below.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleLookup = async (code: string) => {
    const clean = code.trim();
    if (!clean) return;
    setIsLookingUp(true);
    setLookupResult(null);

    try {
      const res = await api.lookupBarcode(clean);
      if (res.found && res.item) {
        setLookupResult({
          found: true,
          barcode: clean,
          name: res.item.name || 'Pantry Item',
          category: res.item.category || 'Pantry',
          location: (res.item.location as PantryLocation) || 'pantry',
          quantity: res.item.quantity || '1',
          imageUrl: res.item.imageUrl || null,
          expiresAt: res.item.expiresAt || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        });
      } else {
        setLookupResult({
          found: false,
          barcode: clean,
          name: '',
          category: 'Pantry',
          location: 'pantry',
          quantity: '1',
          expiresAt: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        });
      }
    } catch (e) {
      setLookupResult({
        found: false,
        barcode: clean,
        name: '',
        category: 'Pantry',
        location: 'pantry',
        quantity: '1',
        expiresAt: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSaveItem = async () => {
    if (!lookupResult || !lookupResult.name.trim()) return;
    setIsSaving(true);
    try {
      const saved = await api.addInventoryItem({
        name: lookupResult.name.trim(),
        barcode: lookupResult.barcode,
        category: lookupResult.category,
        location: lookupResult.location,
        quantity: lookupResult.quantity,
        imageUrl: lookupResult.imageUrl,
        isStock,
        restockCadenceDays: isStock ? restockCadenceDays : null,
        expiresAt: lookupResult.expiresAt,
      });
      onItemAdded(saved);
      stopCamera();
      onClose();
    } catch (e: any) {
      alert(e.message || 'Failed to add item to pantry');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Scan Barcode"
      subtitle="Add packaged foods with auto-calculated shelf life"
      icon={<Barcode className="w-5 h-5 text-slate-950" />}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {/* Camera Viewfinder */}
        {!lookupResult && (
          <div className="space-y-4">
            {isScanningCamera ? (
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-inner">
                {cameraLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
                    <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                  </div>
                )}

                {/* Real-time Video Stream */}
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && streamRef.current && el.srcObject !== streamRef.current) {
                      el.srcObject = streamRef.current;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      videoRef.current.play().catch(() => {});
                    }
                  }}
                  className="w-full h-full object-cover"
                />

                {/* Targeting Reticle */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-64 h-32 border-2 border-dashed border-emerald-400/90 rounded-2xl flex items-center justify-center bg-emerald-500/10 shadow-lg shadow-emerald-500/20">
                    <div className="w-full h-0.5 bg-emerald-400/80 animate-pulse" />
                  </div>
                </div>

                {/* Close camera button */}
                <button
                  type="button"
                  onClick={stopCamera}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-slate-950/80 hover:bg-slate-900 backdrop-blur-md rounded-xl text-xs font-semibold text-white border border-white/10 shadow-md cursor-pointer transition-colors z-10"
                >
                  Close Camera
                </button>

                {/* Manual Scan Snapshot Trigger */}
                <div className="absolute bottom-3 left-0 right-0 px-4 flex justify-center z-10">
                  <button
                    type="button"
                    onClick={captureFrameAndScan}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/30 flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Zap className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{hasBarcodeDetector ? 'Instant Scan' : 'Scan Centered Barcode'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={startCamera}
                className="w-full py-6 px-4 rounded-2xl border-2 border-dashed border-white/10 hover:border-emerald-500/40 bg-slate-900/60 hover:bg-emerald-500/5 transition-all flex flex-col items-center justify-center gap-2.5 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shadow-emerald-500/20">
                  <Camera className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-white">Open Live Camera</p>
                  <p className="text-xs text-slate-400 mt-0.5">Point camera at the barcode on any packaging</p>
                </div>
              </button>
            )}

            {cameraError && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Manual Barcode Digits Input */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="text-xs font-semibold text-slate-300 block">
                Or enter UPC / EAN barcode digits manually
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="e.g. 041303001407"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLookup(manualCode);
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleLookup(manualCode)}
                  disabled={!manualCode.trim() || isLookingUp}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {isLookingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Lookup'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lookup Result Form */}
        {lookupResult && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                  {lookupResult.barcode}
                </span>
                {lookupResult.found ? (
                  <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Product Identified
                  </span>
                ) : (
                  <span className="text-xs text-amber-400 font-semibold">
                    New Item (Enter Name)
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setLookupResult(null);
                  setManualCode('');
                }}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Rescan
              </button>
            </div>

            {/* Item Details */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={lookupResult.name}
                  onChange={(e) => setLookupResult({ ...lookupResult, name: e.target.value })}
                  placeholder="e.g. Organic Whole Milk"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Storage Location
                  </label>
                  <select
                    value={lookupResult.location}
                    onChange={(e) =>
                      setLookupResult({ ...lookupResult, location: e.target.value as PantryLocation })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="fridge">🧊 Fridge</option>
                    <option value="freezer">❄️ Freezer</option>
                    <option value="pantry">🥫 Pantry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Quantity
                  </label>
                  <input
                    type="text"
                    value={lookupResult.quantity}
                    onChange={(e) => setLookupResult({ ...lookupResult, quantity: e.target.value })}
                    placeholder="e.g. 1 carton"
                    className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Expiry Date (Auto-calculated) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Calculated Expiry Date
                  </label>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                    <Sparkles className="w-3 h-3" /> Auto USDA category rule
                  </span>
                </div>
                <input
                  type="date"
                  value={lookupResult.expiresAt}
                  onChange={(e) => setLookupResult({ ...lookupResult, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Keep In Stock Toggle */}
              <div className="p-3 bg-slate-900/60 rounded-xl border border-white/10 space-y-2.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      ⭐ Keep in Stock Staple
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Get restock reminders or auto-readd to grocery list
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isStock}
                    onChange={(e) => setIsStock(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 border-white/10 bg-slate-900 cursor-pointer"
                  />
                </label>

                {isStock && (
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-slate-300">Check stock every:</span>
                    <select
                      value={restockCadenceDays}
                      onChange={(e) => setRestockCadenceDays(parseInt(e.target.value, 10))}
                      className="px-2.5 py-1 bg-slate-900 border border-white/10 rounded-lg text-xs font-semibold text-white cursor-pointer"
                    >
                      <option value={7}>7 Days (Weekly)</option>
                      <option value={14}>14 Days (Bi-weekly)</option>
                      <option value={30}>30 Days (Monthly)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLookupResult(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSaveItem}
                disabled={!lookupResult.name.trim() || isSaving}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-50 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add to Pantry'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};
