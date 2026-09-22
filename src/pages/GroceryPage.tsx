import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Check,
  Trash2,
  ListPlus,
  FolderPlus,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  ListChecks,
  X,
  Loader2,
  Pencil,
  GripVertical,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react';
import type { GroceryItem, Aisle, CustomList, GrocerySuggestion } from '../types';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';
import { CheckSparkle, triggerHapticCheck } from '../components/CheckSparkle';
import { Drawer } from '../components/ui/Drawer';
import { Toast } from '../components/ui/Toast';

interface GroceryDataCache {
  householdId: string;
  itemsByList: Record<string, GroceryItem[]>;
  aislesByList?: Record<string, Aisle[]>;
  lists: CustomList[];
  aisles: Aisle[];
  suggestions?: GrocerySuggestion[];
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
    if (activeListType === 'grocery') {
      return groceryDataCache?.aislesByList?.['grocery'] || (groceryDataCache && groceryDataCache.aisles.length > 0 ? groceryDataCache.aisles : aisles);
    }
    return groceryDataCache?.aislesByList?.[activeListType] || [];
  });
  const [newItemName, setNewItemName] = useState('');
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [isNewListModalOpen, setIsNewListModalOpen] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('📁');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
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

  const [suggestions, setSuggestions] = useState<GrocerySuggestion[]>(() => {
    return groceryDataCache?.suggestions || [];
  });
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1);
  const [isAutocompleteDismissed, setIsAutocompleteDismissed] = useState<boolean>(false);
  const [movingItem, setMovingItem] = useState<GroceryItem | null>(null);

  // Long-press & drag-to-category state for items
  const [draggingItem, setDraggingItem] = useState<GroceryItem | null>(null);
  const [dragPointerPos, setDragPointerPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredAisleId, setHoveredAisleId] = useState<string | null>(null);
  const [dragRowLayout, setDragRowLayout] = useState<{ left: number; width: number; height: number; offsetY: number } | null>(null);

  const itemLongPressTimerRef = useRef<any>(null);
  const itemPointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pendingDragItemRef = useRef<GroceryItem | null>(null);
  const isItemDraggingRef = useRef<boolean>(false);
  const hasItemDraggedRef = useRef<boolean>(false);
  const hoveredAisleIdRef = useRef<string | null>(null);
  hoveredAisleIdRef.current = hoveredAisleId;
  const draggingItemRef = useRef<GroceryItem | null>(null);
  draggingItemRef.current = draggingItem;
  const sourceAisleIdRef = useRef<string>('uncategorized');
  const dragRowLayoutRef = useRef<{ left: number; width: number; height: number; offsetY: number } | null>(null);
  const dragListenersCleanupRef = useRef<(() => void) | null>(null);

  const matchingSuggestions = React.useMemo(() => {
    const q = newItemName.trim().toLowerCase();
    if (!q || q.length < 1 || isAutocompleteDismissed || activeListType !== 'grocery') return [];
    return suggestions
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [newItemName, suggestions, isAutocompleteDismissed, activeListType]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const quickAddInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      Object.values(crossingTimersRef.current).forEach((t) => clearTimeout(t));
      clearTimeout(itemLongPressTimerRef.current);
      if (dragListenersCleanupRef.current) {
        dragListenersCleanupRef.current();
      }
    };
  }, []);

  useEffect(() => {
    if (activeListType === 'grocery' && aisles.length > 0) {
      setLocalAisles(aisles);
    }
  }, [aisles, activeListType]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsListDropdownOpen(false);
      }
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
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

    const cachedAisles =
      groceryDataCache && groceryDataCache.householdId === householdId
        ? groceryDataCache.aislesByList?.[targetListId]
        : undefined;

    const sanitizedCachedAisles = cachedAisles
      ? cachedAisles.filter((a) =>
          targetListId === 'grocery' ? (!a.list_id || a.list_id === 'grocery') : a.list_id === targetListId
        )
      : undefined;

    if (cachedItems !== undefined) {
      setItems(cachedItems);
      setLocalAisles(sanitizedCachedAisles || (targetListId === 'grocery' ? aisles : []));
      setIsLoading(false);
    } else {
      // Clear stale items immediately so the previous list never flashes while loading the new one
      setItems([]);
      setLocalAisles(targetListId === 'grocery' ? aisles : []);
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

      const targetAisles = (data.aisles || []).filter((a) =>
        targetListId === 'grocery' ? (!a.list_id || a.list_id === 'grocery') : a.list_id === targetListId
      );

      if (!groceryDataCache || groceryDataCache.householdId !== householdId) {
        groceryDataCache = {
          householdId,
          itemsByList: {},
          aislesByList: {},
          lists: data.lists,
          aisles: targetAisles,
        };
      }
      groceryDataCache.itemsByList[targetListId] = data.items;
      if (!groceryDataCache.aislesByList) {
        groceryDataCache.aislesByList = {};
      }
      groceryDataCache.aislesByList[targetListId] = targetAisles;
      groceryDataCache.lists = data.lists;
      if (targetListId === 'grocery') {
        groceryDataCache.aisles = targetAisles;
      }
      if (data.suggestions && data.suggestions.length > 0) {
        groceryDataCache.suggestions = data.suggestions;
        setSuggestions(data.suggestions);
      }

      if (activeListTypeRef.current === targetListId) {
        setItems(data.items);
        setLocalAisles(targetAisles);
      }
      setCustomLists(data.lists);
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

      // Update suggestions pool
      setSuggestions((prev) => {
        const next = [...prev];
        const matchIdx = next.findIndex((s) => s.name.toLowerCase() === item.name.toLowerCase());
        const aisle = effectiveAisles.find((a) => a.id === item.aisle_id);
        const entry: GrocerySuggestion = {
          name: item.name,
          aisleId: item.aisle_id,
          category: aisle?.name || 'Grocery',
        };
        if (matchIdx >= 0) {
          next[matchIdx] = entry;
        } else {
          next.unshift(entry);
        }
        if (groceryDataCache) groceryDataCache.suggestions = next;
        return next;
      });

      setNewItemName('');
      setIsAutocompleteDismissed(false);
      setSelectedSuggestionIndex(-1);
    } catch (err: any) {
      console.error('Failed to add item:', err);
      showToast(err?.message || 'Error adding item. Please check connection.');
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleAddSuggestion = async (sug: GrocerySuggestion) => {
    const nameToAdd = sug.name.trim();
    if (!nameToAdd) return;

    try {
      setIsAddingItem(true);
      const item = await api.addGroceryItem(effectiveHouseholdId, {
        name: nameToAdd,
        list_type: activeListType,
        aisle_id: sug.aisleId,
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
      setIsAutocompleteDismissed(true);
      setSelectedSuggestionIndex(-1);

      const aisle = effectiveAisles.find((a) => a.id === item.aisle_id);
      showToast(`Added ${item.name} to ${aisle?.name || sug.category || 'Grocery'}`);
    } catch (err: any) {
      console.error('Failed to add suggested item:', err);
      showToast(err?.message || 'Error adding item. Please check connection.');
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (matchingSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev < matchingSuggestions.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : matchingSuggestions.length - 1));
      } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0 && selectedSuggestionIndex < matchingSuggestions.length) {
        e.preventDefault();
        handleAddSuggestion(matchingSuggestions[selectedSuggestionIndex]);
      } else if (e.key === 'Escape') {
        setIsAutocompleteDismissed(true);
      }
    }
  };

  const handleToggleItem = async (id: string) => {
    if (hasItemDraggedRef.current || isItemDraggingRef.current) return;
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
      const selectedAisle = effectiveAisles.find((a) => a.id === editAisleId);
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

      const wasAisleChanged = editingItem.aisle_id !== editAisleId;
      if (wasAisleChanged && selectedAisle) {
        setSuggestions((prev) => {
          const next = [...prev];
          const matchIdx = next.findIndex((s) => s.name.toLowerCase() === editName.trim().toLowerCase());
          if (matchIdx >= 0) {
            next[matchIdx] = { ...next[matchIdx], aisleId: selectedAisle.id, category: selectedAisle.name };
          } else {
            next.unshift({ name: editName.trim(), aisleId: selectedAisle.id, category: selectedAisle.name });
          }
          if (groceryDataCache) groceryDataCache.suggestions = next;
          return next;
        });
      }

      setEditingItem(null);
      if (wasAisleChanged && selectedAisle) {
        showToast(`Moved to ${selectedAisle.name} • Remembered for next time`);
      } else {
        showToast('Item updated');
      }
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
    const hId = household?.id || householdId;
    if (!newListTitle.trim() || !hId) return;

    try {
      const created = await api.createCustomList(hId, newListTitle.trim());
      setCustomLists((prev) => {
        const next = [...prev, created];
        if (groceryDataCache && groceryDataCache.householdId === hId) {
          groceryDataCache.lists = next;
        }
        return next;
      });
      if (groceryDataCache && groceryDataCache.householdId === hId) {
        groceryDataCache.itemsByList[created.id] = [];
        if (!groceryDataCache.aislesByList) groceryDataCache.aislesByList = {};
        groceryDataCache.aislesByList[created.id] = [];
      }
      setItems([]);
      setLocalAisles([]);
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

  const handleCreateCategory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const catName = newCategoryName.trim();
    if (!catName || !householdId) return;

    try {
      setIsCreatingCategory(true);
      const newAisle = await api.createAisle(
        householdId,
        catName,
        '#10b981',
        activeListType,
        newCategoryIcon || (activeListType === 'grocery' ? '🛒' : '📁')
      );

      setLocalAisles((prev) => {
        const base = prev.filter((a) =>
          activeListType === 'grocery' ? (!a.list_id || a.list_id === 'grocery') : a.list_id === activeListType
        );
        const next = [...base, newAisle];
        if (groceryDataCache && groceryDataCache.householdId === householdId) {
          if (!groceryDataCache.aislesByList) groceryDataCache.aislesByList = {};
          groceryDataCache.aislesByList[activeListType] = next;
          if (activeListType === 'grocery') {
            groceryDataCache.aisles = next;
          }
        }
        return next;
      });

      if (activeListType === 'grocery') {
        refreshAisles();
      }
      showToast(`Category "${catName}" added to ${currentListName}`);
      setNewCategoryName('');
      setIsNewCategoryModalOpen(false);
    } catch (err: any) {
      console.error('Failed to create category:', err);
      showToast(err?.message || 'Failed to create category');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleDeleteCustomList = async (listId: string, listTitle: string) => {
    if (confirm(`Are you sure you want to delete the list "${listTitle}"?`)) {
      try {
        await api.deleteCustomList(listId);
        if (groceryDataCache) {
          delete groceryDataCache.itemsByList[listId];
          if (groceryDataCache.aislesByList) {
            delete groceryDataCache.aislesByList[listId];
          }
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

  // Filter and sort aisles strictly by active list
  const effectiveAisles = useMemo(() => {
    if (activeListType === 'grocery') {
      const groceryAisles = localAisles.filter((a) => !a.list_id || a.list_id === 'grocery');
      return groceryAisles.length > 0 ? groceryAisles : aisles;
    }
    return localAisles.filter((a) => a.list_id === activeListType);
  }, [localAisles, activeListType, aisles]);

  const sortedAisles = useMemo(
    () => [...effectiveAisles].sort((a, b) => a.display_order - b.display_order),
    [effectiveAisles]
  );

  const itemsByAisle: { aisle: Aisle; items: GroceryItem[] }[] = [];
  const uncategorizedItems: GroceryItem[] = [];

  const isGroceryList = activeListType === 'grocery';
  const hasCategories = effectiveAisles.length > 0;

  if (hasCategories) {
    const placedItemIds = new Set<string>();

    sortedAisles.forEach((aisle) => {
      const aisleItems = activeItems.filter(
        (it) =>
          !placedItemIds.has(it.id) &&
          (it.aisle_id === aisle.id || (it as any).category?.toLowerCase() === aisle.name.toLowerCase())
      );
      aisleItems.forEach((it) => placedItemIds.add(it.id));
      if (aisleItems.length > 0 || !isGroceryList) {
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
        const base = prevAisles.length > 0
          ? [...prevAisles.filter((a) => (activeListType === 'grocery' ? (!a.list_id || a.list_id === 'grocery') : a.list_id === activeListType))]
          : (activeListType === 'grocery' ? [...aisles] : []);
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
          if (!groceryDataCache.aislesByList) groceryDataCache.aislesByList = {};
          groceryDataCache.aislesByList[activeListType] = sorted;
          if (activeListType === 'grocery') {
            groceryDataCache.aisles = sorted;
          }
        }

        api.reorderAisles(householdId, sorted.map((a) => a.id))
          .then(() => {
            if (activeListType === 'grocery') {
              refreshAisles();
            }
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

  const moveItemToCategory = async (itemToMove: GroceryItem, targetAisleId: string) => {
    if (!itemToMove) return;

    if (targetAisleId === 'uncategorized') {
      // Optimistic update
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemToMove.id ? { ...i, aisle_id: '', category: '' } : i
        )
      );

      if (groceryDataCache && householdId && groceryDataCache.householdId === householdId) {
        if (groceryDataCache.itemsByList[activeListTypeRef.current]) {
          groceryDataCache.itemsByList[activeListTypeRef.current] = groceryDataCache.itemsByList[
            activeListTypeRef.current
          ].map((i) =>
            i.id === itemToMove.id ? { ...i, aisle_id: '', category: '' } : i
          );
        }
      }

      try {
        await api.updateGroceryItem(itemToMove.id, {
          aisleId: null,
          category: null,
        });
        showToast(`Moved "${itemToMove.name}" to Uncategorized`);
      } catch (err: any) {
        console.error('Failed to move item:', err);
        showToast('Failed to move item.');
        loadData(activeListTypeRef.current, false);
      }
      return;
    }

    const targetAisle = effectiveAisles.find((a) => a.id === targetAisleId);
    if (!targetAisle) return;

    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemToMove.id ? { ...i, aisle_id: targetAisleId, category: targetAisle.name } : i
      )
    );

    if (groceryDataCache && householdId && groceryDataCache.householdId === householdId) {
      if (groceryDataCache.itemsByList[activeListTypeRef.current]) {
        groceryDataCache.itemsByList[activeListTypeRef.current] = groceryDataCache.itemsByList[
          activeListTypeRef.current
        ].map((i) =>
          i.id === itemToMove.id ? { ...i, aisle_id: targetAisleId, category: targetAisle.name } : i
        );
      }
    }

    setSuggestions((prev) => {
      const next = [...prev];
      const matchIdx = next.findIndex((s) => s.name.toLowerCase() === itemToMove.name.trim().toLowerCase());
      if (matchIdx >= 0) {
        next[matchIdx] = { ...next[matchIdx], aisleId: targetAisle.id, category: targetAisle.name };
      } else {
        next.unshift({ name: itemToMove.name.trim(), aisleId: targetAisle.id, category: targetAisle.name });
      }
      if (groceryDataCache) groceryDataCache.suggestions = next;
      return next;
    });

    try {
      await api.updateGroceryItem(itemToMove.id, {
        aisleId: targetAisle.id,
        category: targetAisle.name,
      });
      showToast(`Moved to ${targetAisle.name} • Remembered for next time`);
    } catch (err: any) {
      console.error('Failed to move item:', err);
      showToast('Failed to move item.');
      loadData(activeListTypeRef.current, false);
    }
  };

  const handleQuickMoveItem = async (targetAisleId: string) => {
    if (!movingItem) return;
    const item = movingItem;
    setMovingItem(null);
    await moveItemToCategory(item, targetAisleId);
  };

  // Item Long-Press & Drag Handlers
  const handleItemPointerDown = (
    e: React.PointerEvent,
    item: GroceryItem,
    sourceAisleId: string
  ) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input, a, select')) return;

    if (dragListenersCleanupRef.current) {
      dragListenersCleanupRef.current();
    }

    const rowEl = e.currentTarget as HTMLElement;
    const rowRect = rowEl.getBoundingClientRect();
    const layout = {
      left: rowRect.left,
      width: rowRect.width,
      height: rowRect.height,
      offsetY: e.clientY - rowRect.top,
    };
    dragRowLayoutRef.current = layout;

    itemPointerStartRef.current = { x: e.clientX, y: e.clientY };
    pendingDragItemRef.current = item;
    sourceAisleIdRef.current = sourceAisleId || item.aisle_id || 'uncategorized';
    hasItemDraggedRef.current = false;
    isItemDraggingRef.current = false;

    clearTimeout(itemLongPressTimerRef.current);
    itemLongPressTimerRef.current = setTimeout(() => {
      isItemDraggingRef.current = true;
      hasItemDraggedRef.current = true;
      setDraggingItem(item);
      draggingItemRef.current = item;
      setDragRowLayout(layout);
      setDragPointerPos({ x: itemPointerStartRef.current.x, y: itemPointerStartRef.current.y });
      document.body.style.userSelect = 'none';
      try {
        if ('vibrate' in navigator) navigator.vibrate(35);
      } catch {}
    }, 300);

    const onGlobalPointerMove = (moveEv: PointerEvent) => {
      if (!isItemDraggingRef.current) {
        const dx = moveEv.clientX - itemPointerStartRef.current.x;
        const dy = moveEv.clientY - itemPointerStartRef.current.y;
        if (Math.hypot(dx, dy) > 10) {
          clearTimeout(itemLongPressTimerRef.current);
          pendingDragItemRef.current = null;
          cleanup();
        }
        return;
      }

      if (moveEv.cancelable) moveEv.preventDefault();
      setDragPointerPos({ x: moveEv.clientX, y: moveEv.clientY });

      // Edge auto-scrolling
      const edgeThreshold = 90;
      if (moveEv.clientY < edgeThreshold) {
        window.scrollBy({ top: -10, behavior: 'auto' });
      } else if (moveEv.clientY > window.innerHeight - edgeThreshold) {
        window.scrollBy({ top: 10, behavior: 'auto' });
      }

      // Hit-test category drop targets using row center X coordinate
      let foundAisleId: string | null = null;
      const testX = dragRowLayoutRef.current
        ? dragRowLayoutRef.current.left + dragRowLayoutRef.current.width / 2
        : moveEv.clientX;
      const testY = moveEv.clientY;

      const elUnderPoint = document.elementFromPoint(testX, testY);
      const targetCard = elUnderPoint?.closest('[data-category-drop-id]');
      if (targetCard) {
        foundAisleId = targetCard.getAttribute('data-category-drop-id');
      }

      if (!foundAisleId) {
        for (const [aisleId, cardEl] of cardElementsRef.current.entries()) {
          if (!cardEl) continue;
          const rect = cardEl.getBoundingClientRect();
          if (
            testY >= rect.top - 8 &&
            testY <= rect.bottom + 8
          ) {
            foundAisleId = aisleId;
            break;
          }
        }
      }

      if (foundAisleId !== hoveredAisleIdRef.current) {
        hoveredAisleIdRef.current = foundAisleId;
        setHoveredAisleId(foundAisleId);
        if (foundAisleId && foundAisleId !== sourceAisleIdRef.current) {
          try {
            if ('vibrate' in navigator) navigator.vibrate(15);
          } catch {}
        }
      }
    };

    const onGlobalPointerUp = (upEv: PointerEvent) => {
      cleanup();
      clearTimeout(itemLongPressTimerRef.current);

      if (!isItemDraggingRef.current) {
        pendingDragItemRef.current = null;
        return;
      }

      if (upEv.cancelable) upEv.preventDefault();
      upEv.stopPropagation();

      const dragged = draggingItemRef.current;
      const targetId = hoveredAisleIdRef.current;
      const sourceId = sourceAisleIdRef.current;

      isItemDraggingRef.current = false;
      setDraggingItem(null);
      draggingItemRef.current = null;
      setDragRowLayout(null);
      dragRowLayoutRef.current = null;
      setHoveredAisleId(null);
      hoveredAisleIdRef.current = null;
      pendingDragItemRef.current = null;

      setTimeout(() => {
        hasItemDraggedRef.current = false;
      }, 250);

      if (dragged && targetId && targetId !== sourceId) {
        try {
          if ('vibrate' in navigator) navigator.vibrate(30);
        } catch {}
        moveItemToCategory(dragged, targetId);
      }
    };

    const onGlobalPointerCancel = () => {
      cleanup();
      clearTimeout(itemLongPressTimerRef.current);
      isItemDraggingRef.current = false;
      setDraggingItem(null);
      draggingItemRef.current = null;
      setDragRowLayout(null);
      dragRowLayoutRef.current = null;
      setHoveredAisleId(null);
      hoveredAisleIdRef.current = null;
      pendingDragItemRef.current = null;
      setTimeout(() => {
        hasItemDraggedRef.current = false;
      }, 250);
    };

    const onGlobalTouchMove = (touchEv: TouchEvent) => {
      if (isItemDraggingRef.current && touchEv.cancelable) {
        touchEv.preventDefault();
      }
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onGlobalPointerMove);
      window.removeEventListener('pointerup', onGlobalPointerUp);
      window.removeEventListener('pointercancel', onGlobalPointerCancel);
      window.removeEventListener('touchmove', onGlobalTouchMove);
      document.body.style.userSelect = '';
      setDragRowLayout(null);
      dragRowLayoutRef.current = null;
      dragListenersCleanupRef.current = null;
    };

    dragListenersCleanupRef.current = cleanup;

    window.addEventListener('pointermove', onGlobalPointerMove, { passive: false });
    window.addEventListener('pointerup', onGlobalPointerUp, { passive: false });
    window.addEventListener('pointercancel', onGlobalPointerCancel, { passive: false });
    window.addEventListener('touchmove', onGlobalTouchMove, { passive: false });
  };

  const currentList = customLists.find((l) => l.id === activeListType);
  const currentListName = isGroceryList ? 'Grocery List' : currentList?.title || 'Checklist';
  const currentListIcon = isGroceryList ? '🛒' : currentList?.icon || '📋';

  const isDraggingAny = Boolean(draggingAisleId);

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 pt-3 pb-28 md:pb-20 space-y-4">
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

        {/* Add Dropdown Menu */}
        <div className="relative" ref={addMenuRef}>
          <button
            type="button"
            onClick={() => setIsAddMenuOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer shrink-0"
            title="Add options"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add</span>
            <ChevronDown
              className={`w-3.5 h-3.5 stroke-[2.5] transition-transform duration-200 ${
                isAddMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isAddMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900/95 backdrop-blur-xl rounded-2xl p-1.5 shadow-2xl z-50 border border-white/15 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  setIsAddMenuOpen(false);
                  quickAddInputRef.current?.focus();
                  quickAddInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-emerald-400 transition-colors cursor-pointer text-left"
              >
                <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Add Item</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAddMenuOpen(false);
                  setIsNewCategoryModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-emerald-400 transition-colors cursor-pointer text-left"
              >
                <FolderPlus className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Add Category</span>
              </button>

              <div className="my-1 border-t border-white/5" />

              <button
                type="button"
                onClick={() => {
                  setIsAddMenuOpen(false);
                  setIsNewListModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-emerald-400 transition-colors cursor-pointer text-left"
              >
                <ListPlus className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Add List</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sleek, Full-Width List Header (same size as meals navigation) */}
      <div className="relative z-30 w-full" ref={dropdownRef}>
        <div className="relative w-full">
          <button
            type="button"
            onClick={() => setIsListDropdownOpen(!isListDropdownOpen)}
            className="w-full min-h-[38px] flex items-center justify-between bg-slate-900/80 hover:bg-slate-850 border border-white/10 hover:border-emerald-500/40 px-3 py-1.5 rounded-xl transition-all group shadow-md cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base shrink-0 leading-none">{currentListIcon}</span>
              <span className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                {currentListName}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isLoading && items.length === 0 ? (
                <span className="text-[10px] bg-slate-800/80 text-slate-400 font-mono px-2 py-0.5 rounded-full border border-white/10 font-semibold animate-pulse">
                  loading...
                </span>
              ) : (
                <span className="text-[10px] bg-emerald-500/15 text-emerald-400 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                  {activeItems.length} {activeItems.length === 1 ? 'item' : 'items'}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform duration-200 ${
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

      {/* Inline Quick Add Bar with Autocomplete (same height as recipe filter: h-8, rounded-xl) */}
      <div className="relative z-20">
        <form
          onSubmit={handleAddItem}
          className="h-8 flex items-center gap-1.5 bg-slate-900/90 border border-white/10 hover:border-white/20 focus-within:border-emerald-500/50 rounded-xl px-1.5 transition-all shadow-md"
        >
          <div className="w-5 h-5 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 text-emerald-400">
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <input
            ref={quickAddInputRef}
            type="text"
            placeholder={`Add to ${currentListName}...`}
            value={newItemName}
            onChange={(e) => {
              setNewItemName(e.target.value);
              setIsAutocompleteDismissed(false);
              setSelectedSuggestionIndex(-1);
            }}
            onKeyDown={handleInputKeyDown}
            disabled={isAddingItem}
            className="flex-1 min-w-0 bg-transparent border-none text-xs text-white placeholder-slate-500 focus:outline-none py-1 px-1 font-medium"
          />
          {newItemName && (
            <button
              type="button"
              onClick={() => {
                setNewItemName('');
                setIsAutocompleteDismissed(true);
              }}
              className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
              title="Clear input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="submit"
            disabled={!newItemName.trim() || isAddingItem}
            className="h-6 px-2.5 sm:px-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all shadow-md shadow-emerald-500/20 shrink-0 active:scale-95 cursor-pointer"
            title="Add item"
          >
            {isAddingItem ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Plus className="w-3 h-3 stroke-[2.5]" />
            )}
            <span>{isAddingItem ? 'Adding...' : 'Add'}</span>
          </button>
        </form>

        {/* Autocomplete Suggestions Dropdown Popover */}
        {matchingSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900/95 backdrop-blur-xl border border-white/15 rounded-2xl p-1.5 shadow-2xl shadow-black/80 max-h-56 overflow-y-auto z-40 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between border-b border-white/5 pb-1.5 mb-1">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Previously Added</span>
              </span>
              <span className="text-[9px] text-slate-500 font-normal">Tap or press Enter to add</span>
            </div>
            <div className="space-y-0.5">
              {matchingSuggestions.map((sug, idx) => {
                const isSelected = idx === selectedSuggestionIndex;
                const aisle = effectiveAisles.find((a) => a.id === sug.aisleId);
                return (
                  <button
                    key={`${sug.name}-${sug.aisleId}-${idx}`}
                    type="button"
                    onClick={() => handleAddSuggestion(sug)}
                    onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                      isSelected ? 'bg-emerald-500/20 text-white' : 'hover:bg-white/5 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold truncate">{sug.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium border flex items-center gap-1 shrink-0"
                        style={{
                          borderColor: aisle?.color ? `${aisle.color}40` : 'rgba(255,255,255,0.1)',
                          backgroundColor: aisle?.color ? `${aisle.color}15` : 'rgba(255,255,255,0.05)',
                          color: aisle?.color || '#34d399',
                        }}
                      >
                        <span>{aisle?.icon || '🛒'}</span>
                        <span>{sug.category || aisle?.name || 'Grocery'}</span>
                      </span>
                      <div className="w-5 h-5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 flex items-center justify-center transition-colors">
                        <Plus className="w-3 h-3 stroke-[2.5]" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
              Add items using the bar above or speak to your voice assistant!
            </p>
          </div>
        ) : null}

        {/* If List has Categories: Display Grouped by Categories / Aisles */}
        {hasCategories && itemsByAisle.length > 1 && (
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

        {hasCategories &&
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
            const isItemHovered = Boolean(
              draggingItem &&
              hoveredAisleId === aisle.id &&
              sourceAisleIdRef.current !== aisle.id
            );

            return (
              <div
                key={aisle.id}
                data-category-drop-id={aisle.id}
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
                className={`glass-panel rounded-3xl border overflow-hidden relative transition-all duration-200 ${
                  isDragging
                    ? 'border-emerald-400 ring-2 ring-emerald-400/80 shadow-2xl shadow-emerald-950/90 scale-[1.02] bg-slate-900/98 z-50 opacity-95'
                    : isItemHovered
                    ? 'border-emerald-400 ring-2 ring-emerald-500/60 bg-emerald-500/10 scale-[1.01] shadow-lg shadow-emerald-950/50'
                    : 'border-white/10 shadow-sm'
                }`}
              >
                {/* Aisle Category Header */}
                <div
                  className={`w-full flex items-center justify-between px-3 py-2.5 sm:px-3.5 sm:py-3 border-b border-white/5 transition-colors select-none ${
                    isDragging
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : isItemHovered
                      ? 'bg-emerald-500/20 border-emerald-500/40'
                      : 'bg-slate-900/40 hover:bg-slate-900/60'
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
                      {isItemHovered ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/30 border border-emerald-400/50 px-2 py-0.5 rounded-full animate-pulse shrink-0">
                          Drop here
                        </span>
                      ) : isDragging ? (
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
                    {aisleItems.length === 0 ? (
                      <div className="px-4 py-3.5 text-center text-xs text-slate-500 italic">
                        No items in this category yet.
                      </div>
                    ) : (
                      aisleItems.map((item) => {
                        const isCrossing = Boolean(crossingOffIds[item.id]);
                        const isChecked = item.is_completed || isCrossing;
                        const isThisItemDragging = draggingItem?.id === item.id;
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleToggleItem(item.id)}
                            onPointerDown={(e) => handleItemPointerDown(e, item, aisle.id)}
                            className={`flex items-center justify-between px-3.5 py-2 transition-all cursor-pointer group hover:bg-white/5 gap-2 min-h-[42px] select-none touch-manipulation ${
                              isCrossing ? 'animate-row-crossing' : ''
                            } ${
                              isThisItemDragging ? 'opacity-30 bg-emerald-500/10 border border-dashed border-emerald-500/40 rounded-xl' : ''
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
                              {effectiveAisles.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMovingItem(item);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 opacity-40 group-hover:opacity-100 transition-all"
                                  title={isGroceryList ? "Move to another aisle" : "Move to another category"}
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5" />
                                </button>
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
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}

        {/* Uncategorized Items (if list has categories) */}
        {hasCategories && uncategorizedItems.length > 0 && (
          <div
            data-category-drop-id="uncategorized"
            ref={(el) => {
              if (el) cardElementsRef.current.set('uncategorized', el);
              else cardElementsRef.current.delete('uncategorized');
            }}
            className={`glass-panel rounded-3xl border overflow-hidden shadow-sm transition-all duration-200 ${
              draggingItem && hoveredAisleId === 'uncategorized' && sourceAisleIdRef.current !== 'uncategorized'
                ? 'border-emerald-400 ring-2 ring-emerald-500/60 bg-emerald-500/10 scale-[1.01] shadow-lg shadow-emerald-950/50'
                : 'border-white/10'
            }`}
          >
            <div
              className={`flex items-center justify-between px-3.5 py-2.5 border-b border-white/5 transition-colors ${
                draggingItem && hoveredAisleId === 'uncategorized' && sourceAisleIdRef.current !== 'uncategorized'
                  ? 'bg-emerald-500/20 border-emerald-500/40'
                  : 'bg-slate-900/40'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-600 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
                  Other / Uncategorized
                </span>
                <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded-full text-slate-400 shrink-0">
                  {uncategorizedItems.length}
                </span>
              </div>
              {draggingItem && hoveredAisleId === 'uncategorized' && sourceAisleIdRef.current !== 'uncategorized' && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/30 border border-emerald-400/50 px-2 py-0.5 rounded-full animate-pulse shrink-0">
                  Drop here
                </span>
              )}
            </div>
            <div className="divide-y divide-white/5">
              {uncategorizedItems.map((item) => {
                const isCrossing = Boolean(crossingOffIds[item.id]);
                const isChecked = item.is_completed || isCrossing;
                const isThisItemDragging = draggingItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggleItem(item.id)}
                    onPointerDown={(e) => handleItemPointerDown(e, item, 'uncategorized')}
                    className={`flex items-center justify-between px-3.5 py-2 hover:bg-white/5 transition-all cursor-pointer group gap-2 min-h-[42px] select-none touch-manipulation ${
                      isCrossing ? 'animate-row-crossing' : ''
                    } ${
                      isThisItemDragging ? 'opacity-30 bg-emerald-500/10 border border-dashed border-emerald-500/40 rounded-xl' : ''
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
                      {effectiveAisles.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMovingItem(item);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 opacity-40 group-hover:opacity-100 transition-all"
                          title={isGroceryList ? "Move to an aisle" : "Move to a category"}
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
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

        {/* Uncategorized Drop Target when empty */}
        {hasCategories && uncategorizedItems.length === 0 && draggingItem && sourceAisleIdRef.current !== 'uncategorized' && (
          <div
            data-category-drop-id="uncategorized"
            ref={(el) => {
              if (el) cardElementsRef.current.set('uncategorized', el);
              else cardElementsRef.current.delete('uncategorized');
            }}
            className={`rounded-3xl border border-dashed p-4 text-center transition-all duration-200 ${
              hoveredAisleId === 'uncategorized'
                ? 'border-emerald-400 ring-2 ring-emerald-500/60 bg-emerald-500/15 scale-[1.01]'
                : 'border-white/20 bg-slate-900/30'
            }`}
          >
            <p className={`text-xs font-bold uppercase tracking-wider ${
              hoveredAisleId === 'uncategorized' ? 'text-emerald-300' : 'text-slate-400'
            }`}>
              {hoveredAisleId === 'uncategorized' ? 'Drop here to remove category' : 'Drop here to move to Uncategorized'}
            </p>
          </div>
        )}

        {/* Non-Categorized List: Display as Simple Flat Checklist */}
        {!hasCategories && activeItems.length > 0 && (
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

          {effectiveAisles.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {isGroceryList ? 'Store Aisle / Category' : 'Category / Section'}
              </label>
              <select
                value={editAisleId}
                onChange={(e) => setEditAisleId(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">Uncategorized / Other</option>
                {effectiveAisles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-emerald-400/80 mt-1.5 flex items-center gap-1 font-medium">
                <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>FamKit will remember this category for next time you add this item.</span>
              </p>
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

      {/* Quick Move Aisle Drawer */}
      <Drawer
        isOpen={Boolean(movingItem)}
        onClose={() => setMovingItem(null)}
        title="Move to Aisle"
        subtitle={movingItem ? `Choose where "${movingItem.name}" belongs. FamKit will remember this for next time.` : undefined}
        icon={<ArrowRightLeft className="w-5 h-5 text-emerald-400" />}
      >
        <div className="space-y-1.5 py-1">
          {effectiveAisles.map((aisle) => (
            <button
              key={aisle.id}
              onClick={() => handleQuickMoveItem(aisle.id)}
              className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left cursor-pointer ${
                movingItem?.aisle_id === aisle.id
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                  : 'bg-slate-900/60 border-white/5 hover:border-white/20 text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{aisle.icon || '🛒'}</span>
                <span className="font-semibold text-sm">{aisle.name}</span>
              </div>
              {movingItem?.aisle_id === aisle.id && (
                <Check className="w-4 h-4 text-emerald-400" />
              )}
            </button>
          ))}
        </div>
      </Drawer>

      {/* New Category Drawer */}
      <Drawer
        isOpen={isNewCategoryModalOpen}
        onClose={() => setIsNewCategoryModalOpen(false)}
        title={`Add Category to ${currentListName}`}
        subtitle={`Organize items in ${currentListName} into sections`}
        icon={<FolderPlus className="w-5 h-5 text-emerald-400" />}
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsNewCategoryModalOpen(false)}
              className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-category-form"
              disabled={!newCategoryName.trim() || isCreatingCategory}
              className="min-h-[40px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5"
            >
              {isCreatingCategory && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isCreatingCategory ? 'Creating...' : 'Create Category'}</span>
            </button>
          </div>
        }
      >
        <form id="create-category-form" onSubmit={handleCreateCategory} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Category Name
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder={isGroceryList ? "e.g. Snacks, Beverages, Frozen..." : "e.g. Clothing, Toiletries, Electronics..."}
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Icon / Emoji
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              {['📁', '🛒', '🍎', '🥩', '🍞', '🥛', '🥫', '🧹', '🎒', '👕', '💊', '🏷️', '🔧', '📦'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setNewCategoryIcon(emoji)}
                  className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition-all cursor-pointer ${
                    newCategoryIcon === emoji
                      ? 'border-emerald-500 bg-emerald-500/20 shadow-sm'
                      : 'border-white/10 bg-slate-950/60 hover:border-white/20'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
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
            placeholder="e.g. Costco, Home Depot, Camping Gear..."
            value={newListTitle}
            onChange={(e) => setNewListTitle(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </form>
      </Drawer>

      {/* Floating Drag Preview for List Item (Y-axis locked to list width) */}
      {draggingItem && dragRowLayout && (
        <div
          style={{
            position: 'fixed',
            left: `${dragRowLayout.left}px`,
            width: `${dragRowLayout.width}px`,
            top: `${dragPointerPos.y - dragRowLayout.offsetY}px`,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          className="flex items-center justify-between px-3.5 py-2 rounded-2xl bg-slate-900/98 border-2 border-emerald-400 text-white shadow-2xl shadow-emerald-950/90 backdrop-blur-md select-none"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-5 h-5 rounded-md border border-emerald-500/60 bg-emerald-500/20 flex items-center justify-center shrink-0">
              <GripVertical className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold truncate text-white">
                  {draggingItem.name}
                </span>
                {draggingItem.quantity && (
                  <span className="text-xs font-mono text-slate-400 shrink-0">
                    ({draggingItem.quantity}{draggingItem.unit ? ` ${draggingItem.unit}` : ''})
                  </span>
                )}
              </div>
              {draggingItem.notes && (
                <p className="text-[11px] text-emerald-400/80 truncate leading-tight mt-0.5">
                  {draggingItem.notes}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 rounded-full">
              Moving
            </span>
          </div>
        </div>
      )}

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
};
