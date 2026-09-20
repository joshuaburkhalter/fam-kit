import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Barcode, Check, AlertCircle, Loader2, Sparkles, RefreshCw } from 'lucide-react';
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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
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
    setIsScanningCamera(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsScanningCamera(true);

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
                // Haptic feedback if supported
                if ('vibrate' in navigator) navigator.vibrate(100);
                stopCamera();
                handleLookup(code);
              }
            }
          } catch {}
        }, 500);
      } else {
        setCameraError('Live barcode camera detection requires Chrome/Edge on mobile. You can enter the barcode numbers below!');
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError('Camera access was not granted or is unavailable. You can enter the barcode number manually.');
      setIsScanningCamera(false);
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
      onClose();
    } catch (e: any) {
      alert(e.message || 'Failed to add item to pantry');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Scan Barcode</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Add packaged foods with auto-calculated shelf life</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Camera Viewfinder */}
          {!lookupResult && (
            <div className="space-y-4">
              {isScanningCamera ? (
                <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-zinc-800">
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                  {/* Targeting Reticle */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-32 border-2 border-dashed border-emerald-400/80 rounded-xl flex items-center justify-center bg-emerald-500/5">
                      <div className="w-full h-0.5 bg-emerald-500/60 animate-pulse" />
                    </div>
                  </div>
                  <button
                    onClick={stopCamera}
                    className="absolute top-2 right-2 px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg text-xs font-medium text-white hover:bg-black/80"
                  >
                    Close Camera
                  </button>
                </div>
              ) : (
                <button
                  onClick={startCamera}
                  className="w-full py-4 px-4 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all flex flex-col items-center justify-center gap-2 group"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Use Camera Scanner</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Aim your camera directly at the barcode</p>
                  </div>
                </button>
              )}

              {cameraError && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* Manual Barcode Entry */}
              <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Or enter UPC / EAN barcode digits
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
                      className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    onClick={() => handleLookup(manualCode)}
                    disabled={!manualCode.trim() || isLookingUp}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    {isLookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lookup'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lookup Result Form */}
          {lookupResult && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-mono">
                    {lookupResult.barcode}
                  </span>
                  {lookupResult.found ? (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Product Found
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      New Item (Enter Name)
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setLookupResult(null);
                    setManualCode('');
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Rescan
                </button>
              </div>

              {/* Item Details */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    value={lookupResult.name}
                    onChange={(e) => setLookupResult({ ...lookupResult, name: e.target.value })}
                    placeholder="e.g. Organic Whole Milk"
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Storage Location
                    </label>
                    <select
                      value={lookupResult.location}
                      onChange={(e) =>
                        setLookupResult({ ...lookupResult, location: e.target.value as PantryLocation })
                      }
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="fridge">🧊 Fridge</option>
                      <option value="freezer">❄️ Freezer</option>
                      <option value="pantry">🥫 Pantry</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Quantity
                    </label>
                    <input
                      type="text"
                      value={lookupResult.quantity}
                      onChange={(e) => setLookupResult({ ...lookupResult, quantity: e.target.value })}
                      placeholder="e.g. 1 carton"
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Expiry Date (Auto-calculated) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Calculated Expiry Date
                    </label>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                      <Sparkles className="w-3 h-3" /> Auto USDA shelf life
                    </span>
                  </div>
                  <input
                    type="date"
                    value={lookupResult.expiresAt}
                    onChange={(e) => setLookupResult({ ...lookupResult, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Keep In Stock Toggle */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        ⭐ Keep in Stock Staple
                      </span>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Get restock reminders or auto-readd to grocery list
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isStock}
                      onChange={(e) => setIsStock(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 dark:border-zinc-700"
                    />
                  </label>

                  {isStock && (
                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between">
                      <span className="text-xs text-zinc-600 dark:text-zinc-300">Check stock every:</span>
                      <select
                        value={restockCadenceDays}
                        onChange={(e) => setRestockCadenceDays(parseInt(e.target.value, 10))}
                        className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-100"
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
                  className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSaveItem}
                  disabled={!lookupResult.name.trim() || isSaving}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add to Pantry'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
