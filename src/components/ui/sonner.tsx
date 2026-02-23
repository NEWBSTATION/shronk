"use client"

import { useEffect, useState } from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useThemeStore } from "@/store/theme-store"
import { usePreferencesStore } from "@/store/preferences-store"

const MD_BREAKPOINT = 768

const Toaster = ({ ...props }: ToasterProps) => {
  const { getResolvedMode } = useThemeStore()
  const resolvedMode = getResolvedMode()
  const toastPosition = usePreferencesStore((s) => s.toastPosition)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < MD_BREAKPOINT)
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  // On small screens, force bottom-center regardless of preference
  const position = isMobile ? "bottom-center" : toastPosition

  return (
    <Sonner
      theme={resolvedMode as ToasterProps["theme"]}
      className="toaster group"
      position={position}
      mobileOffset={{ bottom: 16 }}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--width": "356px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
