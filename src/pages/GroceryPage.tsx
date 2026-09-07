import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Check,
  Trash2,
  MoveVertical,
  ShoppingBag,
  ListPlus,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  ListChecks,
} from 'lucide-react';
import type { GroceryItem, Aisle, CustomList } from '../types';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';
import { AisleManagerModal } from '../components/AisleManagerModal';

export const GroceryPage: React.FC = () => {
  const { household, currentUser, aisles, refreshAisles } = usePWA();
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [customLists, setCustomLists] = useState<CustomList[]>([]);
  const [activeListType, setActiveListType] = useState<string>('grocery');
  const [newItemName, setNewItemName] = useState('');
  const [selectedAisleId, setSelectedAisleId] = useState<string>('');
  const [isShoppingMode, setIsShoppingMode] = useState(false);
  const [isAisleModalOpen, setIsAisleModalOpen] = useState(false);
  const [isNewListModalOpen, setIsNewListModalOpen] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [isListDropdownOpen, setIsListDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [collapsedAisles, setCollapsedAisles] = useState<Record<string, boolean>>({});

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsListDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    if (!household) return;
    setIsLoading(true);
    try {
      const [itemsData, listsData] = await Promise.all([
        api.getGroceryItems(household.id, activeListType),
        api.getCustomLists(household.id),
      ]);
      setItems(itemsData);
      setCustomLists(listsData);
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [household, activeListType]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !household) return;

    try {
      const item = await api.addGroceryItem(household.id, {
        name: newItemName.trim(),
        aisle_id: selectedAisleId || undefined,
        list_type: activeListType,
        added_by_user_id: currentUser?.id,
        added_by_user_name: currentUser?.name,
      });
      setItems((prev) => [...prev, item]);
      setNewItemName('');
    } catch (err) {
      console.error('Failed to add item:', err);
    }
  };

  const handleToggleItem = async (id: string) => {
    try {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, is_completed: !it.is_completed } : it))
      );
      await api.toggleGroceryItem(id);
    } catch (err) {
      console.error('Failed to toggle item:', err);
      loadData();
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      setItems((prev) => prev.filter((it) => it.id !== id));
      await api.deleteGroceryItem(id);
    } catch (err) {
      console.error('Failed to delete item:', err);
      loadData();
    }
  };

  const handleClearCompleted = async () => {
    if (!household) return;
    try {
      setItems((prev) => prev.filter((it) => !it.is_completed));
      await api.clearCompletedGroceryItems(household.id, activeListType);
    } catch (err) {
      console.error('Failed to clear completed:', err);
      loadData();
    }
  };

  const handleCreateCustomList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim() || !household) return;

    try {
      const created = await api.createCustomList(household.id, newListTitle.trim());
      setCustomLists((prev) => [...prev, created]);
      setActiveListType(created.id);
      setNewListTitle('');
      setIsNewListModalOpen(false);
      setIsListDropdownOpen(false);
    } catch (err) {
      console.error('Failed to create custom list:', err);
    }
  };

  const handleDeleteCustomList = async (listId: string, listTitle: string) => {
    if (confirm(`Are you sure you want to delete the list "${listTitle}"?`)) {
      try {
        await api.deleteCustomList(listId);
        setCustomLists((prev) => prev.filter((l) => l.id !== listId));
        if (activeListType === listId) {
          setActiveListType('grocery');
        }
      } catch (err) {
        console.error('Failed to delete list:', err);
      }
    }
  };

  const toggleAisleCollapse = (aisleId: string) => {
    setCollapsedAisles((prev) => ({
      ...prev,
      [aisleId]: !prev[aisleId],
    }));
  };

  // Group items by aisle
  const activeItems = items.filter((it) => !it.is_completed);
  const completedItems = items.filter((it) => it.is_completed);

  // Sort aisles by display_order
  const sortedAisles = [...aisles].sort((a, b) => a.display_order - b.display_order);

  const itemsByAisle: { aisle: Aisle; items: GroceryItem[] }[] = [];
  const uncategorizedItems: GroceryItem[] = [];

  const isGroceryList = activeListType === 'grocery';

  if (isGroceryList) {
    sortedAisles.forEach((aisle) => {
      const aisleItems = activeItems.filter((it) => it.aisle_id === aisle.id);
      if (aisleItems.length > 0) {
        itemsByAisle.push({ aisle, items: aisleItems });
      }
    });

    activeItems.forEach((it) => {
      const hasAisle = aisles.some((a) => a.id === it.aisle_id);
      if (!hasAisle) {
        uncategorizedItems.push(it);
      }
    });
  }

  const currentList = customLists.find((l) => l.id === activeListType);
  const currentListName = isGroceryList ? 'Grocery List' : currentList?.title || 'Checklist';
  const currentListIcon = isGroceryList ? '🛒' : currentList?.icon || '📋';

  return (
    <div className="max-w-4xl mx-auto p-2 sm:p-4 pb-24 md:pb-12 space-y-4">
      {/* Header with List Dropdown Selector & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-3xl glass-panel border border-white/10">
        
        {/* List Dropdown Selector */}
        <div className="relative w-full sm:w-auto" ref={dropdownRef}>
          <button
            onClick={() => setIsListDropdownOpen(!isListDropdownOpen)}
            className="flex items-center justify-between sm:justify-start gap-3 bg-slate-900/80 hover:bg-slate-850 border border-white/10 hover:border-emerald-500/40 px-4 py-2.5 rounded-2xl transition-all w-full sm:w-auto group shadow-md"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">{currentListIcon}</span>
              <div className="text-left">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Active List
                </div>
                <div className="text-base font-black text-white group-hover:text-emerald-400 transition-colors">
                  {currentListName}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs bg-emerald-500/15 text-emerald-400 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                {activeItems.length}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 group-hover:text-white transition-transform duration-200 ${
                  isListDropdownOpen ? 'rotate-180 text-emerald-400' : ''
                }`}
              />
            </div>
          </button>

          {/* Dropdown Menu */}
          {isListDropdownOpen && (
            <div className="absolute left-0 top-full mt-2 w-full sm:w-72 glass-panel rounded-2xl p-2 shadow-2xl z-50 border border-white/10 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/5">
                Switch Household List
              </div>

              <div className="py-1.5 space-y-1 max-h-60 overflow-y-auto">
                {/* Default Grocery List Option */}
                <button
                  onClick={() => {
                    setActiveListType('grocery');
                    setIsListDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    activeListType === 'grocery'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'hover:bg-white/5 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">🛒</span>
                    <span>Grocery List</span>
                  </div>
                  {activeListType === 'grocery' && <Check className="w-4 h-4" />}
                </button>

                {/* Custom Lists */}
                {customLists.map((cl) => {
                  const isSelected = activeListType === cl.id;
                  return (
                    <div
                      key={cl.id}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors group/item ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'hover:bg-white/5 text-slate-200'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setActiveListType(cl.id);
                          setIsListDropdownOpen(false);
                        }}
                        className="flex items-center gap-2.5 flex-1 text-left"
                      >
                        <span className="text-base">{cl.icon || '📋'}</span>
                        <span className="truncate">{cl.title}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {isSelected && <Check className="w-3.5 h-3.5 mr-1" />}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomList(cl.id, cl.title);
                          }}
                          title="Delete List"
                          className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover/item:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Create New List Button */}
              <div className="pt-2 border-t border-white/5">
                <button
                  onClick={() => {
                    setIsNewListModalOpen(true);
                    setIsListDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/30 transition-all"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  Create New List
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons (Shopping Mode & Rearrange Aisles for Grocery List) */}
        <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-end">
          {/* Shopping Mode Button */}
          <button
            onClick={() => setIsShoppingMode(!isShoppingMode)}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              isShoppingMode
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 ring-2 ring-amber-400'
                : 'bg-slate-800/90 hover:bg-slate-750 text-slate-300 border border-white/10'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            {isShoppingMode ? 'Shopping Mode (ON)' : 'Shop Mode'}
          </button>

          {/* Rearrange Aisles Button (only shown for Grocery list) */}
          {isGroceryList && (
            <button
              onClick={() => setIsAisleModalOpen(true)}
              className="px-3.5 py-2 rounded-2xl text-xs font-semibold bg-slate-800/90 hover:bg-slate-750 text-slate-300 border border-white/10 flex items-center gap-1.5 transition-colors"
            >
              <MoveVertical className="w-3.5 h-3.5 text-amber-400" />
              Aisles
            </button>
          )}
        </div>
      </div>

      {/* Quick Add Input Form */}
      <form onSubmit={handleAddItem} className="glass-panel p-2.5 rounded-3xl border border-white/10 shadow-lg">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={`Add item to ${currentListName}...`}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="flex-1 bg-transparent border-none text-sm text-white placeholder-slate-500 focus:outline-none px-3 py-2"
          />

          {/* Optional Aisle selector dropdown for Grocery list */}
          {isGroceryList && (
            <select
              value={selectedAisleId}
              onChange={(e) => setSelectedAisleId(e.target.value)}
              className="bg-slate-900 border border-white/10 text-xs text-slate-300 rounded-xl px-2.5 py-2 focus:outline-none focus:border-emerald-500 max-w-[130px]"
            >
              <option value="">Auto Aisle</option>
              {sortedAisles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="submit"
            disabled={!newItemName.trim()}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold px-4 py-2 rounded-2xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </form>

      {/* Items Section */}
      <div className="space-y-4">
        {isLoading && (
          <div className="py-12 text-center text-xs text-slate-400">Loading {currentListName}...</div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="py-16 text-center glass-panel rounded-3xl p-8 border border-white/5 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
              <ListChecks className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">{currentListName} is empty</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Add items using the bar above or speak to your Gemini voice assistant!
            </p>
          </div>
        )}

        {/* If Grocery List: Display Grouped by Store Aisles */}
        {isGroceryList &&
          itemsByAisle.map(({ aisle, items: aisleItems }) => {
            const isCollapsed = collapsedAisles[aisle.id];
            return (
              <div
                key={aisle.id}
                className="glass-panel rounded-3xl border border-white/10 overflow-hidden shadow-sm"
              >
                {/* Aisle Category Header */}
                <button
                  onClick={() => toggleAisleCollapse(aisle.id)}
                  className="w-full flex items-center justify-between p-3.5 bg-slate-900/40 hover:bg-slate-900/60 border-b border-white/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3.5 h-3.5 rounded-full shadow-sm"
                      style={{ backgroundColor: aisle.color || '#10b981' }}
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      {aisle.name}
                    </span>
                    <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded-full text-slate-400">
                      {aisleItems.length}
                    </span>
                  </div>
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {/* Items in this Aisle */}
                {!isCollapsed && (
                  <div className="divide-y divide-white/5">
                    {aisleItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleToggleItem(item.id)}
                        className={`flex items-center justify-between p-3.5 transition-colors cursor-pointer group ${
                          isShoppingMode
                            ? 'hover:bg-amber-500/10 active:bg-amber-500/20 py-4'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                              isShoppingMode
                                ? 'w-7 h-7 border-amber-500/40 bg-slate-900'
                                : 'border-white/20 bg-slate-900/80 group-hover:border-emerald-500'
                            }`}
                          >
                            {item.is_completed && (
                              <Check className="w-4 h-4 text-emerald-400 font-bold" />
                            )}
                          </div>
                          <div>
                            <span
                              className={`text-sm font-semibold text-slate-100 ${
                                isShoppingMode ? 'text-base' : ''
                              }`}
                            >
                              {item.name}
                            </span>
                            {item.quantity && (
                              <span className="ml-2 text-xs font-mono text-slate-400">
                                ({item.quantity} {item.unit || ''})
                              </span>
                            )}
                            {item.notes && (
                              <p className="text-[11px] text-slate-500">{item.notes}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {item.added_by_user_name && (
                            <span className="text-[10px] text-slate-500 hidden sm:inline">
                              {item.added_by_user_name}
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(item.id);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

        {/* Uncategorized Items (if Grocery list) */}
        {isGroceryList && uncategorizedItems.length > 0 && (
          <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2.5 p-3.5 bg-slate-900/40 border-b border-white/5">
              <div className="w-3.5 h-3.5 rounded-full bg-slate-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Other / Uncategorized
              </span>
              <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded-full text-slate-400">
                {uncategorizedItems.length}
              </span>
            </div>
            <div className="divide-y divide-white/5">
              {uncategorizedItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleItem(item.id)}
                  className="flex items-center justify-between p-3.5 hover:bg-white/5 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-6 h-6 rounded-lg border border-white/20 bg-slate-900/80 flex items-center justify-center">
                      {item.is_completed && <Check className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <span className="text-sm font-semibold text-slate-100">{item.name}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(item.id);
                    }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Non-Grocery Custom List: Display as Simple Flat Checklist */}
        {!isGroceryList && activeItems.length > 0 && (
          <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden shadow-sm divide-y divide-white/5">
            {activeItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleToggleItem(item.id)}
                className="flex items-center justify-between p-3.5 hover:bg-white/5 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-6 h-6 rounded-lg border border-white/20 bg-slate-900/80 flex items-center justify-center group-hover:border-emerald-500">
                    {item.is_completed && <Check className="w-4 h-4 text-emerald-400 font-bold" />}
                  </div>
                  <span className="text-sm font-semibold text-slate-100">{item.name}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteItem(item.id);
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Completed / Crossed-Off Section */}
        {completedItems.length > 0 && (
          <div className="glass-panel-subtle rounded-3xl border border-white/5 p-4 mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Crossed Off ({completedItems.length})
              </div>
              <button
                onClick={handleClearCompleted}
                className="text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1 rounded-xl transition-colors"
              >
                Clear Crossed Off
              </button>
            </div>

            <div className="space-y-1.5">
              {completedItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleItem(item.id)}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-900/30 hover:bg-slate-900/60 transition-colors cursor-pointer group opacity-60 hover:opacity-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 font-bold" />
                    </div>
                    <span className="text-sm line-through text-slate-400 font-medium">
                      {item.name}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(item.id);
                    }}
                    className="p-1 text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Aisle Reordering Modal */}
      {household && (
        <AisleManagerModal
          isOpen={isAisleModalOpen}
          onClose={() => setIsAisleModalOpen(false)}
          householdId={household.id}
          onAislesUpdated={() => {
            refreshAisles();
            loadData();
          }}
        />
      )}

      {/* New Custom List Modal */}
      {isNewListModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-white/10 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ListPlus className="w-5 h-5 text-emerald-400" />
              Create Custom List
            </h3>
            <form onSubmit={handleCreateCustomList} className="space-y-3">
              <input
                type="text"
                required
                placeholder="e.g. Costco, Home Depot, Packing List..."
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewListModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newListTitle.trim()}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-lg shadow-emerald-500/20"
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
};
