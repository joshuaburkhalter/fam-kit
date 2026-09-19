import React, { useState, useEffect, useRef } from 'react';
import { Drawer } from './ui/Drawer';
import {
  X,
  Link2,
  Sparkles,
  Loader2,
  Check,
  Utensils,
  Clock,
  Users,
  AlertCircle,
  ClipboardPaste,
  ArrowRight,
  Camera,
  Image as ImageIcon,
  Trash2,
  Star,
  Plus,
  FileText,
} from 'lucide-react';
import type { Recipe } from '../types';
import { api } from '../lib/api';
import { usePWA } from '../context/PWAContext';
import { compressImageFile, type CompressedImageResult } from '../lib/imageCompression';

export function cleanExtractedUrl(raw: string): string {
  return raw.replace(/[),.;!]+$/, '').trim();
}

export function extractSharedUrl(params: URLSearchParams): string | null {
  // 1. Direct 'url' parameter
  const rawUrl = params.get('url');
  if (rawUrl) {
    const trimmed = cleanExtractedUrl(rawUrl);
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
  }

  // 2. Mobile browsers/apps share the link in 'text' (e.g. "Check out this recipe: https://...")
  const rawText = params.get('text');
  if (rawText) {
    const match = rawText.match(/https?:\/\/[^\s]+/i);
    if (match) return cleanExtractedUrl(match[0]);
  }

  // 3. Fallback check on 'title' if a link was shared as title
  const rawTitle = params.get('title');
  if (rawTitle) {
    const match = rawTitle.match(/https?:\/\/[^\s]+/i);
    if (match) return cleanExtractedUrl(match[0]);
  }

  return null;
}

interface RecipeScraperModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  onRecipeImported: (recipe: Recipe) => void;
  initialUrl?: string;
  autoImport?: boolean;
  initialMode?: 'scan' | 'url' | 'text';
}

