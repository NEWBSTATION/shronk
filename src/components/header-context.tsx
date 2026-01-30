"use client";

import { createContext, useContext, useState, useCallback, ReactNode, ReactElement } from "react";

interface Breadcrumb {
  label: string;
  onClick?: () => void;
}

interface HeaderContextType {
  breadcrumbs: Breadcrumb[];
  setBreadcrumbs: (breadcrumbs: Breadcrumb[]) => void;
  clearBreadcrumbs: () => void;
  headerAction: ReactElement | null;
  setHeaderAction: (action: ReactElement | null) => void;
  clearHeaderAction: () => void;
}

const HeaderContext = createContext<HeaderContextType | null>(null);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [breadcrumbs, setBreadcrumbsState] = useState<Breadcrumb[]>([]);
  const [headerAction, setHeaderActionState] = useState<ReactElement | null>(null);

  const setBreadcrumbs = useCallback((newBreadcrumbs: Breadcrumb[]) => {
    setBreadcrumbsState(newBreadcrumbs);
  }, []);

  const clearBreadcrumbs = useCallback(() => {
    setBreadcrumbsState([]);
  }, []);

  const setHeaderAction = useCallback((action: ReactElement | null) => {
    setHeaderActionState(action);
  }, []);

  const clearHeaderAction = useCallback(() => {
    setHeaderActionState(null);
  }, []);

  return (
    <HeaderContext.Provider value={{
      breadcrumbs,
      setBreadcrumbs,
      clearBreadcrumbs,
      headerAction,
      setHeaderAction,
      clearHeaderAction,
    }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error("useHeader must be used within a HeaderProvider");
  }
  return context;
}
