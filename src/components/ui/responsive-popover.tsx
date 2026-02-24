"use client";

import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

/**
 * Shared context so children always match the parent's mobile/desktop decision.
 * This prevents the DrawerTrigger-outside-Drawer crash that occurs when
 * independent useIsMobile() calls resolve at different times.
 */
const ResponsivePopoverContext = React.createContext(false);

/* Root — wraps Popover on desktop, Drawer on mobile */
function ResponsivePopover({
  children,
  ...props
}: React.ComponentProps<typeof Popover>) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <ResponsivePopoverContext.Provider value={true}>
        <Drawer {...props}>{children}</Drawer>
      </ResponsivePopoverContext.Provider>
    );
  }

  return (
    <ResponsivePopoverContext.Provider value={false}>
      <Popover {...props}>{children}</Popover>
    </ResponsivePopoverContext.Provider>
  );
}

/* Trigger — delegates to PopoverTrigger or DrawerTrigger */
function ResponsivePopoverTrigger({
  children,
  ...props
}: React.ComponentProps<typeof PopoverTrigger>) {
  const isMobile = React.useContext(ResponsivePopoverContext);

  if (isMobile) {
    return <DrawerTrigger {...props}>{children}</DrawerTrigger>;
  }

  return <PopoverTrigger {...props}>{children}</PopoverTrigger>;
}

/* Content — PopoverContent on desktop, DrawerContent on mobile */
interface ResponsivePopoverContentProps
  extends React.ComponentPropsWithoutRef<typeof PopoverContent> {
  /** Title shown in the drawer header on mobile (optional) */
  title?: string;
}

const ResponsivePopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverContent>,
  ResponsivePopoverContentProps
>(({ className, children, title, align, side, sideOffset, onOpenAutoFocus, ...props }, ref) => {
  const isMobile = React.useContext(ResponsivePopoverContext);

  if (isMobile) {
    return (
      <DrawerContent>
        {title && (
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
        )}
        <div
          className={cn("px-4 pb-6", className)}
          {...props}
        >
          {children}
        </div>
      </DrawerContent>
    );
  }

  return (
    <PopoverContent
      ref={ref}
      className={className}
      align={align}
      side={side}
      sideOffset={sideOffset}
      onOpenAutoFocus={onOpenAutoFocus}
      {...props}
    >
      {children}
    </PopoverContent>
  );
});
ResponsivePopoverContent.displayName = "ResponsivePopoverContent";

export {
  ResponsivePopover,
  ResponsivePopoverTrigger,
  ResponsivePopoverContent,
};
