import React, { useState, useRef } from 'react';
import { X, Camera, Upload, Check, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
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
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [isScanning, setIsScanning] = useState(false);
  const [recognizedItems, setRecognizedItems] = useState<RecognizedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMimeType(file.type || 'image/jpeg');
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      processImage(result, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (base64: string, type: string) => {
    setIsScanning(true);
    setError(null);
    try {
      const res = await api.scanInventoryVision(base64, type);
      if (res.items && res.items.length > 0) {
        setRecognizedItems(
          res.items.map((item, idx) => ({
            id: `rec_${idx}_${Date.now()}`,
            selected: true,
            name: item.name,
            category: item.category,
            location: item.location,
            quantity: item.quantity,
            expiresAt: item.expiresAt,
            isStock: false,
          }))
        );
      } else {
        setError('No grocery or pantry items were recognized in this image. Try taking a closer or clearer photo!');
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
    setImagePreview(null);
    setRecognizedItems([]);
    setError(null);
    setIsScanning(false);
    onClose();
  };

  if (!isOpen) return null;

  const selectedCount = recognizedItems.filter((i) => i.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">AI Photo Scan</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Scan fridge, pantry shelf, or receipt to add items</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          {!imagePreview ? (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-10 px-6 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-purple-500 dark:hover:border-purple-500 bg-zinc-50 dark:bg-zinc-800/40 hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-all flex flex-col items-center justify-center gap-3 cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Snap or upload a photo
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Take a picture of groceries, inside your fridge, or a receipt
                  </p>
                </div>
              </div>

              <div className="p-3 bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 rounded-xl flex items-start gap-2.5 text-xs text-purple-900 dark:text-purple-300">
                <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-purple-600 dark:text-purple-400" />
                <span>
                  <strong>Zero hassle shelf-life tracking:</strong> Food categories and USDA recommended freshness timelines are calculated automatically without reading blurry date stamps!
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image thumbnail & Scanning State */}
              <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <img
                  src={imagePreview}
                  alt="Scan Preview"
                  className="w-16 h-16 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  {isScanning ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Recognizing foods & pantry items...
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Analyzing contents and applying USDA category shelf-life rules
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {recognizedItems.length} items recognized
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Review and select items to add to your pantry
                        </p>
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-purple-600 dark:text-purple-400 font-medium hover:underline"
                      >
                        Change Photo
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-800 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Items Checklist */}
              {recognizedItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Recognized Items
                    </span>
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-xs text-purple-600 dark:text-purple-400 font-medium hover:underline"
                    >
                      {recognizedItems.every((i) => i.selected) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {recognizedItems.map((item, index) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition-all ${
                          item.selected
                            ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/60'
                            : 'bg-zinc-50/50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-800 opacity-60'
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
                            className="mt-1 w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-zinc-300 dark:border-zinc-700"
                          />
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => {
                                  const updated = [...recognizedItems];
                                  updated[index].name = e.target.value;
                                  setRecognizedItems(updated);
                                }}
                                className="flex-1 font-medium text-xs text-zinc-900 dark:text-zinc-100 bg-transparent border-b border-transparent focus:border-purple-500 focus:outline-none"
                              />
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
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
                                className="text-xs px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200"
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
                                className="w-20 text-xs px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200"
                              />

                              <label className="flex items-center gap-1 cursor-pointer text-[11px] text-zinc-600 dark:text-zinc-400 ml-auto">
                                <input
                                  type="checkbox"
                                  checked={Boolean(item.isStock)}
                                  onChange={(e) => {
                                    const updated = [...recognizedItems];
                                    updated[index].isStock = e.target.checked;
                                    setRecognizedItems(updated);
                                  }}
                                  className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 border-zinc-300 dark:border-zinc-700"
                                />
                                <span>⭐ Staple</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {recognizedItems.length > 0 && (
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSelected}
                    disabled={selectedCount === 0 || isSaving}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5 shadow-sm"
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
      </div>
    </div>
  );
};
