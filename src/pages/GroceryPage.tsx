import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Check,
  Trash2,
  ListPlus,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  ListChecks,
  X,
} from 'lucide-react';
import type { GroceryItem, Aisle, CustomList } from '../types';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';
import { useFabAutoClose } from '../hooks/useFabAutoClose';

interface GroceryDataCache {
  householdId: string;
  itemsByList: Record<string, GroceryItem[]>;
  lists: CustomList[];
  aisles: Aisle[];
}

let groceryDataCache: GroceryDataCache | null = null;

export const GroceryPage: React.FC = () => {
  const { household, currentUser, aisles } = usePWA();
  const householdId = household?.id;
  const isMountedRef = useRef(true);

  const [activeListType, setActiveListType] = useState<string>('grocery');
  const activeListTypeRef = useRef(activeListType);
  useEffect(() => {
    activeListTypeRef.current = activeListType;
  }, [activeListType]);

  const [items, setItems] = useState<GroceryItem[]>(() => {
    return groceryDataCache?.itemsByList['grocery'] || [];
  });
  const [customLists, setCustomLists] = useState<CustomList[]>(() => {
    return groceryDataCache ? groceryDataCache.lists : [];
  });
  const [localAisles, setLocalAisles] = useState<Aisle[]>(() => {
    return groceryDataCache && groceryDataCache.aisles.length > 0 ? groceryDataCache.aisles : aisles;
  });
  const [newItemName, setNewItemName] = useState('');
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [isNewListModalOpen, setIsNewListModalOpen] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [isListDropdownOpen, setIsListDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return !(groceryDataCache && groceryDataCache.itemsByList['grocery'] !== undefined);
  });
  const [collapsedAisles, setCollapsedAisles] = useState<Record<string, boolean>>({});

  const dockRef = useFabAutoClose<HTMLDivElement>({
    isOpen: isInputExpanded,
    onClose: () => setIsInputExpanded(false),
    ignore: isNewListModalOpen,
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (aisles.length > 0) {
      setLocalAisles(aisles);
    }
  }, [aisles]);

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

  const handleSelectList = (targetListId: string) => {
    setIsListDropdownOpen(false);
    if (targetListId === activeListType) return;

    setActiveListType(targetListId);
    activeListTypeRef.current = targetListId;

    const cachedItems =
      groceryDataCache && groceryDataCache.householdId === householdId
        ? groceryDataCache.itemsByList[targetListId]
        : undefined;

    if (cachedItems !== undefined) {
      setItems(cachedItems);
      setIsLoading(false);
    } else {
      // Clear stale items immediately so the previous list never flashes while loading the new one
      setItems([]);
      setIsLoading(true);
    }
  };

  const loadData = async (targetListId: string, showLoading = false) => {
    if (!householdId) return;
    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const data = await api.getGroceryData(householdId, targetListId);
      if (!isMountedRef.current) return;

      if (!groceryDataCache || groceryDataCache.householdId !== householdId) {
        groceryDataCache = {
          householdId,
          itemsByList: {},
          lists: data.lists,
          aisles: data.aisles,
        };
      }
      groceryDataCache.itemsByList[targetListId] = data.items;
      groceryDataCache.lists = data.lists;
      if (data.aisles.length > 0) {
        groceryDataCache.aisles = data.aisles;
      }

      if (activeListTypeRef.current === targetListId) {
        setItems(data.items);
      }
      setCustomLists(data.lists);
      if (data.aisles.length > 0) {
        setLocalAisles(data.aisles);
      }
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      if (isMountedRef.current && activeListTypeRef.current === targetListId) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!householdId) return;
    const hasCache =
      groceryDataCache &&
      groceryDataCache.householdId === householdId &&
      groceryDataCache.itemsByList[activeListType] !== undefined;
    loadData(activeListType, !hasCache);
  }, [householdId, activeListType]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !household) return;

    try {
      const item = await api.addGroceryItem(household.id, {
        name: newItemName.trim(),
        list_type: activeListType,
        added_by_user_id: currentUser?.id,
        added_by_user_name: currentUser?.name,
      });
      setItems((prev) => {
        const next = [...prev, item];
        if (groceryDataCache && groceryDataCache.householdId === household.id) {
          groceryDataCache.itemsByList[activeListType] = next;
        }
        return next;
      });
      setNewItemName('');
    } catch (err) {
      console.error('Failed to add item:', err);
    }
  };

  const handleToggleItem = async (id: string) => {
    try {
      setItems((prev) => {
        const next = prev.map((it) => (it.id === id ? { ...it, is_completed: !it.is_completed } : it));
        if (groceryDataCache && householdId && groceryDataCache.householdId === householdId) {
          groceryDataCache.itemsByList[activeListType] = next;
        }
        return next;
      });
      await api.toggleGroceryItem(id);
    } catch (err) {
      console.error('Failed to toggle item:', err);
      loadData(activeListType, false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      setItems((prev) => {
        const next = prev.filter((it) => it.id !== id);
        if (groceryDataCache && householdId && groceryDataCache.householdId === householdId) {
          groceryDataCache.itemsByList[activeListType] = next;
        }
        return next;
      });
      await api.deleteGroceryItem(id);
    } catch (err) {
      console.error('Failed to delete item:', err);
      loadData(activeListType, false);
    }
  };

  const handleClearCompleted = async () => {
    if (!household) return;
    try {
      setItems((prev) => {
        const next = prev.filter((it) => !it.is_completed);
        if (groceryDataCache && groceryDataCache.householdId === household.id) {
          groceryDataCache.itemsByList[activeListType] = next;
        }
        return next;
      });
      await api.clearCompletedGroceryItems(household.id, activeListType);
    } catch (err) {
      console.error('Failed to clear completed:', err);
      loadData(activeListType, false);
    }
  };

  const handleCreateCustomList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim() || !household) return;

    try {
      const created = await api.createCustomList(household.id, newListTitle.trim());
      setCustomLists((prev) => {
        const next = [...prev, created];
        if (groceryDataCache && groceryDataCache.householdId === household.id) {
          groceryDataCache.lists = next;
        }
        return next;
      });
      if (groceryDataCache && groceryDataCache.householdId === household.id) {
        groceryDataCache.itemsByList[created.id] = [];
      }
      setItems([]);
      setIsLoading(false);
      setActiveListType(created.id);
      activeListTypeRef.current = created.id;
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
        if (groceryDataCache) {
          delete groceryDataCache.itemsByList[listId];
          groceryDataCache.lists = groceryDataCache.lists.filter((l) => l.id !== listId);
        }
        setCustomLists((prev) => prev.filter((l) => l.id !== listId));
        if (activeListType === listId) {
          handleSelectList('grocery');
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
  const effectiveAisles = localAisles.length > 0 ? localAisles : aisles;
  const sortedAisles = [...effectiveAisles].sort((a, b) => a.display_order - b.display_order);

  const itemsByAisle: { aisle: Aisle; items: GroceryItem[] }[] = [];
  const uncategorizedItems: GroceryItem[] = [];

  const isGroceryList = activeListType === 'grocery';

  if (isGroceryList) {
    const placedItemIds = new Set<string>();

    sortedAisles.forEach((aisle) => {
      const aisleItems = activeItems.filter(
        (it) =>
          !placedItemIds.has(it.id) &&
          (it.aisle_id === aisle.id || it.category?.toLowerCase() === aisle.name.toLowerCase())
      );
      aisleItems.forEach((it) => placedItemIds.add(it.id));
      if (aisleItems.length > 0) {
        itemsByAisle.push({ aisle, items: aisleItems });
      }
    });

    activeItems.forEach((it) => {
      if (!placedItemIds.has(it.id)) {
        uncategorizedItems.push(it);
      }
    });
  }

  const currentList = customLists.find((l) => l.id === activeListType);
  const currentListName = isGroceryList ? 'Grocery List' : currentList?.title || 'Checklist';
  const currentListIcon = isGroceryList ? '🛒' : currentList?.icon || '📋';

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 pt-3 pb-36 md:pb-28 space-y-4">
      {/* Consistent Mobile-First Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-slate-950">
            <ShoppingCart className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Lists
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
              Groceries & family checklists
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setNewListTitle('');
            setIsNewListModalOpen(true);
          }}
          className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New List</span>
        </button>
      </div>

      {/* Sleek, Full-Width List Header */}
      <div className="relative z-30 w-full" ref={dropdownRef}>
        <div className="relative w-full">
          <button
            type="button"
            onClick={() => setIsListDropdownOpen(!isListDropdownOpen)}
            className="w-full flex items-center justify-between bg-slate-900/90 hover:bg-slate-850 border border-white/15 hover:border-emerald-500/40 px-4 py-2.5 sm:py-3 rounded-2xl transition-all group shadow-md"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl shrink-0">{currentListIcon}</span>
              <span className="text-sm sm:text-base font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                {currentListName}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isLoading && items.length === 0 ? (
                <span className="text-xs bg-slate-800/80 text-slate-400 font-mono px-2.5 py-0.5 rounded-full border border-white/10 font-semibold animate-pulse">
                  loading...
                </span>
              ) : (
                <span className="text-xs bg-emerald-500/15 text-emerald-400 font-mono px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                  {activeItems.length} {activeItems.length === 1 ? 'item' : 'items'}
                </span>
              )}
              <ChevronDown
                className={`w-4 h-4 text-slate-400 group-hover:text-white transition-transform duration-200 ${
                  isListDropdownOpen ? 'rotate-180 text-emerald-400' : ''
                }`}
              />
            </div>
          </button>

          {/* Dropdown Menu */}
          {isListDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 w-full max-w-md bg-slate-900/95 backdrop-blur-xl rounded-2xl p-2 shadow-2xl z-50 border border-white/15 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/5">
                Switch Household List
              </div>

              <div className="py-1.5 space-y-1 max-h-60 overflow-y-auto">
                {/* Default Grocery List Option */}
                <button
                  onClick={() => handleSelectList('grocery')}
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
                        onClick={() => handleSelectList(cl.id)}
                        className="flex items-center gap-2.5 flex-1 text-left"
                      >
                        <span className="text-base">{cl.icon || '📋'}</span>
                        <span className="truncate">{cl.title}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" />}
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
      </div>

      {/* Items Section */}
      <div className="space-y-4">
        {isLoading && items.length === 0 ? (
          <div className="py-16 text-center glass-panel rounded-3xl p-8 border border-white/5 space-y-3 animate-in fade-in duration-150">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin mx-auto" />
            <div className="text-xs text-slate-400 font-medium">Loading {currentListName}...</div>
          </div>
        ) : !isLoading && items.length === 0 ? (
          <div className="py-16 text-center glass-panel rounded-3xl p-8 border border-white/5 space-y-3 animate-in fade-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
              <ListChecks className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">{currentListName} is empty</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Add items using the bar above or speak to your Gemini voice assistant!
            </p>
          </div>
        ) : null}

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
                        className="flex items-center justify-between px-3.5 py-2 transition-colors cursor-pointer group hover:bg-white/5 gap-2 min-h-[42px]"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-5 h-5 rounded-md border border-white/20 bg-slate-900/80 flex items-center justify-center shrink-0 transition-all group-hover:border-emerald-500">
                            {item.is_completed && (
                              <Check className="w-3.5 h-3.5 text-emerald-400 font-bold" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-100 truncate">
                                {item.name}
                              </span>
                              {item.quantity && (
                                <span className="text-xs font-mono text-slate-400 shrink-0">
                                  ({item.quantity}{item.unit ? ` ${item.unit}` : ''})
                                </span>
                              )}
                            </div>
                            {item.notes && (
                              <p className="text-[11px] text-emerald-400/80 truncate leading-tight mt-0.5">
                                {item.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.added_by_user_name && (
                            <span className="text-[10px] text-slate-500 hidden sm:inline shrink-0">
                              {item.added_by_user_name}
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(item.id);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-40 group-hover:opacity-100 transition-all"
                            title="Delete item"
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
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-900/40 border-b border-white/5">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-600 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
                Other / Uncategorized
              </span>
              <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded-full text-slate-400 shrink-0">
                {uncategorizedItems.length}
              </span>
            </div>
            <div className="divide-y divide-white/5">
              {uncategorizedItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleItem(item.id)}
                  className="flex items-center justify-between px-3.5 py-2 hover:bg-white/5 transition-colors cursor-pointer group gap-2 min-h-[42px]"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-5 h-5 rounded-md border border-white/20 bg-slate-900/80 flex items-center justify-center shrink-0">
                      {item.is_completed && <Check className="w-3.5 h-3.5 text-emerald-400 font-bold" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100 truncate">{item.name}</span>
                        {item.quantity && (
                          <span className="text-xs font-mono text-slate-400 shrink-0">
                            ({item.quantity}{item.unit ? ` ${item.unit}` : ''})
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="text-[11px] text-emerald-400/80 truncate leading-tight mt-0.5">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.added_by_user_name && (
                      <span className="text-[10px] text-slate-500 hidden sm:inline shrink-0">
                        {item.added_by_user_name}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteItem(item.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-40 group-hover:opacity-100 transition-all"
                      title="Delete item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
                className="flex items-center justify-between px-3.5 py-2 hover:bg-white/5 transition-colors cursor-pointer group gap-2 min-h-[42px]"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-5 h-5 rounded-md border border-white/20 bg-slate-900/80 flex items-center justify-center shrink-0 group-hover:border-emerald-500">
                    {item.is_completed && <Check className="w-3.5 h-3.5 text-emerald-400 font-bold" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100 truncate">{item.name}</span>
                      {item.quantity && (
                        <span className="text-xs font-mono text-slate-400 shrink-0">
                          ({item.quantity}{item.unit ? ` ${item.unit}` : ''})
                        </span>
                      )}
                    </div>
                    {item.notes && (
                      <p className="text-[11px] text-emerald-400/80 truncate leading-tight mt-0.5">
                        {item.notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.added_by_user_name && (
                    <span className="text-[10px] text-slate-500 hidden sm:inline shrink-0">
                      {item.added_by_user_name}
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(item.id);
                    }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-40 group-hover:opacity-100 transition-all"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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

            <div className="space-y-1">
              {completedItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleItem(item.id)}
                  className="flex items-center justify-between px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl bg-slate-900/30 hover:bg-slate-900/60 transition-colors cursor-pointer group opacity-60 hover:opacity-100 gap-2 min-h-[38px]"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 font-bold" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm line-through text-slate-400 font-medium truncate">
                          {item.name}
                        </span>
                        {item.quantity && (
                          <span className="text-xs font-mono text-slate-500 shrink-0 line-through">
                            ({item.quantity}{item.unit ? ` ${item.unit}` : ''})
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="text-[11px] text-slate-500 line-through truncate leading-tight mt-0.5">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(item.id);
                    }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-40 group-hover:opacity-100 transition-all shrink-0"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* New Custom List Bottom Sheet */}
      {isNewListModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border-t border-white/15 rounded-t-3xl p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-200 space-y-4">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto" />
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ListPlus className="w-5 h-5 text-emerald-400" />
              Create Custom List
            </h3>
            <form onSubmit={handleCreateCustomList} className="space-y-3">
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Costco, Home Depot, Camping Gear..."
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewListModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newListTitle.trim()}
                  className="min-h-[44px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs shadow-md shadow-emerald-500/20"
                >
                  Create List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Animated Expanding Quick Add Dock & FAB */}
      <div className="fixed bottom-[calc(76px+1rem+env(safe-area-inset-bottom,0px))] md:bottom-8 left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-none flex justify-end">
          <div
            ref={dockRef}
            className={`fab-dock-transition pointer-events-auto h-[50px] border shadow-2xl flex items-center overflow-hidden ${
              isInputExpanded
                ? 'w-full rounded-3xl border-white/25 bg-slate-900/95 backdrop-blur-xl shadow-emerald-500/10 px-2'
                : 'w-[50px] rounded-full border-emerald-400/40 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 cursor-pointer shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 justify-center'
            }`}
          >
            {!isInputExpanded ? (
              <button
                type="button"
                onClick={() => setIsInputExpanded(true)}
                className="w-full h-full flex items-center justify-center text-slate-950"
                title={`Add item to ${currentListName}`}
              >
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </button>
            ) : (
              <form onSubmit={handleAddItem} className="w-full flex items-center gap-2">
                {/* Far left: Close button */}
                <button
                  type="button"
                  onClick={() => setIsInputExpanded(false)}
                  className="p-2 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white shrink-0"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Middle: Input */}
                <input
                  autoFocus
                  type="text"
                  placeholder={`Add item to ${currentListName}...`}
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent border-none text-sm text-white placeholder-slate-500 focus:outline-none py-2 px-1"
                />

                {/* Far right: Main action button (Add) */}
                <button
                  type="submit"
                  disabled={!newItemName.trim()}
                  className="p-2 sm:px-3.5 sm:py-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 shrink-0"
                  title="Add item"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