export const RecipeScraperModal: React.FC<RecipeScraperModalProps> = ({
  isOpen,
  onClose,
  householdId,
  onRecipeImported,
  initialUrl = '',
  autoImport = false,
  initialMode = 'scan',
}) => {
  const { apiKey } = usePWA();
  const [activeTab, setActiveTab] = useState<'scan' | 'url' | 'text'>(initialMode);
  
  // URL mode state
  const [url, setUrl] = useState(initialUrl);
  const [isCopiedFromClipboard, setIsCopiedFromClipboard] = useState(false);

  // Text mode state
  const [rawText, setRawText] = useState('');

  // Scan / Photos mode state
  const [capturedImages, setCapturedImages] = useState<CompressedImageResult[]>([]);
  const [selectedCoverIndex, setSelectedCoverIndex] = useState<number>(0);
  const [isCompressingImages, setIsCompressingImages] = useState(false);

  // Common state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [importedRecipe, setImportedRecipe] = useState<Recipe | null>(null);

  const autoImportTriggeredRef = useRef<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialUrl && initialUrl !== url) {
      setUrl(initialUrl);
      setActiveTab('url');
    }
  }, [initialUrl]);

  useEffect(() => {
    if (isOpen) {
      if (initialUrl) {
        setActiveTab('url');
      } else if (initialMode) {
        setActiveTab(initialMode);
      }
    } else {
      setError(null);
      setImportedRecipe(null);
      setIsLoading(false);
      setCapturedImages([]);
      setSelectedCoverIndex(0);
      setRawText('');
      autoImportTriggeredRef.current = null;
    }
  }, [isOpen, initialMode, initialUrl]);

  // Handle URL scraping
  const scrapeUrl = async (targetUrl: string) => {
    const clean = cleanExtractedUrl(targetUrl);
    if (!clean) return;

    setIsLoading(true);
    setLoadingMessage('Parsing recipe schema and metadata with Gemini...');
    setError(null);
    setImportedRecipe(null);

    try {
      const recipe = await api.importRecipeFromUrl(householdId, clean, apiKey || undefined);
      setImportedRecipe(recipe);
      onRecipeImported(recipe);
    } catch (err: any) {
      console.error('Scrape error:', err);
      setError(
        err.message ||
          'Could not extract recipe from this page. Make sure the link is publicly accessible.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && initialUrl && autoImport && householdId) {
      if (autoImportTriggeredRef.current !== initialUrl) {
        autoImportTriggeredRef.current = initialUrl;
        scrapeUrl(initialUrl);
      }
    }
  }, [isOpen, initialUrl, autoImport, householdId]);

  // Handle Photo files added
  const handleFilesAdded = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCompressingImages(true);
    setError(null);

    try {
      const compressedList: CompressedImageResult[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        const result = await compressImageFile(file, 1280, 0.82);
        compressedList.push(result);
      }

      setCapturedImages((prev) => {
        const next = [...prev, ...compressedList];
        return next;
      });
    } catch (err: any) {
      console.error('Failed to process photos:', err);
      setError(err.message || 'Failed to process selected photos.');
    } finally {
      setIsCompressingImages(false);
      // Reset input value so same photo can be re-selected if needed
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setCapturedImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (selectedCoverIndex >= next.length) {
        setSelectedCoverIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  // Handle Scanning Photos with Gemini Vision
  const handleScanPhotos = async () => {
    if (capturedImages.length === 0) {
      setError('Please take or upload at least one recipe photo first.');
      return;
    }

    setIsLoading(true);
    setLoadingMessage(`Analyzing ${capturedImages.length} photo${capturedImages.length > 1 ? 's' : ''} with Gemini Vision...`);
    setError(null);
    setImportedRecipe(null);

    try {
      const imagePayload = capturedImages.map((img) => ({
        base64: img.dataUrl,
        mimeType: img.mimeType,
      }));

      const recipe = await api.importRecipeFromImages(
        householdId,
        imagePayload,
        selectedCoverIndex,
        apiKey || undefined
      );

      setImportedRecipe(recipe);
      onRecipeImported(recipe);
    } catch (err: any) {
      console.error('Scan error:', err);
      setError(
        err.message ||
          'Could not parse recipe from photos. Please ensure the recipe text is clear and readable.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Raw Text Import
  const handleImportText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    setIsLoading(true);
    setLoadingMessage('Parsing recipe text with Gemini...');
    setError(null);
    setImportedRecipe(null);

    try {
      const recipe = await api.importRecipeFromTextOrHtml(householdId, {
        rawText: rawText.trim(),
        apiKey: apiKey || undefined,
      });
      setImportedRecipe(recipe);
      onRecipeImported(recipe);
    } catch (err: any) {
      console.error('Text import error:', err);
      setError(err.message || 'Could not parse recipe from text.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handlePasteClipboard = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        alert('Clipboard access is not available. Please paste the link manually.');
        return;
      }
      const text = await navigator.clipboard.readText();
      const match = text.match(/https?:\/\/[^\s]+/i);
      const link = match ? cleanExtractedUrl(match[0]) : text.trim();
      if (link && /^https?:\/\//i.test(link)) {
        setUrl(link);
        setIsCopiedFromClipboard(true);
        setTimeout(() => setIsCopiedFromClipboard(false), 2000);
      } else {
        alert('No valid web link found on your clipboard. Please copy a recipe URL first.');
      }
    } catch (err: any) {
      console.warn('Clipboard read error:', err);
      alert('Could not access clipboard. Please paste the link into the box.');
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Add & Import Recipe"
      subtitle="Scan cookbook pages, snap photos, paste web links, or enter text"
      icon={<Sparkles className="w-5 h-5 text-emerald-400" />}
      footer={
        <div className="w-full flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
          {importedRecipe && (
            <button
              type="button"
              onClick={() => {
                onRecipeImported(importedRecipe);
                onClose();
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <span>View Recipe</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          )}
        </div>
      }
    >
      {/* Hidden file inputs for camera and gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFilesAdded}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFilesAdded}
      />

      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex rounded-2xl bg-slate-950/80 p-1 border border-white/10 gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('scan');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'scan'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Scan Photos</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('url');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'url'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Web Link</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('text');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'text'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Paste Text</span>
          </button>
        </div>

        {/* TAB 1: SCAN PHOTOS (Multi-picture cookbook & dish scanner) */}
        {activeTab === 'scan' && (
          <div className="space-y-3.5 animate-in fade-in duration-200">
            {/* If no photos taken yet, show prominent call-to-action */}
            {capturedImages.length === 0 ? (
              <div className="border-2 border-dashed border-white/15 rounded-3xl p-6 sm:p-8 text-center space-y-4 bg-slate-950/40">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/10">
                  <Camera className="w-7 h-7 stroke-[2.2]" />
                </div>
                <div className="space-y-1 max-w-sm mx-auto">
                  <h3 className="text-sm font-bold text-white">
                    Scan Cookbook or Recipe Cards
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Snap multiple photos: ingredients, directions, and the finished dish from a cookbook or table. We'll parse the recipe and set your dish picture as the cover!
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isCompressingImages}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Take Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={isCompressingImages}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 border border-white/10 transition-colors cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    <span>Choose from Library</span>
                  </button>
                </div>

                {isCompressingImages && (
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>Optimizing photos...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Photo Grid */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      Recipe Photos ({capturedImages.length})
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      (Tap a photo to set as cover picture)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1 font-semibold cursor-pointer"
                      title="Take another photo"
                    >
                      <Camera className="w-3 h-3 text-emerald-400" />
                      <span>+ Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1 font-semibold cursor-pointer"
                      title="Add more photos from library"
                    >
                      <ImageIcon className="w-3 h-3 text-emerald-400" />
                      <span>+ Library</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
                  {capturedImages.map((img, idx) => {
                    const isCover = idx === selectedCoverIndex;
                    return (
                      <div
                        key={idx}
                        className={`relative rounded-2xl overflow-hidden border transition-all group aspect-[4/3] bg-slate-950 ${
                          isCover
                            ? 'border-emerald-400 ring-2 ring-emerald-400/40 shadow-lg shadow-emerald-500/20'
                            : 'border-white/15 hover:border-white/30'
                        }`}
                      >
                        <img
                          src={img.dataUrl}
                          alt={`Page ${idx + 1}`}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setSelectedCoverIndex(idx)}
                        />

                        {/* Top: Delete button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePhoto(idx);
                          }}
                          className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-slate-950/80 hover:bg-rose-500 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Remove photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Page label */}
                        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-slate-950/80 font-mono text-[10px] text-white font-bold border border-white/10">
                          #{idx + 1}
                        </span>

                        {/* Bottom: Cover Badge / Selector */}
                        <div className="absolute bottom-1.5 inset-x-1.5 flex justify-center">
                          {isCover ? (
                            <span className="bg-emerald-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                              <Star className="w-3 h-3 fill-slate-950" />
                              <span>Recipe Cover</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedCoverIndex(idx)}
                              className="bg-slate-950/80 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/20 transition-all cursor-pointer"
                            >
                              Set as Cover
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Scan Action Button */}
                <button
                  type="button"
                  onClick={handleScanPhotos}
                  disabled={isLoading || isCompressingImages || capturedImages.length === 0}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-50 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Scanning & Parsing Recipe...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Scan & Save Recipe ({capturedImages.length} {capturedImages.length === 1 ? 'photo' : 'photos'})</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WEB URL LINK */}
        {activeTab === 'url' && (
          <form onSubmit={(e) => { e.preventDefault(); if (url.trim()) scrapeUrl(url); }} className="space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 block">
                Recipe Link / URL
              </label>
              {typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText) && (
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>{isCopiedFromClipboard ? 'Pasted!' : 'Paste from Clipboard'}</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="url"
                  required
                  placeholder="https://www.allrecipes.com/recipe/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                {url && (
                  <button
                    type="button"
                    onClick={() => setUrl('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={isLoading || !url.trim()}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20 shrink-0 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Import
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: PASTE TEXT */}
        {activeTab === 'text' && (
          <form onSubmit={handleImportText} className="space-y-3 animate-in fade-in duration-200">
            <label className="text-xs font-semibold text-slate-300 block">
              Recipe Ingredients & Directions Text
            </label>
            <textarea
              rows={6}
              required
              placeholder="Paste recipe text, ingredients list, or notes here..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none font-mono"
            />
            <button
              type="submit"
              disabled={isLoading || !rawText.trim()}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Parsing Recipe Text...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Parse & Save Recipe</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-red-400 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Import Failed</p>
              <p className="text-slate-400 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="py-8 text-center space-y-3 bg-slate-950/40 rounded-2xl border border-white/5">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto" />
            <p className="text-xs text-slate-300 font-medium">
              {loadingMessage || 'Processing recipe with Gemini AI...'}
            </p>
          </div>
        )}

        {/* Recipe Preview */}
        {importedRecipe && !isLoading && (
          <div className="space-y-4 pt-2 border-t border-white/10 animate-in fade-in duration-200">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Recipe successfully parsed and saved!</span>
              </div>
            </div>

            {importedRecipe.image_url && (
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-lg aspect-[16/9] bg-slate-950">
                <img
                  src={importedRecipe.image_url}
                  alt={importedRecipe.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-2 left-2 bg-slate-950/80 px-2 py-0.5 rounded-md text-[10px] font-bold text-emerald-300 border border-white/15">
                  Recipe Picture
                </span>
              </div>
            )}

            <div>
              <h3 className="text-base sm:text-lg font-black text-white">{importedRecipe.title}</h3>
              {importedRecipe.description && (
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {importedRecipe.description}
                </p>
              )}
            </div>

            {/* Meta pills */}
            <div className="flex flex-wrap gap-2 text-xs">
              {Boolean(importedRecipe.prep_time_minutes && importedRecipe.prep_time_minutes > 0) ? (
                <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg text-slate-300 flex items-center gap-1.5 border border-white/5">
                  <Clock className="w-3.5 h-3.5 text-pink-400" />
                  Prep: {importedRecipe.prep_time_minutes}m
                </span>
              ) : null}
              {Boolean(importedRecipe.cook_time_minutes && importedRecipe.cook_time_minutes > 0) ? (
                <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg text-slate-300 flex items-center gap-1.5 border border-white/5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Cook: {importedRecipe.cook_time_minutes}m
                </span>
              ) : null}
              {Boolean(importedRecipe.servings && importedRecipe.servings > 0) ? (
                <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg text-slate-300 flex items-center gap-1.5 border border-white/5">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  Serves: {importedRecipe.servings}
                </span>
              ) : null}
            </div>

            {/* Ingredients Preview */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Ingredients ({importedRecipe.ingredients.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                {importedRecipe.ingredients.map((ing, i) => (
                  <div
                    key={i}
                    className="text-xs p-2 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between text-slate-200"
                  >
                    <span className="truncate">{ing.item}</span>
                    {ing.amount && (
                      <span className="font-mono text-emerald-400 text-[11px] shrink-0 ml-2 font-bold">
                        {ing.amount} {ing.unit || ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions Preview */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Instructions ({importedRecipe.instructions.length} steps)
              </h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {importedRecipe.instructions.map((inst, i) => (
                  <div
                    key={i}
                    className="text-xs p-2.5 rounded-xl bg-slate-900/40 border border-white/5 text-slate-300 flex gap-2 leading-relaxed"
                  >
                    <span className="font-mono text-emerald-400 font-bold shrink-0">{i + 1}.</span>
                    <span>{inst}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};
