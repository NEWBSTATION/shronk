import { useCallback } from "react";
import { toast } from "sonner";
import { useUndoStore } from "@/store/undo-store";

interface ShowUndoToastOptions {
  description: string;
  undo: () => Promise<void>;
  /** Push to undo store (for Ctrl+Z) but skip the visual toast */
  silent?: boolean;
}

export function useUndoToast() {
  const push = useUndoStore((s) => s.push);

  const showUndoToast = useCallback(
    ({ description, undo, silent }: ShowUndoToastOptions) => {
      if (silent) {
        push({ description, undo });
        return;
      }

      let entryId: string | undefined;

      const toastId = toast(description, {
        action: {
          label: "Undo",
          onClick: async () => {
            const { stack } = useUndoStore.getState();
            const entry = stack.find((e) => e.id === entryId);
            if (entry) {
              useUndoStore.setState({
                stack: stack.filter((e) => e.id !== entry.id),
              });
              try {
                await entry.undo();
              } catch {
                toast.error("Undo failed");
              }
            }
          },
        },
        duration: 5000,
      });

      entryId = push({ description, undo, toastId });
    },
    [push]
  );

  return showUndoToast;
}
