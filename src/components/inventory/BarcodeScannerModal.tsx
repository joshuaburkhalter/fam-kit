import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Drawer } from '../ui/Drawer';
import { Camera, Barcode, Check, AlertCircle, Loader2, Sparkles, RefreshCw, Zap, Layers, ChevronDown } from 'lucide-react';
import { api } from '../../lib/api';
import { inferStorageLocation } from '../../lib/shelfLife';
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
  const [isBatchMode, setIsBatchMode] = useState(true);
  const [batchItems, setBatchItems] = useState<InventoryItem[]>([]);
  const [lastScannedToast, setLastScannedToast] = useState<{
    name: string;
    location: PantryLocation;
    isDuplicate?: boolean;
    quantity?: string | null;
  } | null>(null);

  // Single-item mode state
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
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScanTimeRef = useRef<{ code: string; timestamp: number }>({ code: '', timestamp: 0 });

  useEffect(() => {
    setHasBarcodeDetector('BarcodeDetector' in window);
  }, []);

  const playScanBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(920, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.11);
    } catch {
      // AudioContext unavailable or blocked by browser policy
    }
  }, []);

  const stopCamera = useCallback(() => {
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
  }, []);

  const startCamera = useCallback(async () => {
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
                handleDetectedBarcode(code);
              }
            }
          } catch {}
        }, 350);
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError('Camera access was not granted or is unavailable on this device. You can enter the barcode digits manually below.');
      setIsScanningCamera(false);
      setCameraLoading(false);
    }
  }, []);

  // Directly open camera whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setBatchItems([]);
      setLookupResult(null);
      setManualCode('');
      setCameraError(null);
      startCamera();
    } else {
      stopCamera();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    }
  }, [isOpen, startCamera, stopCamera]);

  const triggerToast = (
    name: string,
    location: PantryLocation,
    isDuplicate?: boolean,
    quantity?: string | null
  ) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setLastScannedToast({ name, location, isDuplicate, quantity });
    toastTimeoutRef.current = setTimeout(() => {
      setLastScannedToast(null);
    }, 2600);
  };

  const handleDetectedBarcode = async (rawCode: string) => {
    const clean = rawCode.trim();
    if (!clean) return;

    // Debounce / Cooldown duplicate detections of same barcode within 2.5 seconds
    const now = Date.now();
    if (lastScanTimeRef.current.code === clean && now - lastScanTimeRef.current.timestamp < 2500) {
      return;
    }
    lastScanTimeRef.current = { code: clean, timestamp: now };

    // Tactile & audio feedback
    if ('vibrate' in navigator) navigator.vibrate(100);
    playScanBeep();

    if (isBatchMode) {
      // BATCH MODE: Look up and auto-save directly without closing camera
      try {
        setIsLookingUp(true);
        const res = await api.lookupBarcode(clean);

        let itemName = 'Grocery Item';
        let itemCat = 'Pantry';
        let itemLoc: PantryLocation = 'pantry';
        let itemQty = '1';
        let itemExpiresAt = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
        let itemImg: string | null = null;

        if (res.found && res.item) {
          itemName = res.item.name || itemName;
          itemCat = res.item.category || itemCat;
          itemLoc = (res.item.location as PantryLocation) || itemLoc;
          itemQty = res.item.quantity || itemQty;
          itemExpiresAt = res.item.expiresAt || itemExpiresAt;
          itemImg = res.item.imageUrl || null;
        } else {
          itemName = `Item (${clean.slice(-4)})`;
        }

        // Auto-categorize location based on food type
        const inferred = inferStorageLocation(itemName, itemCat);
        itemLoc = inferred.location;
        itemCat = inferred.category;

        const saved = await api.addInventoryItem({
          name: itemName,
          barcode: clean,
          category: itemCat,
          location: itemLoc,
          quantity: itemQty,
          imageUrl: itemImg,
          isStock: false,
          restockCadenceDays: null,
          expiresAt: itemExpiresAt,
        });

        onItemAdded(saved);
        setBatchItems((prev) => {
          const idx = prev.findIndex((i) => i.id === saved.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = saved;
            return updated;
          }
          return [saved, ...prev];
        });
        triggerToast(saved.name, itemLoc, Boolean(saved.isDuplicate), saved.quantity);
      } catch (err: any) {
        console.error('Batch barcode scan error:', err);
      } finally {
        setIsLookingUp(false);
      }
    } else {
      // SINGLE ITEM MODE: Stop camera and review
      stopCamera();
      handleLookup(clean);
    }
  };

  // Capture current video frame & scan (fallback for browsers without BarcodeDetector)
  const captureFrameAndScan = async () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if ('BarcodeDetector' in window) {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });
        const results = await detector.detect(canvas);
        if (results && results.length > 0 && results[0].rawValue) {
          handleDetectedBarcode(results[0].rawValue);
          return;
        }
      } catch {}
    }

    // AI vision fallback to recognize item from photo frame
    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    setIsLookingUp(true);
    try {
      const res = await api.scanInventoryVision(base64, 'image/jpeg');
      if (res.items && res.items.length > 0) {
        const first = res.items[0];
        const inferred = inferStorageLocation(first.name, first.category);
        const loc = inferred.location;
        const cat = inferred.category;

        if (isBatchMode) {
          playScanBeep();
          const saved = await api.addInventoryItem({
            name: first.name,
            barcode: null,
            category: cat,
            location: loc,
            quantity: first.quantity || '1',
            imageUrl: null,
            isStock: false,
            restockCadenceDays: null,
            expiresAt: first.expiresAt,
          });
          onItemAdded(saved);
          setBatchItems((prev) => {
            const idx = prev.findIndex((i) => i.id === saved.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = saved;
              return updated;
            }
            return [saved, ...prev];
          });
          triggerToast(saved.name, loc, Boolean(saved.isDuplicate), saved.quantity);
        } else {
          stopCamera();
          setLookupResult({
            found: true,
            barcode: 'CAMERA-SCAN',
            name: first.name,
            category: cat,
            location: loc,
            quantity: first.quantity,
            expiresAt: first.expiresAt,
          });
        }
      } else {
        setCameraError('Could not recognize item in frame. Please try again or enter digits manually.');
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
        const inferred = inferStorageLocation(res.item.name || '', res.item.category || '');
        setLookupResult({
          found: true,
          barcode: clean,
          name: res.item.name || 'Pantry Item',
          category: inferred.category || res.item.category || 'Pantry',
          location: (inferred.location as PantryLocation) || (res.item.location as PantryLocation) || 'pantry',
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

  const handleSaveSingleItem = async () => {
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

  const handleLocationChangeForBatchItem = async (itemId: string, newLocation: PantryLocation) => {
    try {
      const updated = await api.updateInventoryItem(itemId, { location: newLocation });
      setBatchItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)));
      onItemAdded(updated);
    } catch (e) {
      console.error('Failed to change location:', e);
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const getLocationLabel = (loc: PantryLocation) => {
    switch (loc) {
      case 'fridge':
        return '🧊 Fridge';
      case 'freezer':
        return '❄️ Freezer';
      default:
        return '🥫 Pantry';
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Scan Barcode"
      subtitle={isBatchMode ? 'Rapid batch mode: scan items one after another' : 'Add packaged foods with auto-calculated shelf life'}
      icon={<Barcode className="w-5 h-5 text-slate-950" />}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {/* Mode Toggle Header */}
        <div className="flex items-center justify-between p-2.5 bg-slate-900/80 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isBatchMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                Batch Scanning
                {isBatchMode && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono font-semibold">
                    ACTIVE
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-400">
                {isBatchMode ? 'Auto-adds items & keeps camera scanning' : 'Review & confirm each item individually'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsBatchMode(!isBatchMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isBatchMode
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-white/10 text-slate-300 hover:bg-white/15'
            }`}
          >
            {isBatchMode ? 'Batch On' : 'Single Item'}
          </button>
        </div>

        {/* Camera Viewfinder */}
        {!lookupResult && (
          <div className="space-y-4">
            {cameraError ? (
              <div className="p-4 bg-slate-900/80 rounded-2xl border border-white/10 space-y-3 text-center">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <p className="text-xs text-amber-300 max-w-sm mx-auto">{cameraError}</p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Retry Camera</span>
                </button>
              </div>
            ) : (
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

                {/* Floating Success Notification Toast */}
                {lastScannedToast && (
                  <div className="absolute top-3 left-3 right-4 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2.5 bg-emerald-950/90 border border-emerald-500/50 backdrop-blur-md rounded-xl text-white shadow-xl flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 font-bold text-xs">
                        {lastScannedToast.isDuplicate ? '+' : <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate text-emerald-200">
                          {lastScannedToast.isDuplicate ? `Updated: ${lastScannedToast.name}` : lastScannedToast.name}
                        </p>
                        <p className="text-[10px] text-emerald-400 font-medium">
                          {lastScannedToast.isDuplicate
                            ? `Quantity increased to ${lastScannedToast.quantity || '2'} (${getLocationLabel(lastScannedToast.location)})`
                            : `Auto-assigned to ${getLocationLabel(lastScannedToast.location)}`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Looking up spinner on viewfinder */}
                {isLookingUp && (
                  <div className="absolute top-3 left-3 px-3 py-1.5 bg-slate-950/80 backdrop-blur-md rounded-xl text-xs font-semibold text-emerald-400 border border-white/10 flex items-center gap-1.5 z-20">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Identifying...</span>
                  </div>
                )}

                {/* Manual Scan Trigger (Instant scan fallback) */}
                <div className="absolute bottom-3 left-0 right-0 px-4 flex justify-center z-10">
                  <button
                    type="button"
                    onClick={captureFrameAndScan}
                    disabled={isLookingUp}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 active:scale-95 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/30 flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Zap className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{hasBarcodeDetector ? 'Instant Barcode Scan' : 'Scan Centered Item'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Batch Session Tray */}
            {isBatchMode && batchItems.length > 0 && (
              <div className="p-3 bg-slate-900/70 rounded-2xl border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                    Scanned This Session ({batchItems.length})
                  </span>
                  <span className="text-[10px] text-slate-400">Tap location to change</span>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {batchItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-2 bg-slate-950/60 rounded-xl border border-white/5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">{item.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Qty: {item.quantity || '1'}
                          </span>
                          <span className="text-[10px] text-slate-400">{item.category}</span>
                        </div>
                      </div>

                      <div className="relative shrink-0">
                        <select
                          value={item.location}
                          onChange={(e) =>
                            handleLocationChangeForBatchItem(item.id, e.target.value as PantryLocation)
                          }
                          className="text-[11px] font-semibold px-2 py-1 bg-slate-800 border border-white/10 rounded-lg text-slate-200 cursor-pointer focus:outline-none"
                        >
                          <option value="fridge">🧊 Fridge</option>
                          <option value="freezer">❄️ Freezer</option>
                          <option value="pantry">🥫 Pantry</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Done Scanning ({batchItems.length} Added)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Single-Item Lookup Result Form */}
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
                  startCamera();
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
                  onChange={(e) => {
                    const newName = e.target.value;
                    const inferred = inferStorageLocation(newName, lookupResult.category);
                    setLookupResult({
                      ...lookupResult,
                      name: newName,
                      location: inferred.location,
                      category: inferred.category,
                    });
                  }}
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
                onClick={() => {
                  setLookupResult(null);
                  startCamera();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
              >
                Back to Camera
              </button>
              <button
                type="button"
                onClick={handleSaveSingleItem}
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
