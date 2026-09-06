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
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  PlusCircle,
  Tag,
  CheckCheck,
  FolderPlus,
  MoveUp,
  MoveDown
} from 'lucide-react';

export default function GroceryPage() {
  const { activeMember } = usePWA();
  const [items, setItems] = useState<GroceryItemData[]>([]);
  const [customLists, setCustomLists] = useState<CustomListData[]>([]);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null); // null = Main Grocery List
  const [isLoading, setIsLoading] = useState(true);

  // Quick Add input states
  const [newItemName, setNewItemName] = useState('');
  const [selectedAisleId, setSelectedAisleId] = useState<string>('');
  const [newItemQty, setNewItemQty] = useState('1');

  // View state toggles
  const [shoppingMode, setShoppingMode] = useState(false); // Hide checked
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

      // Refetch
      await fetchGroceryData();
      setShowNewListModal(false);
      setNewListName('');
    } catch (err) {
      console.error('Failed to create custom list:', err);
    }
  };

  // Group items by Aisle
  const isMainGrocery = activeListId === null;
  const activeCustomList = customLists.find((l) => l.id === activeListId);

  const displayedItems = shoppingMode ? items.filter((i) => !i.checked) : items;

  const groupedByAisle: { aisle: Aisle; items: GroceryItemData[] }[] = aisles.map((aisle) => ({
    aisle,
    items: displayedItems.filter(
      (item) => item.aisleId === aisle.id || (!item.aisleId && item.category === aisle.name)
    ),
  }));

  // Catch any items without an aisle
  const unassignedItems = displayedItems.filter(
    (item) => !aisles.some((a) => a.id === item.aisleId || item.category === a.name)
  );

  const totalItemCount = items.length;
  const completedCount = items.filter((i) => i.checked).length;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 w-full space-y-6">
      {/* Header & List Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <ShoppingCart className="w-7 h-7 text-emerald-400" />
            {isMainGrocery ? 'Family Grocery List' : activeCustomList?.name || 'Custom List'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {completedCount} of {totalItemCount} items completed • Categorized by aisle
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Shopping Mode Toggle */}
          <button
            onClick={() => setShoppingMode(!shoppingMode)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors border ${
              shoppingMode
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
            >
              <ArrowUpDown className="w-4 h-4 text-emerald-400" />
              <span>Aisle Order</span>
            </button>
          )}

          {/* Clear Completed */}
          {completedCount > 0 && (
            <button
              onClick={handleClearChecked}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-rose-900/40 text-xs font-semibold text-rose-400 hover:bg-rose-950/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Done ({completedCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* List Tabs (Main Grocery vs Custom Checklists) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-slate-800">
        <button
          onClick={() => setActiveListId(null)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeListId === null
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <span>🛒</span>
          <span>Main Grocery</span>
          {activeListId === null && <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">{totalItemCount}</span>}
        </button>

        {customLists.map((list) => (
          <button
            key={list.id}
            onClick={() => setActiveListId(list.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeListId === list.id
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>{list.icon}</span>
            <span>{list.name}</span>
          </button>
        ))}

        <button
          onClick={() => setShowNewListModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-dashed border-slate-700 text-xs font-medium text-slate-400 hover:text-slate-200 shrink-0 transition-colors"
        >
          <FolderPlus className="w-4 h-4 text-emerald-400" />
          <span>+ New List</span>
        </button>
      </div>

      {/* Quick Add Bar */}
      <form onSubmit={handleAddItem} className="glass-panel p-3 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder={isMainGrocery ? "Add item (e.g. Greek yogurt, sourdough bread, avocado)..." : "Add checklist item..."}
            className="flex-1 w-full bg-slate-900 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 border border-slate-800"
          />

          {isMainGrocery && (
            <select
              value={selectedAisleId}
              onChange={(e) => setSelectedAisleId(e.target.value)}
              className="w-full sm:w-auto bg-slate-900 text-slate-200 text-xs rounded-xl px-3 py-2.5 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
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
              className="w-16 bg-slate-900 text-center text-slate-200 text-xs rounded-xl px-2 py-2.5 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            <button
              type="submit"
              disabled={!newItemName.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>
        </div>
      </form>

      {/* Grocery Aisles Matrix */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 text-sm animate-pulse">
          Loading family grocery list...
        </div>
      ) : isMainGrocery ? (
        <div className="space-y-4">
          {groupedByAisle.map(({ aisle, items: aisleItems }) => {
            if (aisleItems.length === 0 && shoppingMode) return null;
            const isCollapsed = collapsedAisles[aisle.id];

            return (
              <div
                key={aisle.id}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  aisleItems.length > 0
                    ? 'glass-panel border-slate-800'
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
                  className="flex items-center justify-between p-3 sm:px-4 cursor-pointer hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{aisle.icon}</span>
                    <h2 className="font-bold text-sm text-slate-200 tracking-tight">{aisle.name}</h2>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[11px] font-semibold text-slate-400">
                      {aisleItems.length}
                    </span>
                  </div>
                  <button className="text-slate-500 hover:text-slate-300">
                    {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                </div>

                {/* Items in Aisle */}
                {!isCollapsed && (
                  <div className="p-2 sm:p-3 pt-0 space-y-1.5">
                    {aisleItems.length === 0 ? (
                      <div className="text-xs text-slate-600 italic py-1 px-3">No items in this aisle</div>
                    ) : (
                      aisleItems.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                            item.checked
                              ? 'bg-slate-950/60 border-slate-900 text-slate-500'
                              : 'bg-slate-900/80 border-slate-800/80 text-slate-200 hover:border-slate-700'
                          }`}
                        >
                          <div
                            onClick={() => toggleItemChecked(item)}
                            className="flex items-center gap-3 flex-1 cursor-pointer select-none"
                          >
                            <div
                              className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                                item.checked
                                  ? 'bg-emerald-600 border-emerald-500 text-white'
                                  : 'border-slate-600 hover:border-emerald-400 bg-slate-950'
                              }`}
                            >
                              {item.checked && <Check className="w-3.5 h-3.5" />}
                            </div>
                            <div className="flex flex-col">
                              <span
                                className={`text-sm font-medium ${
                                  item.checked ? 'line-through text-slate-500' : 'text-slate-100'
                                }`}
                              >
                                {item.name}
                              </span>
                              {item.note && <span className="text-[11px] text-slate-400">{item.note}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {item.quantity && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                                {item.quantity} {item.unit || ''}
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
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

          {/* Unassigned Items Section */}
          {unassignedItems.length > 0 && (
            <div className="glass-panel rounded-2xl border border-slate-800 p-3 sm:p-4 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-300">
                <span>📦</span>
                <span>Other Items</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[11px]">{unassignedItems.length}</span>
              </div>
              {unassignedItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border ${
                    item.checked ? 'bg-slate-950/60 border-slate-900 text-slate-500' : 'bg-slate-900/80 border-slate-800 text-slate-200'
                  }`}
                >
                  <div onClick={() => toggleItemChecked(item)} className="flex items-center gap-3 cursor-pointer flex-1">
                    <div
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center ${
                        item.checked ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-600 bg-slate-950'
                      }`}
                    >
                      {item.checked && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <span className={`text-sm ${item.checked ? 'line-through text-slate-500' : ''}`}>{item.name}</span>
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
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-2">
          {displayedItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No checklist items yet. Add items above or ask the Gemini Assistant!
            </div>
          ) : (
            displayedItems.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  item.checked ? 'bg-slate-950/60 border-slate-900 text-slate-500' : 'bg-slate-900/80 border-slate-800 text-slate-200'
                }`}
              >
                <div onClick={() => toggleItemChecked(item)} className="flex items-center gap-3 cursor-pointer flex-1">
                  <div
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center ${
                      item.checked ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-600 bg-slate-950'
                    }`}
                  >
                    {item.checked && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <span className={`text-sm font-medium ${item.checked ? 'line-through text-slate-500' : ''}`}>
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {item.quantity && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <ArrowUpDown className="w-5 h-5 text-emerald-400" />
                  Rearrange Grocery Aisles
                </h3>
                <p className="text-xs text-slate-400">
                  Match your grocery store's layout. Synced for everyone in the family!
                </p>
              </div>
              <button
                onClick={() => setShowAisleModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Aisle List with Up/Down buttons */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {aisles.map((aisle, idx) => (
                <div
                  key={aisle.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-slate-500 w-5 text-center">
                      #{idx + 1}
                    </span>
                    <span className="text-lg">{aisle.icon}</span>
                    <span className="font-semibold text-sm text-slate-200">{aisle.name}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveAisle(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-emerald-400 transition-colors"
                      title="Move aisle up"
                    >
                      <MoveUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveAisle(idx, 'down')}
                      disabled={idx === aisles.length - 1}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-emerald-400 transition-colors"
                      title="Move aisle down"
                    >
                      <MoveDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Custom Aisle Form */}
            <form onSubmit={handleAddCustomAisle} className="p-4 border-t border-slate-800 bg-slate-950/50">
              <div className="text-xs font-semibold text-slate-400 mb-2">Add Custom Aisle</div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newAisleIcon}
                  onChange={(e) => setNewAisleIcon(e.target.value)}
                  className="w-12 text-center bg-slate-900 border border-slate-800 rounded-xl py-2 text-base"
                  title="Emoji icon"
                />
                <input
                  type="text"
                  value={newAisleName}
                  onChange={(e) => setNewAisleName(e.target.value)}
                  placeholder="e.g. International Foods, Wine & Beer..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  disabled={!newAisleName.trim()}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Custom List Modal */}
      {showNewListModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-emerald-400" />
                Create New Custom List
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
                <label className="text-xs font-semibold text-slate-400 block mb-1">List Name</label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g. Summer Road Trip Packing List"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Icon (Emoji)</label>
                  <input
                    type="text"
                    value={newListIcon}
                    onChange={(e) => setNewListIcon(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-center text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Type</label>
                  <select
                    value={newListType}
                    onChange={(e) => setNewListType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
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
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newListName.trim()}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-emerald-600/30"
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
