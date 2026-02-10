'use client';

import { useTheme } from 'next-themes';
import { Willow, WillowDark } from '@svar-ui/react-gantt';

interface SVARThemeWrapperProps {
  children: React.ReactNode;
}

/**
 * Theme wrapper that provides light/dark mode support for SVAR Gantt components
 * Uses next-themes to detect current theme and applies appropriate SVAR theme
 * Wraps with timeline-theme-wrapper class to apply tweakcn CSS variable overrides
 */
export function SVARThemeWrapper({ children }: SVARThemeWrapperProps) {
  const { resolvedTheme } = useTheme();
  const ThemeComponent = resolvedTheme === 'dark' ? WillowDark : Willow;

  return (
    <div className="timeline-theme-wrapper">
      <ThemeComponent fonts={false}>
        {children}
      </ThemeComponent>
    </div>
  );
}
