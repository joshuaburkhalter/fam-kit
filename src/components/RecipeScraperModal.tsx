import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import type { Recipe } from '../types';
import { api } from '../lib/api';
import { usePWA } from '../context/PWAContext';

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
}

export const RecipeScraperModal: React.FC<RecipeScraperModalProps> = ({
  isOpen,
  onClose,
  householdId,
  onRecipeImported,
  initialUrl = '',
  autoImport = false,
}) => {
  const { apiKey } = usePWA();
  const [url, setUrl] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedRecipe, setImportedRecipe] = useState<Recipe | null>(null);
  const [isCopiedFromClipboard, setIsCopiedFromClipboard] = useState(false);
  const autoImportTriggeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialUrl && initialUrl !== url) {
      setUrl(initialUrl);
    }
  }, [initialUrl]);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setImportedRecipe(null);
      setIsLoading(false);
      autoImportTriggeredRef.current = null;
    }
  }, [isOpen]);

  const scrapeUrl = async (targetUrl: string) => {
    const clean = cleanExtractedUrl(targetUrl);
    if (!clean) return;

    setIsLoading(true);
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

  if (!isOpen) return null;

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    await scrapeUrl(url);
  };

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-900 border-t border-white/15 rounded-t-3xl p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-200 flex flex-col max-h-[90vh]">
        {/* Top Drag Handle */}
        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Import Recipe from Web</h2>
              <p className="text-[11px] text-slate-400">
                Paste any recipe URL to extract ingredients and instructions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* URL Form */}
        <form onSubmit={handleScrape} className="py-4 border-b border-white/10 space-y-3">
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
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20 shrink-0"
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

        {/* Error Alert */}
        {error && (
          <div className="my-3 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Extraction Failed</p>
              <p className="text-slate-400 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Recipe Preview */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4">
          {isLoading && (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto" />
              <p className="text-xs text-slate-300 font-medium">
                Parsing JSON-LD schema & meta tags with Gemini 3.6 Flash...
              </p>
            </div>
          )}

          {importedRecipe && !isLoading && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                  <Check className="w-4 h-4" />
                  Recipe successfully parsed and saved!
                </div>
              </div>

              {importedRecipe.image_url && (
                <img
                  src={importedRecipe.image_url}
                  alt={importedRecipe.title}
                  className="w-full h-44 object-cover rounded-2xl border border-white/10 shadow-lg"
                />
              )}

              <div>
                <h3 className="text-lg font-bold text-white">{importedRecipe.title}</h3>
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
                      <span>{ing.item}</span>
                      {ing.amount && (
                        <span className="font-mono text-slate-400 text-[11px]">
                          {ing.amount} {ing.unit || ''}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PWA Direct Share Tip */}
        <div className="pt-3 pb-1 text-[11px] text-slate-400 leading-relaxed border-t border-white/5 space-y-1">
          <p className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Direct Sharing with PWA</span>
          </p>
          <p>
            When viewing a recipe on <strong>Android</strong> or modern <strong>iOS</strong>, tap your browser's <strong>Share</strong> button and choose <strong>Homebase</strong>. The app will open directly and import the recipe automatically!
          </p>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
          {importedRecipe && (
            <button
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
      </div>
    </div>
  );
};
