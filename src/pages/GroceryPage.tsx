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
  Loader2,
  Pencil,
  GripVertical,
} from 'lucide-react';
import type { GroceryItem, Aisle, CustomList } from '../types';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';
import { useFabAutoClose } from '../hooks/useFabAutoClose';
import { CheckSparkle, triggerHapticCheck } from '../components/CheckSparkle';
import { Drawer } from '../components/ui/Drawer';
import { Toast } from '../components/ui/Toast';

interface GroceryDataCache {
  householdId: string;
  itemsByList: Record<string, GroceryItem[]>;
  lists: CustomList[];
  aisles: Aisle[];
}

let groceryDataCache: GroceryDataCache | null = null;

export const GroceryPage: React.FC = () => {
  const { household, currentUser, aisles, refreshAisles } = usePWA();
  const effectiveHouseholdId =
    household?.id ||
    currentUser?.household_id ||
    localStorage.getItem('famkit_household_id') ||
    'fam_default_1';
  const householdId = effectiveHouseholdId;
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
  const [crossingOffIds, setCrossingOffIds] = useState<Record<string, boolean>>({});
  const crossingTimersRef = useRef<Record<string, any>>({});
  const [editingItem, setEditingItem] = useState<GroceryItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editAisleId, setEditAisleId] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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
      Object.values(crossingTimersRef.current).forEach((t) => clearTimeout(t));
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

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const nameToAdd = newItemName.trim();
    if (!nameToAdd) return;

    try {
      setIsAddingItem(true);
      const item = await api.addGroceryItem(effectiveHouseholdId, {
        name: nameToAdd,
        list_type: activeListType,
        added_by_user_id: currentUser?.id,
        added_by_user_name: currentUser?.name,
      });
      setItems((prev) => {
        const next = [...prev, item];
        if (groceryDataCache && groceryDataCache.householdId === effectiveHouseholdId) {
          groceryDataCache.itemsByList[activeListType] = next;
        }
        return next;
      });
      setNewItemName('');
    } catch (err: any) {
      console.error('Failed to add item:', err);
      showToast(err?.message || 'Error adding item. Please check connection.');
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleToggleItem = async (id: string) => {
    const item = items.find((it) => it.id === id);
    if (!item) return;

    // If currently playing the crossing-off animation, cancel it if clicked again
    if (crossingOffIds[id]) {
      if (crossingTimersRef.current[id]) {
        clearTimeout(crossingTimersRef.current[id]);
        delete crossingTimersRef.current[id];
      }
      setCrossingOffIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    // Case 1: Item is active -> Play delightful crossing-off animation first!
    if (!item.is_completed) {
      triggerHapticCheck();
      setCrossingOffIds((prev) => ({ ...prev, [id]: true }));

      crossingTimersRef.current[id] = setTimeout(async () => {
        delete crossingTimersRef.current[id];
        setCrossingOffIds((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });

        setItems((prev) => {
          const next = prev.map((it) => (it.id === id ? { ...it, is_completed: true } : it));
          if (groceryDataCache && householdId && groceryDataCache.householdId === householdId) {
            groceryDataCache.itemsByList[activeListTypeRef.current] = next;
          }
          return next;
        });

        try {
          await api.toggleGroceryItem(id);
        } catch (err) {
          console.error('Failed to toggle item:', err);
          loadData(activeListTypeRef.current, false);
        }
      }, 360);
      return;
    }

    // Case 2: Item is in CROSSED OFF section -> Uncross immediately
    triggerHapticCheck();
    try {
      setItems((prev) => {
        const next = prev.map((it) => (it.id === id ? { ...it, is_completed: false } : it));
        if (groceryDataCache && householdId && groceryDataCache.householdId === householdId) {
          groceryDataCache.itemsByList[activeListTypeRef.current] = next;
        }
        return next;
      });
      await api.toggleGroceryItem(id);
    } catch (err) {
      console.error('Failed to uncheck item:', err);
      loadData(activeListTypeRef.current, false);
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

  const handleEditItem = (item: GroceryItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditQuantity(item.quantity || '');
    setEditUnit(item.unit || '');
    setEditNotes(item.notes || '');
    setEditAisleId(item.aisle_id || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editName.trim()) return;
    setIsSavingEdit(true);
    try {
      const selectedAisle = localAisles.find((a) => a.id === editAisleId);
      await api.updateGroceryItem(editingItem.id, {
        name: editName.trim(),
        quantity: editQuantity.trim() || null,
        unit: editUnit.trim() || null,
        note: editNotes.trim() || null,
        aisleId: editAisleId || null,
        category: selectedAisle ? selectedAisle.name : undefined,
      });

      const updatedFields = {
        name: editName.trim(),
        quantity: editQuantity.trim() || undefined,
        unit: editUnit.trim() || undefined,
        notes: editNotes.trim() || undefined,
        aisle_id: editAisleId || '',
      };

      setItems((prev) =>
        prev.map((i) => (i.id === editingItem.id ? { ...i, ...updatedFields } : i))
      );

      if (groceryDataCache && householdId && groceryDataCache.householdId === householdId) {
        if (groceryDataCache.itemsByList[activeListTypeRef.current]) {
          groceryDataCache.itemsByList[activeListTypeRef.current] = groceryDataCache.itemsByList[
            activeListTypeRef.current
          ].map((i) => (i.id === editingItem.id ? { ...i, ...updatedFields } : i));
        }
      }

      setEditingItem(null);
      showToast('Item updated');
    } catch (err: any) {
      console.error('Failed to update grocery item:', err);
      showToast(err?.message || 'Failed to update item.');
    } finally {
      setIsSavingEdit(false);
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
          (it.aisle_id === aisle.id || (it as any).category?.toLowerCase() === aisle.name.toLowerCase())
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

  // Draggable category sorting state
  const [draggingAisleId, setDraggingAisleId] = useState<string | null>(null);
  const [dragStartIndex, setDragStartIndex] = useState<number>(-1);
  const [dragTargetIndex, setDragTargetIndex] = useState<number>(-1);
  const [dragOffsetY, setDragOffsetY] = useState<number>(0);
  const [dragShiftAmount, setDragShiftAmount] = useState<number>(0);

  const dragStartIndexRef = useRef<number>(-1);
  const dragTargetIndexRef = useRef<number>(-1);
  const dragStartYRef = useRef<number>(0);
  const initialMidpointsRef = useRef<number[]>([]);
  const cardElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const itemsByAisleRef = useRef<{ aisle: Aisle; items: GroceryItem[] }[]>([]);
  itemsByAisleRef.current = itemsByAisle;

  const handleDragStart = (e: React.PointerEvent, aisleId: string, index: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    const list = itemsByAisleRef.current;
    if (list.length <= 1) return;

    // Record initial resting midpoints of all cards
    const midpoints: number[] = [];
    for (let i = 0; i < list.length; i++) {
      const el = cardElementsRef.current.get(list[i]?.aisle.id);
      if (el) {
        const rect = el.getBoundingClientRect();
        midpoints.push(rect.top + rect.height / 2);
      } else {
        midpoints.push(0);
      }
    }
    initialMidpointsRef.current = midpoints;

    // Measure dragged card height
    const draggedEl = cardElementsRef.current.get(aisleId);
    const draggedHeight = draggedEl ? draggedEl.getBoundingClientRect().height : 60;
    setDragShiftAmount(draggedHeight + 16);

    setDraggingAisleId(aisleId);
    setDragStartIndex(index);
    setDragTargetIndex(index);
    dragStartIndexRef.current = index;
    dragTargetIndexRef.current = index;
    setDragOffsetY(0);
    dragStartYRef.current = e.clientY;

    try {
      if ('vibrate' in navigator) navigator.vibrate(20);
    } catch {}
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (!draggingAisleId) return;

    const currentY = e.clientY;
    const offset = currentY - dragStartYRef.current;
    setDragOffsetY(offset);

    const midpoints = initialMidpointsRef.current;
    if (midpoints.length <= 1) return;

    const startIdx = dragStartIndexRef.current;
    const currentCenter = (midpoints[startIdx] || currentY) + offset;
    let closestIdx = startIdx >= 0 ? startIdx : 0;
    let minDistance = Infinity;

    for (let i = 0; i < midpoints.length; i++) {
      if (midpoints[i] === 0) continue;
      const dist = Math.abs(currentCenter - midpoints[i]);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = i;
      }
    }

    closestIdx = Math.max(0, Math.min(midpoints.length - 1, closestIdx));

    if (closestIdx !== dragTargetIndexRef.current) {
      dragTargetIndexRef.current = closestIdx;
      setDragTargetIndex(closestIdx);

      try {
        if ('vibrate' in navigator) navigator.vibrate(15);
      } catch {}
    }
  };

  const handleDragEnd = (e: React.PointerEvent) => {
    if (!draggingAisleId) return;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    try {
      if ('vibrate' in navigator) navigator.vibrate(15);
    } catch {}

    const fromIdx = dragStartIndexRef.current;
    const toIdx = dragTargetIndexRef.current;

    setDraggingAisleId(null);
    setDragStartIndex(-1);
    setDragTargetIndex(-1);
    setDragOffsetY(0);
    setDragShiftAmount(0);
    dragStartIndexRef.current = -1;
    dragTargetIndexRef.current = -1;

    if (toIdx >= 0 && toIdx !== fromIdx) {
      const currentList = itemsByAisleRef.current;
      const reorderedVisible = [...currentList];
      const [moved] = reorderedVisible.splice(fromIdx, 1);
      reorderedVisible.splice(toIdx, 0, moved);

      const reorderedIds = reorderedVisible.map((entry) => entry.aisle.id);

      setLocalAisles((prevAisles) => {
        const base = prevAisles.length > 0 ? [...prevAisles] : [...aisles];
        const visibleSet = new Set(reorderedIds);

        reorderedIds.forEach((id, idx) => {
          const match = base.find((a) => a.id === id);
          if (match) {
            match.display_order = idx;
          }
        });

        let nextOrder = reorderedIds.length;
        base.forEach((a) => {
          if (!visibleSet.has(a.id)) {
            a.display_order = nextOrder++;
          }
        });

        const sorted = [...base].sort((a, b) => a.display_order - b.display_order);

        if (groceryDataCache && householdId && groceryDataCache.householdId === householdId) {
          groceryDataCache.aisles = sorted;
        }

        api.reorderAisles(householdId, sorted.map((a) => a.id))
          .then(() => {
            refreshAisles();
            showToast('Category order saved');
          })
          .catch((err) => {
            console.error('Failed to save category order:', err);
            showToast('Failed to save category order');
          });

        return sorted;
      });
    }
  };

  const currentList = customLists.find((l) => l.id === activeListType);
  const currentListName = isGroceryList ? 'Grocery List' : currentList?.title || 'Checklist';
  const currentListIcon = isGroceryList ? '🛒' : currentList?.icon || '📋';

  const isDraggingAny = Boolean(draggingAisleId);

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 pt-3 pb-36 md:pb-28 space-y-4">
      {/* Consistent Mobile-First Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-slate-950">
            <ShoppingCart className="w-5 h-5 stroke-[2.2]" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Lists
          </h1>
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
        {isGroceryList && itemsByAisle.length > 1 && (
          <div className="flex items-center justify-between px-1 text-[11px] font-medium text-slate-400">
            <span className="flex items-center gap-1.5">
              <GripVertical className="w-3.5 h-3.5 text-slate-500" />
              <span>Drag handle to reorder categories</span>
            </span>
            <span className="text-[10px] font-mono opacity-70">
              {itemsByAisle.length} categories
            </span>
          </div>
        )}

        {isGroceryList &&
          itemsByAisle.map(({ aisle, items: aisleItems }, idx) => {
            const isCollapsed = collapsedAisles[aisle.id];
            const isDragging = draggingAisleId === aisle.id;

            // Calculate optimistic displacement for stationary cards
            let cardTranslateY = 0;
            if (isDragging) {
              cardTranslateY = dragOffsetY;
            } else if (
              draggingAisleId &&
              dragStartIndex !== -1 &&
              dragTargetIndex !== -1 &&
              dragShiftAmount > 0
            ) {
              if (dragStartIndex < dragTargetIndex) {
                // Dragging DOWN: lists between (dragStartIndex, dragTargetIndex] move UP
                if (idx > dragStartIndex && idx <= dragTargetIndex) {
                  cardTranslateY = -dragShiftAmount;
                }
              } else if (dragStartIndex > dragTargetIndex) {
                // Dragging UP: lists between [dragTargetIndex, dragStartIndex) move DOWN
                if (idx >= dragTargetIndex && idx < dragStartIndex) {
                  cardTranslateY = dragShiftAmount;
                }
              }
            }

            const currentSlot = (isDragging && dragTargetIndex >= 0 ? dragTargetIndex : idx) + 1;

            return (
              <div
                key={aisle.id}
                ref={(el) => {
                  if (el) {
                    cardElementsRef.current.set(aisle.id, el);
                  } else {
                    cardElementsRef.current.delete(aisle.id);
                  }
                }}
                style={{
                  transform:
                    isDragging
                      ? `translateY(${dragOffsetY}px)`
                      : cardTranslateY !== 0
                      ? `translateY(${cardTranslateY}px)`
                      : undefined,
                  zIndex: isDragging ? 50 : undefined,
                  transition: isDragging
                    ? 'none'
                    : isDraggingAny
                    ? 'transform 220ms cubic-bezier(0.2, 0, 0, 1)'
                    : undefined,
                }}
                className={`glass-panel rounded-3xl border overflow-hidden relative ${
                  isDragging
                    ? 'border-emerald-400 ring-2 ring-emerald-400/80 shadow-2xl shadow-emerald-950/90 scale-[1.02] bg-slate-900/98 z-50 opacity-95'
                    : 'border-white/10 shadow-sm'
                }`}
              >
                {/* Aisle Category Header */}
                <div
                  className={`w-full flex items-center justify-between px-3 py-2.5 sm:px-3.5 sm:py-3 border-b border-white/5 transition-colors select-none ${
                    isDragging ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-900/40 hover:bg-slate-900/60'
                  }`}
                >
                  {/* Drag Handle */}
                  {itemsByAisle.length > 1 && (
                    <div
                      onPointerDown={(e) => handleDragStart(e, aisle.id, idx)}
                      onPointerMove={handleDragMove}
                      onPointerUp={handleDragEnd}
                      onPointerCancel={handleDragEnd}
                      className={`p-1.5 -ml-1 cursor-grab active:cursor-grabbing touch-none select-none rounded-lg transition-colors shrink-0 ${
                        isDragging
                          ? 'text-emerald-400 bg-emerald-500/20 ring-1 ring-emerald-400/50'
                          : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                      }`}
                      title="Drag to reorder category"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>
                  )}

                  {/* Category Title & Collapse Trigger */}
                  <button
                    type="button"
                    disabled={isDragging}
                    onClick={() => !isDragging && toggleAisleCollapse(aisle.id)}
                    className="flex-1 min-w-0 flex items-center justify-between ml-1.5 py-0.5 text-left cursor-pointer disabled:cursor-grabbing"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full shadow-sm shrink-0"
                        style={{ backgroundColor: aisle.color || '#10b981' }}
                      />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200 truncate">
                        {aisle.name}
                      </span>
                      {isDragging ? (
                        <span className="text-[10px] font-mono font-bold bg-emerald-400/25 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded-full animate-pulse shrink-0">
                          Slot #{currentSlot}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded-full text-slate-400 shrink-0">
                          {aisleItems.length}
                        </span>
                      )}
                    </div>

                    <div className="text-slate-500 hover:text-slate-300 transition-colors shrink-0">
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>
                  </div>

                {/* Items in this Aisle */}
                {!isCollapsed && (
                  <div className="divide-y divide-white/5">
                    {aisleItems.map((item) => {
                      const isCrossing = Boolean(crossingOffIds[item.id]);
                      const isChecked = item.is_completed || isCrossing;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleToggleItem(item.id)}
                          className={`flex items-center justify-between px-3.5 py-2 transition-all cursor-pointer group hover:bg-white/5 gap-2 min-h-[42px] ${
                            isCrossing ? 'animate-row-crossing' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className={`relative w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                                isChecked
                                  ? 'border-emerald-500 bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30 ' +
                                    (isCrossing ? 'animate-check-pop' : '')
                                  : 'border-white/20 bg-slate-900/80 group-hover:border-emerald-500'
                              }`}
                            >
                              <CheckSparkle trigger={isCrossing} />
                              {isChecked && (
                                <Check className="w-3.5 h-3.5 text-slate-950 font-bold stroke-[3]" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-sm font-semibold truncate transition-colors ${
                                    isCrossing
                                      ? 'animate-strike text-slate-400'
                                      : isChecked
                                      ? 'line-through text-slate-400'
                                      : 'text-slate-100'
                                  }`}
                                >
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
                                handleEditItem(item);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 opacity-40 group-hover:opacity-100 transition-all"
                              title="Edit item"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
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
                      );
                    })}
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
              {uncategorizedItems.map((item) => {
                const isCrossing = Boolean(crossingOffIds[item.id]);
                const isChecked = item.is_completed || isCrossing;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggleItem(item.id)}
                    className={`flex items-center justify-between px-3.5 py-2 hover:bg-white/5 transition-all cursor-pointer group gap-2 min-h-[42px] ${
                      isCrossing ? 'animate-row-crossing' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`relative w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                          isChecked
                            ? 'border-emerald-500 bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30 ' +
                              (isCrossing ? 'animate-check-pop' : '')
                            : 'border-white/20 bg-slate-900/80 group-hover:border-emerald-500'
                        }`}
                      >
                        <CheckSparkle trigger={isCrossing} />
                        {isChecked && (
                          <Check className="w-3.5 h-3.5 text-slate-950 font-bold stroke-[3]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-semibold truncate transition-colors ${
                              isCrossing
                                ? 'animate-strike text-slate-400'
                                : isChecked
                                ? 'line-through text-slate-400'
                                : 'text-slate-100'
                            }`}
                          >
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
                          handleEditItem(item);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 opacity-40 group-hover:opacity-100 transition-all"
                        title="Edit item"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
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
                );
              })}
            </div>
          </div>
        )}

        {/* Non-Grocery Custom List: Display as Simple Flat Checklist */}
        {!isGroceryList && activeItems.length > 0 && (
          <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden shadow-sm divide-y divide-white/5">
            {activeItems.map((item) => {
              const isCrossing = Boolean(crossingOffIds[item.id]);
              const isChecked = item.is_completed || isCrossing;
              return (
                <div
                  key={item.id}
                  onClick={() => handleToggleItem(item.id)}
                  className={`flex items-center justify-between px-3.5 py-2 hover:bg-white/5 transition-all cursor-pointer group gap-2 min-h-[42px] ${
                    isCrossing ? 'animate-row-crossing' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`relative w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                        isChecked
                          ? 'border-emerald-500 bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30 ' +
                            (isCrossing ? 'animate-check-pop' : '')
                          : 'border-white/20 bg-slate-900/80 group-hover:border-emerald-500'
                      }`}
                    >
                      <CheckSparkle trigger={isCrossing} />
                      {isChecked && (
                        <Check className="w-3.5 h-3.5 text-slate-950 font-bold stroke-[3]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-semibold truncate transition-colors ${
                            isCrossing
                              ? 'animate-strike text-slate-400'
                              : isChecked
                              ? 'line-through text-slate-400'
                              : 'text-slate-100'
                          }`}
                        >
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
                        handleEditItem(item);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 opacity-40 group-hover:opacity-100 transition-all"
                      title="Edit item"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
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
              );
            })}
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
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditItem(item);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 opacity-40 group-hover:opacity-100 transition-all"
                      title="Edit item"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
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
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Grocery Item Drawer */}
      <Drawer
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title="Edit Item"
        subtitle="Update item name, quantity, unit, aisle, or notes"
        icon={<Pencil className="w-5 h-5 text-emerald-400" />}
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingItem(null)}
              className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-grocery-item-form"
              disabled={!editName.trim() || isSavingEdit}
              className="min-h-[40px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              {isSavingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        }
      >
        <form id="edit-grocery-item-form" onSubmit={handleSaveEdit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Item Name
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Egg white protein powder"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Quantity
              </label>
              <input
                type="text"
                placeholder="e.g. 1, 2, 0.5"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Unit
              </label>
              <input
                type="text"
                placeholder="e.g. scoop, bag, oz, lbs"
                value={editUnit}
                onChange={(e) => setEditUnit(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {isGroceryList && localAisles.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Store Aisle / Category
              </label>
              <select
                value={editAisleId}
                onChange={(e) => setEditAisleId(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">Uncategorized / Other</option>
                {localAisles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Notes / Details
            </label>
            <input
              type="text"
              placeholder="e.g. chocolate flavor, unsweetened"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </form>
      </Drawer>

      {/* New Custom List Drawer */}
      <Drawer
        isOpen={isNewListModalOpen}
        onClose={() => setIsNewListModalOpen(false)}
        title="Create Custom List"
        subtitle="Add a specialized list for another store or activity"
        icon={<ListPlus className="w-5 h-5 text-emerald-400" />}
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsNewListModalOpen(false)}
              className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-list-form"
              disabled={!newListTitle.trim()}
              className="min-h-[40px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              Create List
            </button>
          </div>
        }
      >
        <form id="create-list-form" onSubmit={handleCreateCustomList} className="space-y-3">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            List Name
          </label>
          <input
            type="text"
            required
            autoFocus
            placeholder="e.g. Costco, Home Depot, Camping Gear..."
            value={newListTitle}
            onChange={(e) => setNewListTitle(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </form>
      </Drawer>
      {/* Floating Toast Notification */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />

      {/* Animated Expanding Quick Add Dock & FAB */}
      <div className="fixed bottom-[calc(76px+1rem+env(safe-area-inset-bottom,0px))] md:bottom-8 left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-none flex justify-end">
          <div
            ref={dockRef}
            className={`fab-dock-transition pointer-events-auto h-[50px] border shadow-2xl flex items-center overflow-hidden ${
              isInputExpanded
                ? 'w-full rounded-3xl border-white/25 bg-slate-900/95 backdrop-blur-xl shadow-emerald-500/10 px-2.5'
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
              <div className="w-full flex items-center gap-2">
                {/* Far left: Close button outside of form so Enter never triggers it */}
                <button
                  type="button"
                  onClick={() => setIsInputExpanded(false)}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center shrink-0 transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Form wrapping input and submit button */}
                <form
                  onSubmit={handleAddItem}
                  className="flex-1 min-w-0 flex items-center gap-2"
                >
                  <input
                    autoFocus
                    type="text"
                    placeholder={`Add to ${currentListName}...`}
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    disabled={isAddingItem}
                    className="flex-1 min-w-0 bg-transparent border-none text-sm text-white placeholder-slate-500 focus:outline-none py-2 px-1"
                  />

                  {/* Far right: Main action button (Add) */}
                  <button
                    type="submit"
                    disabled={!newItemName.trim() || isAddingItem}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 shrink-0 active:scale-95"
                    title="Add item"
                  >
                    {isAddingItem ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    )}
                    <span>{isAddingItem ? 'Adding...' : 'Add'}</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
