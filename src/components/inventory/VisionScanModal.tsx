import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Drawer } from '../ui/Drawer';
import { Camera, Upload, Check, Loader2, Sparkles, AlertCircle, Zap, Plus, ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api';
import { inferStorageLocation } from '../../lib/shelfLife';
import { compressImageFile } from '../../lib/imageCompression';
import type { PantryLocation } from '../../types';

interface RecognizedItem {
  id: string;
  selected: boolean;
  name: string;
  category: string;
  location: PantryLocation;
  quantity: string;
  expiresAt: string;
  isStock?: boolean;
}

interface VisionScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemsAdded: () => void;
}

export const VisionScanModal: React.FC<VisionScanModalProps> = ({
  isOpen,
  onClose,
  onItemsAdded,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isLiveCameraActive, setIsLiveCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recognizedItems, setRecognizedItems] = useState<RecognizedItem[]>([]);
  const [shotsCount, setShotsCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const stopLiveCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLiveCameraActive(false);
    setCameraLoading(false);
  }, []);

  const startLiveCamera = useCallback(async () => {
    setCameraError(null);
    setCameraLoading(true);
    setIsLiveCameraActive(true);

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
          console.warn('Video play error:', e);
        }
      }
      setCameraLoading(false);
    } catch (err: any) {
      console.warn('Live camera error:', err);
      setCameraError('Live camera could not be opened automatically. You can use the Native Camera button or pick an image from gallery.');
      setIsLiveCameraActive(false);
      setCameraLoading(false);
    }
  }, []);

  // Directly open live camera whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setImagePreview(null);
      setRecognizedItems([]);
      setShotsCount(0);
      setError(null);
      startLiveCamera();
    } else {
      stopLiveCamera();
    }
  }, [isOpen, startLiveCamera, stopLiveCamera]);

  const snapLivePhoto = () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    stopLiveCamera();
    setImagePreview(base64);
    processImage(base64, 'image/jpeg');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    try {
      stopLiveCamera();
      const res = await compressImageFile(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.85 });
      setImagePreview(res.dataUrl);
      processImage(res.dataUrl, res.mimeType);
    } catch (err: any) {
      console.error('Vision scan image processing failed:', err);
      setError(err?.message || 'Could not process this image. Please try another.');
    } finally {
      e.target.value = '';
    }
  };

  const processImage = async (base64: string, type: string) => {
    setIsScanning(true);
    setError(null);
    try {
      const res = await api.scanInventoryVision(base64, type);
      if (res.items && res.items.length > 0) {
        setShotsCount((c) => c + 1);
        const mappedItems: RecognizedItem[] = res.items.map((item, idx) => {
          // Auto-categorize location based on food type
          const inferred = inferStorageLocation(item.name, item.category);
          return {
            id: `rec_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            selected: true,
            name: item.name,
            category: inferred.category || item.category,
            location: (inferred.location as PantryLocation) || item.location,
            quantity: item.quantity,
            expiresAt: item.expiresAt,
            isStock: false,
          };
        });

        // Append to existing recognized items for multi-shot batch mode
        setRecognizedItems((prev) => {
          // Simple deduplication if same item name already collected
          const existingNames = new Set(prev.map((i) => i.name.toLowerCase().trim()));
          const novel = mappedItems.filter((i) => !existingNames.has(i.name.toLowerCase().trim()));
          return [...prev, ...novel];
        });
      } else {
        setError('No grocery or pantry items were recognized in this shot. Try taking a closer or clearer photo!');
      }
    } catch (err: any) {
      console.error('Vision scan error:', err);
      setError(err.message || 'Failed to scan image. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const toggleSelectAll = () => {
    const allSelected = recognizedItems.every((i) => i.selected);
    setRecognizedItems(recognizedItems.map((i) => ({ ...i, selected: !allSelected })));
  };

  const handleSaveSelected = async () => {
    const toSave = recognizedItems.filter((i) => i.selected && i.name.trim());
    if (toSave.length === 0) return;

    setIsSaving(true);
    try {
      await api.addInventoryBatch(
        toSave.map((i) => ({
          name: i.name.trim(),
          category: i.category,
          location: i.location,
          quantity: i.quantity,
          expiresAt: i.expiresAt,
          isStock: Boolean(i.isStock),
          restockCadenceDays: i.isStock ? 14 : null,
        }))
      );
      onItemsAdded();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save items to pantry');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    stopLiveCamera();
    setImagePreview(null);
    setRecognizedItems([]);
    setShotsCount(0);
    setError(null);
    setIsScanning(false);
    onClose();
  };

  const selectedCount = recognizedItems.filter((i) => i.selected).length;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title="AI Photo Scan"
      subtitle="Snap your fridge, freezer shelves, or pantry to auto-inventory"
      icon={<Camera className="w-5 h-5 text-slate-950" />}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* Hidden File Inputs for Native Camera / Gallery Pickers */}
        <input
          type="file"
          ref={cameraInputRef}
          onChange={handleFileChange}
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif,image/*"
          capture="environment"
          className="hidden"
        />
        <input
          type="file"
          ref={galleryInputRef}
          onChange={handleFileChange}
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif,image/*"
          className="hidden"
        />

        {/* Viewfinder or Fallback Options */}
        {!imagePreview ? (
          <div className="space-y-4">
            {cameraError ? (
              <div className="p-4 bg-slate-900/80 rounded-2xl border border-white/10 space-y-3 text-center">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <p className="text-xs text-amber-300 max-w-sm mx-auto">{cameraError}</p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={startLiveCamera}
                    className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Retry Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload from Gallery</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-inner">
                {cameraLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
                    <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                  </div>
                )}

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

                {/* Batch multi-shot badge if previous items exist */}
                {recognizedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setImagePreview('batch_preview')}
                    className="absolute top-3 left-3 px-3 py-1.5 bg-purple-950/80 hover:bg-purple-900 backdrop-blur-md rounded-xl text-xs font-bold text-purple-200 border border-purple-500/40 shadow-lg flex items-center gap-1.5 cursor-pointer z-10"
                  >
                    <span>📦 {recognizedItems.length} items collected</span>
                    <span className="text-[10px] underline">View</span>
                  </button>
                )}

                {/* Gallery Upload shortcut */}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-slate-950/80 hover:bg-slate-900 backdrop-blur-md rounded-xl text-xs font-semibold text-white border border-white/10 shadow-md cursor-pointer transition-colors z-10 flex items-center gap-1.5"
                  title="Upload photo from gallery"
                >
                  <Upload className="w-3.5 h-3.5 text-purple-300" />
                  <span>Gallery</span>
                </button>

                {/* Snap Photo Action */}
                <div className="absolute bottom-4 left-0 right-0 px-4 flex justify-center z-10">
                  <button
                    type="button"
                    onClick={snapLivePhoto}
                    className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xl shadow-purple-500/30 flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Camera className="w-4 h-4 stroke-[2.5]" />
                    <span>{shotsCount > 0 ? 'Snap Next Shelf' : 'Snap Photo of Food'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Smart Categorization Notice */}
            <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-start gap-2.5 text-xs text-purple-300">
              <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-purple-400" />
              <span>
                <strong>Smart Location Auto-Categorization:</strong> Foods are automatically sorted into 🧊 Fridge, ❄️ Freezer, or 🥫 Pantry with calculated freshness shelf-life.
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status & Multi-shot Control Header */}
            <div className="flex items-center gap-3 p-3 bg-slate-900/80 rounded-2xl border border-white/10">
              {imagePreview !== 'batch_preview' && (
                <img
                  src={imagePreview}
                  alt="Scan Preview"
                  className="w-12 h-12 object-cover rounded-xl border border-white/10 shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                {isScanning ? (
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Recognizing foods with Gemini AI...
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Auto-sorting into fridge, freezer, and pantry
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-white">
                      {recognizedItems.length} items collected {shotsCount > 1 ? `across ${shotsCount} shots` : ''}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      Auto-sorted into fridge, freezer & pantry
                    </p>
                  </div>
                )}
              </div>

              {!isScanning && (
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    startLiveCamera();
                  }}
                  className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 active:scale-95 text-purple-200 rounded-xl text-xs font-bold border border-purple-500/30 flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer transition-all shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 text-purple-400" />
                  <span>Snap Shelf</span>
                </button>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Checklist of Recognized Items */}
            {recognizedItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-300">
                    Recognized Items ({selectedCount}/{recognizedItems.length})
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-xs text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
                    >
                      {recognizedItems.every((i) => i.selected) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {recognizedItems.map((item, index) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-2xl border transition-all ${
                        item.selected
                          ? 'bg-purple-500/10 border-purple-500/30 text-white'
                          : 'bg-slate-900/40 border-white/5 opacity-50 text-slate-400'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(e) => {
                            const updated = [...recognizedItems];
                            updated[index].selected = e.target.checked;
                            setRecognizedItems(updated);
                          }}
                          className="mt-1 w-4 h-4 rounded text-purple-500 focus:ring-purple-500 border-white/10 bg-slate-900 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => {
                                const newName = e.target.value;
                                const inferred = inferStorageLocation(newName, item.category);
                                const updated = [...recognizedItems];
                                updated[index].name = newName;
                                updated[index].location = inferred.location;
                                updated[index].category = inferred.category;
                                setRecognizedItems(updated);
                              }}
                              className="flex-1 font-bold text-xs text-white bg-transparent border-b border-transparent focus:border-purple-400 focus:outline-none py-0.5"
                            />
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 shrink-0">
                              {item.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={item.location}
                              onChange={(e) => {
                                const updated = [...recognizedItems];
                                updated[index].location = e.target.value as PantryLocation;
                                setRecognizedItems(updated);
                              }}
                              className="text-xs px-2.5 py-1 bg-slate-900 border border-white/10 rounded-lg text-slate-200 cursor-pointer font-semibold"
                            >
                              <option value="fridge">🧊 Fridge</option>
                              <option value="freezer">❄️ Freezer</option>
                              <option value="pantry">🥫 Pantry</option>
                            </select>

                            <input
                              type="text"
                              value={item.quantity}
                              onChange={(e) => {
                                const updated = [...recognizedItems];
                                updated[index].quantity = e.target.value;
                                setRecognizedItems(updated);
                              }}
                              placeholder="Qty"
                              className="w-20 text-xs px-2 py-1 bg-slate-900 border border-white/10 rounded-lg text-slate-200"
                            />

                            <label className="flex items-center gap-1 cursor-pointer text-[11px] text-slate-300 ml-auto">
                              <input
                                type="checkbox"
                                checked={Boolean(item.isStock)}
                                onChange={(e) => {
                                  const updated = [...recognizedItems];
                                  updated[index].isStock = e.target.checked;
                                  setRecognizedItems(updated);
                                }}
                                className="w-3.5 h-3.5 rounded text-purple-500 focus:ring-purple-500 border-white/10 bg-slate-900 cursor-pointer"
                              />
                              <span>⭐ Staple</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Snap Another Shelf Secondary Action */}
                {!isScanning && (
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      startLiveCamera();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl border border-dashed border-purple-500/35 hover:border-purple-500/60 bg-purple-500/10 hover:bg-purple-500/15 active:scale-[0.99] text-purple-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
                  >
                    <Camera className="w-4 h-4 text-purple-400" />
                    <span>Snap Another Shelf or Drawer</span>
                  </button>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {recognizedItems.length > 0 && (
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSelected}
                  disabled={selectedCount === 0 || isSaving}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-purple-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Add {selectedCount} to Pantry
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
};
