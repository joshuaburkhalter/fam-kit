'use client';

import React, { useState, useEffect } from 'react';
import { usePWA } from '@/components/pwa/PWAProvider';
import { GroceryItemData, CustomListData, Aisle } from '@/types';
import {
  ShoppingCart,
  Plus,
  Check,
  Trash2,
  ListFilter,
  ArrowUpDown,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  X,
  FolderPlus,
  MoveUp,
  MoveDown,
  Sparkles,
  GripVertical
} from 'lucide-react';

const AISLE_ACCENTS: Record<string, { bg: string; text: string; border: string }> = {
  'Produce': { bg: 'from-emerald-950/40 to-green-950/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'Bakery & Bread': { bg: 'from-amber-950/40 to-yellow-950/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  'Deli & Prepared': { bg: 'from-orange-950/40 to-amber-950/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  'Meat & Seafood': { bg: 'from-rose-950/40 to-red-950/20', text: 'text-rose-400', border: 'border-rose-500/30' },
  'Dairy & Eggs': { bg: 'from-blue-950/40 to-cyan-950/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  'Pantry & Dry Goods': { bg: 'from-teal-950/40 to-emerald-950/20', text: 'text-teal-400', border: 'border-teal-500/30' },
  'Snacks & Sweets': { bg: 'from-purple-950/40 to-fuchsia-950/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  'Frozen': { bg: 'from-cyan-950/40 to-sky-950/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  'Beverages': { bg: 'from-indigo-950/40 to-blue-950/20', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  'Household & Cleaning': { bg: 'from-slate-900 to-slate-950', text: 'text-slate-300', border: 'border-slate-700/50' },
  'Personal Care & Pharmacy': { bg: 'from-pink-950/40 to-rose-950/20', text: 'text-pink-400', border: 'border-pink-500/30' },
  'Pet Care': { bg: 'from-amber-950/30 to-slate-900', text: 'text-amber-300', border: 'border-amber-600/30' },
  'Other': { bg: 'from-slate-900 to-slate-950', text: 'text-slate-300', border: 'border-slate-800' },
};

export default function GroceryPage() {
  const { activeMember } = usePWA();
  const [items, setItems] = useState<GroceryItemData[]>([]);
  const [customLists, setCustomLists] = useState<CustomListData[]>([]);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Quick Add input
  const [newItemName, setNewItemName] = useState('');
  const [selectedAisleId, setSelectedAisleId] = useState<string>('');
  const [newItemQty, setNewItemQty] = useState('1');

  // View state toggles
  const [shoppingMode, setShoppingMode] = useState(false);
  const [collapsedAisles, setCollapsedAisles] = useState<Record<string, boolean>>({});

  // Modals
  const [showAisleModal, setShowAisleModal] = useState(false);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newAisleName, setNewAisleName] = useState('');
  const [newAisleIcon, setNewAisleIcon] = useState('🛒');
  const [newListName, setNewListName] = useState('');
  const [newListIcon, setNewListIcon] = useState('📋');
  const [newListType, setNewListType] = useState('packing');

  // Fetch Items, Lists, and Aisles
  const fetchGroceryData = async () => {
    try {
      setIsLoading(true);
      const url = activeListId ? `/api/grocery?listId=${activeListId}` : '/api/grocery';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setCustomLists(data.lists || []);
        setAisles(data.aisles || []);
        if (data.aisles?.length > 0 && !selectedAisleId) {
          setSelectedAisleId(data.aisles[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load grocery data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroceryData();
  }, [activeListId]);

  // Toggle item checked
  const toggleItemChecked = async (item: GroceryItemData) => {
    const nextChecked = !item.checked;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, checked: nextChecked } : i))
    );

    try {
      await fetch('/api/grocery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, checked: nextChecked }),
      });
    } catch (err) {
      console.error('Error updating item check:', err);
    }
  };

  // Add Item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const matchedAisle = aisles.find((a) => a.id === selectedAisleId);

    try {
      const res = await fetch('/api/grocery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newItemName.trim(),
          aisleId: selectedAisleId || undefined,
          category: matchedAisle?.name || 'Other',
          quantity: newItemQty || '1',
          listId: activeListId,
          addedById: activeMember?.id,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setItems((prev) => [created, ...prev]);
        setNewItemName('');
        setNewItemQty('1');
      }
    } catch (err) {
      console.error('Failed to add item:', err);
    }
  };

  // Delete item
  const handleDeleteItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await fetch(`/api/grocery?id=${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  // Clear Completed
  const handleClearChecked = async () => {
    setItems((prev) => prev.filter((i) => !i.checked));
    try {
      const url = activeListId
        ? `/api/grocery?clearChecked=true&listId=${activeListId}`
        : '/api/grocery?clearChecked=true';
      await fetch(url, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to clear checked:', err);
    }
  };

  // Move Aisle Up / Down (Reordering)
  const moveAisle = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= aisles.length) return;

    const updated = [...aisles];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);

    const aisleOrders = updated.map((a, idx) => ({ id: a.id, orderIndex: idx }));
    setAisles(updated.map((a, idx) => ({ ...a, orderIndex: idx })));

    try {
      await fetch('/api/grocery/aisles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aisleOrders }),
      });
    } catch (err) {
      console.error('Failed to persist aisle reordering:', err);
    }
  };

  // Add Custom Aisle
  const handleAddCustomAisle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAisleName.trim()) return;

    try {
      const res = await fetch('/api/grocery/aisles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAisleName.trim(),
          icon: newAisleIcon || '🛒',
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setAisles((prev) => [...prev, created]);
        setNewAisleName('');
      }
    } catch (err) {
      console.error('Failed to add aisle:', err);
    }
  };

  // Create Custom Checklist
  const handleCreateCustomList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      const res = await fetch('/api/grocery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createList: true,
          name: newListName.trim(),
          icon: newListIcon || '📋',
          type: newListType || 'checklist',
        }),
      });

      await fetchGroceryData();
      setShowNewListModal(false);
      setNewListName('');
    } catch (err) {
      console.error('Failed to create custom list:', err);
    }
  };

  const isMainGrocery = activeListId === null;
  const activeCustomList = customLists.find((l) => l.id === activeListId);

  const displayedItems = shoppingMode ? items.filter((i) => !i.checked) : items;

  const groupedByAisle: { aisle: Aisle; items: GroceryItemData[] }[] = aisles.map((aisle) => ({
    aisle,
    items: displayedItems.filter(
      (item) => item.aisleId === aisle.id || (!item.aisleId && item.category === aisle.name)
    ),
  }));

  const unassignedItems = displayedItems.filter(
    (item) => !aisles.some((a) => a.id === item.aisleId || item.category === a.name)
  );

  const totalItemCount = items.length;
  const completedCount = items.filter((i) => i.checked).length;
  const remainingCount = totalItemCount - completedCount;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 w-full space-y-6">
      {/* Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/25">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {isMainGrocery ? 'Grocery Shopping List' : activeCustomList?.name || 'Custom Checklist'}
              </h1>
              <p className="text-xs text-slate-400">
                <span className="text-emerald-400 font-bold">{remainingCount} items remaining</span> • {completedCount} completed
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Shopping Mode Toggle */}
          <button
            onClick={() => setShoppingMode(!shoppingMode)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all border shadow-sm ${
              shoppingMode
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-950/40'
                : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:text-white'
            }`}
            title="Shopping Mode hides checked items"
          >
            {shoppingMode ? <EyeOff className="w-4 h-4 text-emerald-400" /> : <Eye className="w-4 h-4" />}
            <span>Shopping Mode</span>
          </button>

          {/* Rearrange Aisles Button */}
          {isMainGrocery && (
            <button
              onClick={() => setShowAisleModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900 border border-slate-700/80 text-xs font-bold text-slate-300 hover:text-white hover:border-slate-600 transition-all shadow-sm"
            >
              <ArrowUpDown className="w-4 h-4 text-emerald-400" />
              <span>Aisle Order</span>
            </button>
          )}

          {/* Clear Completed */}
          {completedCount > 0 && (
            <button
              onClick={handleClearChecked}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900 border border-rose-900/40 text-xs font-bold text-rose-400 hover:bg-rose-950/30 transition-colors shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Done ({completedCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* List Tabs (Main Grocery vs Custom Checklists) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-white/5">
        <button
          onClick={() => setActiveListId(null)}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 ${
            activeListId === null
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-102'
              : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <span>🛒</span>
          <span>Main Grocery</span>
          <span className="px-2 py-0.5 rounded-full bg-black/20 text-[10px] font-mono">{totalItemCount}</span>
        </button>

        {customLists.map((list) => (
          <button
            key={list.id}
            onClick={() => setActiveListId(list.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 ${
              activeListId === list.id
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-102'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>{list.icon}</span>
            <span>{list.name}</span>
          </button>
        ))}

        <button
          onClick={() => setShowNewListModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900/50 hover:bg-slate-800 border border-dashed border-slate-700 text-xs font-semibold text-slate-400 hover:text-slate-200 shrink-0 transition-colors"
        >
          <FolderPlus className="w-4 h-4 text-emerald-400" />
          <span>+ New List</span>
        </button>
      </div>

      {/* Quick Add Bar */}
      <form onSubmit={handleAddItem} className="glass-dock p-3 sm:p-4 rounded-3xl border border-slate-700/80 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder={isMainGrocery ? "Add grocery item (e.g. Avocado, Sourdough, Greek Yogurt)..." : "Add item to checklist..."}
            className="flex-1 w-full bg-slate-950/90 text-slate-100 placeholder-slate-500 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 border border-slate-800"
          />

          {isMainGrocery && (
            <select
              value={selectedAisleId}
              onChange={(e) => setSelectedAisleId(e.target.value)}
              className="w-full sm:w-auto bg-slate-950/90 text-slate-200 text-xs font-medium rounded-2xl px-3.5 py-3 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              {aisles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.icon} {a.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <input
              type="text"
              value={newItemQty}
              onChange={(e) => setNewItemQty(e.target.value)}
              placeholder="Qty"
              className="w-16 bg-slate-950/90 text-center text-slate-200 text-xs font-bold rounded-2xl px-2 py-3 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            <button
              type="submit"
              disabled={!newItemName.trim()}
              className="flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-40 text-white text-xs font-extrabold shadow-md shadow-emerald-600/30 transition-all shrink-0 hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>
        </div>
      </form>

      {/* Grocery Aisles Matrix */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-500 text-sm animate-pulse">
          Loading grocery aisles...
        </div>
      ) : isMainGrocery ? (
        <div className="space-y-4">
          {groupedByAisle.map(({ aisle, items: aisleItems }) => {
            if (aisleItems.length === 0 && shoppingMode) return null;
            const isCollapsed = collapsedAisles[aisle.id];
            const accent = AISLE_ACCENTS[aisle.name] || AISLE_ACCENTS['Other'];

            return (
              <div
                key={aisle.id}
                className={`rounded-3xl border transition-all duration-200 overflow-hidden ${
                  aisleItems.length > 0
                    ? `bg-gradient-to-b ${accent.bg} ${accent.border} shadow-lg shadow-black/20`
                    : 'bg-slate-950/40 border-slate-900/60 opacity-60'
                }`}
              >
                {/* Aisle Header */}
                <div
                  onClick={() =>
                    setCollapsedAisles((prev) => ({
                      ...prev,
                      [aisle.id]: !prev[aisle.id],
                    }))
                  }
                  className="flex items-center justify-between p-3.5 sm:px-5 cursor-pointer hover:bg-white/5 transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{aisle.icon}</span>
                    <h2 className={`font-extrabold text-sm tracking-tight ${accent.text}`}>{aisle.name}</h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-black/40 text-[11px] font-bold text-slate-300 border border-white/10 font-mono">
                      {aisleItems.length}
                    </span>
                  </div>
                  <button className="text-slate-400 hover:text-white p-1">
                    {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                </div>

                {/* Items in Aisle */}
                {!isCollapsed && (
                  <div className="p-3 sm:p-4 pt-0 space-y-2">
                    {aisleItems.length === 0 ? (
                      <div className="text-xs text-slate-500 italic py-2 px-3">No items in this aisle</div>
                    ) : (
                      aisleItems.map((item) => (
                        <div
                          key={item.id}
                          className={`anylist-item flex items-center justify-between p-3 rounded-2xl transition-all ${
                            item.checked
                              ? 'opacity-50 bg-slate-950/60 border-slate-900'
                              : 'hover:scale-[1.005]'
                          }`}
                        >
                          <div
                            onClick={() => toggleItemChecked(item)}
                            className="flex items-center gap-3.5 flex-1 cursor-pointer select-none"
                          >
                            <div
                              className={`w-6 h-6 rounded-xl border flex items-center justify-center transition-all ${
                                item.checked
                                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm shadow-emerald-600/50'
                                  : 'border-slate-600 hover:border-emerald-400 bg-slate-950'
                              }`}
                            >
                              {item.checked && <Check className="w-4 h-4 stroke-[3]" />}
                            </div>
                            <div className="flex flex-col">
                              <span
                                className={`text-sm font-semibold tracking-tight transition-all ${
                                  item.checked ? 'line-through text-slate-500' : 'text-slate-100'
                                }`}
                              >
                                {item.name}
                              </span>
                              {item.note && <span className="text-[11px] text-slate-400">{item.note}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5">
                            {item.quantity && (
                              <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-950/80 text-slate-200 border border-white/5 font-mono">
                                {item.quantity} {item.unit || ''}
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1.5 rounded-xl text-slate-600 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                              title="Delete item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned Items */}
          {unassignedItems.length > 0 && (
            <div className="anylist-card rounded-3xl border border-slate-800 p-4 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-300">
                <span>📦</span>
                <span>Other Items</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[11px] font-mono">{unassignedItems.length}</span>
              </div>
              {unassignedItems.map((item) => (
                <div
                  key={item.id}
                  className={`anylist-item flex items-center justify-between p-3 rounded-2xl ${
                    item.checked ? 'opacity-50' : ''
                  }`}
                >
                  <div onClick={() => toggleItemChecked(item)} className="flex items-center gap-3.5 cursor-pointer flex-1 select-none">
                    <div
                      className={`w-6 h-6 rounded-xl border flex items-center justify-center ${
                        item.checked ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-600 bg-slate-950'
                      }`}
                    >
                      {item.checked && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>
                    <span className={`text-sm font-semibold ${item.checked ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                      {item.name}
                    </span>
                  </div>
                  <button onClick={() => handleDeleteItem(item.id)} className="text-slate-600 hover:text-rose-400 p-1.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Custom Checklist View */
        <div className="anylist-card p-4 sm:p-5 rounded-3xl border border-slate-800 space-y-2">
          {displayedItems.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No checklist items yet. Add items above or ask the Gemini Assistant!
            </div>
          ) : (
            displayedItems.map((item) => (
              <div
                key={item.id}
                className={`anylist-item flex items-center justify-between p-3.5 rounded-2xl transition-all ${
                  item.checked ? 'opacity-50' : ''
                }`}
              >
                <div onClick={() => toggleItemChecked(item)} className="flex items-center gap-3.5 cursor-pointer flex-1 select-none">
                  <div
                    className={`w-6 h-6 rounded-xl border flex items-center justify-center ${
                      item.checked ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-600 bg-slate-950'
                    }`}
                  >
                    {item.checked && <Check className="w-4 h-4 stroke-[3]" />}
                  </div>
                  <span className={`text-sm font-semibold ${item.checked ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {item.quantity && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-950/80 text-slate-200 border border-white/5 font-mono">
                      {item.quantity}
                    </span>
                  )}
                  <button onClick={() => handleDeleteItem(item.id)} className="text-slate-600 hover:text-rose-400 p-1.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Rearrangeable Aisles Modal */}
      {showAisleModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
                  <ArrowUpDown className="w-5 h-5 text-emerald-400" />
                  Store Aisle Order
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Reorder aisles to match your favorite grocery store floor plan.
                </p>
              </div>
              <button
                onClick={() => setShowAisleModal(false)}
                className="p-1.5 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Aisle List with Up/Down buttons */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {aisles.map((aisle, idx) => (
                <div
                  key={aisle.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-slate-500 w-6 text-center">
                      #{idx + 1}
                    </span>
                    <span className="text-xl">{aisle.icon}</span>
                    <span className="font-bold text-sm text-slate-200">{aisle.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => moveAisle(idx, 'up')}
                      disabled={idx === 0}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-emerald-400 transition-colors"
                      title="Move up"
                    >
                      <MoveUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveAisle(idx, 'down')}
                      disabled={idx === aisles.length - 1}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-emerald-400 transition-colors"
                      title="Move down"
                    >
                      <MoveDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Custom Aisle Form */}
            <form onSubmit={handleAddCustomAisle} className="p-4 border-t border-slate-800 bg-slate-950/80">
              <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Add Custom Aisle</div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newAisleIcon}
                  onChange={(e) => setNewAisleIcon(e.target.value)}
                  className="w-12 text-center bg-slate-900 border border-slate-800 rounded-2xl py-2.5 text-base"
                  title="Emoji icon"
                />
                <input
                  type="text"
                  value={newAisleName}
                  onChange={(e) => setNewAisleName(e.target.value)}
                  placeholder="e.g. International Foods, Wine & Beer..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-white"
                />
                <button
                  type="submit"
                  disabled={!newAisleName.trim()}
                  className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-emerald-600/30"
                >
                  Add Aisle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Custom List Modal */}
      {showNewListModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-emerald-400" />
                Create Custom Checklist
              </h3>
              <button
                onClick={() => setShowNewListModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomList} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">List Name</label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g. Summer Camping Packing List"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Emoji Icon</label>
                  <input
                    type="text"
                    value={newListIcon}
                    onChange={(e) => setNewListIcon(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-center text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">List Type</label>
                  <select
                    value={newListType}
                    onChange={(e) => setNewListType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2.5 text-xs text-white"
                  >
                    <option value="packing">Packing Checklist</option>
                    <option value="todo">To-Do List</option>
                    <option value="chores">Chores</option>
                    <option value="supplies">Supplies</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewListModal(false)}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newListName.trim()}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-emerald-600/30"
                >
                  Create List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
