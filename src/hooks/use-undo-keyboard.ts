import { useEffect } from "react";
import { toast } from "sonner";
import { useUndoStore } from "@/store/undo-store";

export function useUndoKeyboard() {
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      // Only Cmd+Z / Ctrl+Z (not Shift — no redo)
      if (!(e.metaKey || e.ctrlKey) || e.key !== "z" || e.shiftKey) return;

      // Skip when inside input fields
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      e.preventDefault();

      const { stack, isUndoing } = useUndoStore.getState();
      if (isUndoing) return;

      if (stack.length === 0) {
        toast.info("Nothing to undo");
        return;
      }

      // Dismiss the associated toast before executing undo
      const top = stack[0];
      if (top.toastId) {
        toast.dismiss(top.toastId);
      }

      const entry = await useUndoStore.getState().undo();
      if (!entry) {
        toast.info("Nothing to undo");
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}
