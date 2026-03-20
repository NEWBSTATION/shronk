"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AIProvider = "anthropic" | "openai";

interface AIStore {
  // Panel state
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;

  // Provider settings (persisted)
  provider: AIProvider;
  setProvider: (provider: AIProvider) => void;
  anthropicKey: string;
  setAnthropicKey: (key: string) => void;
  openaiKey: string;
  setOpenaiKey: (key: string) => void;

  // Settings panel
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
}

export const useAIStore = create<AIStore>()(
  persist(
    (set) => ({
      isOpen: false,
      setIsOpen: (open) => set({ isOpen: open }),
      toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),

      provider: "anthropic",
      setProvider: (provider) => set({ provider }),
      anthropicKey: "",
      setAnthropicKey: (anthropicKey) => set({ anthropicKey }),
      openaiKey: "",
      setOpenaiKey: (openaiKey) => set({ openaiKey }),

      showSettings: false,
      setShowSettings: (showSettings) => set({ showSettings }),
    }),
    {
      name: "shronk-ai-storage",
      partialize: (state) => ({
        provider: state.provider,
        anthropicKey: state.anthropicKey,
        openaiKey: state.openaiKey,
      }),
    }
  )
);
