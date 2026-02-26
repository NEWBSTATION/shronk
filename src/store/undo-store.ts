import { create } from "zustand";

const MAX_STACK_SIZE = 20;
const STALE_MS = 5 * 60 * 1000; // 5 minutes

let nextId = 1;

export interface UndoEntry {
  id: string;
  description: string;
  undo: () => Promise<void>;
  timestamp: number;
  toastId?: string | number;
}

interface UndoStore {
  stack: UndoEntry[];
  isUndoing: boolean;
  push: (entry: Omit<UndoEntry, "id" | "timestamp">) => string;
  undo: () => Promise<UndoEntry | null>;
  clear: () => void;
}

export const useUndoStore = create<UndoStore>((set, get) => ({
  stack: [],
  isUndoing: false,

  push: (entry) => {
    const id = `undo-${nextId++}`;
    const now = Date.now();
    set((state) => {
      // Prune stale entries
      const fresh = state.stack.filter((e) => now - e.timestamp < STALE_MS);
      const next = [{ ...entry, id, timestamp: now }, ...fresh].slice(
        0,
        MAX_STACK_SIZE
      );
      return { stack: next };
    });
    return id;
  },

  undo: async () => {
    const { stack, isUndoing } = get();
    if (isUndoing) return null;

    // Find first non-stale entry
    const now = Date.now();
    const idx = stack.findIndex((e) => now - e.timestamp < STALE_MS);
    if (idx === -1) {
      set({ stack: [] });
      return null;
    }

    const entry = stack[idx];
    // Remove this entry and all stale ones before it
    const remaining = stack.slice(idx + 1);

    set({ isUndoing: true, stack: remaining });
    try {
      await entry.undo();
      return entry;
    } finally {
      set({ isUndoing: false });
    }
  },

  clear: () => set({ stack: [] }),
}));
