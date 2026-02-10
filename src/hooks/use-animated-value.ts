import { useEffect, useRef, useState } from "react";

/**
 * Returns the value immediately when it becomes truthy,
 * but delays clearing by `duration` ms when it becomes falsy —
 * keeping content visible during CSS exit transitions.
 */
export function useAnimatedValue<T>(value: T, duration = 300): T {
  const [displayValue, setDisplayValue] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (value) {
      clearTimeout(timeoutRef.current);
      setDisplayValue(value);
    } else {
      timeoutRef.current = setTimeout(() => {
        setDisplayValue(value);
      }, duration);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [value, duration]);

  return displayValue;
}
