# Theming Guardrails for Shronk

This document establishes guardrails for maintaining consistency with the tweakcn theming system throughout the Shronk application.

## Core Principles

1. **Use tweakcn-compatible CSS variables** - All colors, spacing, and design tokens must use the CSS variables defined in `globals.css` that are compatible with tweakcn's theming system.

2. **Never hardcode colors** - Always use semantic color classes like `bg-primary`, `text-muted-foreground`, etc. Never use arbitrary color values like `bg-blue-500` or `text-[#333]`.

3. **Respect light/dark mode** - Every component must work correctly in both light and dark modes. The mode is controlled by the `dark` class on the root element.

## CSS Variable Structure

The theming system uses these CSS variable categories:

### Core Colors
- `--background` / `--foreground` - Main page colors
- `--card` / `--card-foreground` - Card component colors
- `--popover` / `--popover-foreground` - Popover/dropdown colors
- `--primary` / `--primary-foreground` - Primary action colors
- `--secondary` / `--secondary-foreground` - Secondary action colors
- `--muted` / `--muted-foreground` - Muted/disabled colors
- `--accent` / `--accent-foreground` - Accent highlight colors
- `--destructive` / `--destructive-foreground` - Error/destructive action colors

### Sidebar Colors
- `--sidebar` / `--sidebar-foreground` - Sidebar background/text
- `--sidebar-primary` / `--sidebar-primary-foreground` - Sidebar primary colors
- `--sidebar-accent` / `--sidebar-accent-foreground` - Sidebar accent colors
- `--sidebar-border` / `--sidebar-ring` - Sidebar border/focus colors

### Utility Colors
- `--border` - Border color
- `--input` - Input background color
- `--ring` - Focus ring color
- `--chart-1` through `--chart-5` - Chart colors

### Design Tokens
- `--radius` - Border radius base value
- `--font-sans`, `--font-mono`, `--font-serif` - Typography
- `--letter-spacing` - Letter spacing

## Adding New Themes

To add a new theme:

1. **Create the theme at tweakcn.com** - Visit https://tweakcn.com to visually create your theme
2. **Export the theme** - Copy the generated theme styles
3. **Add to theme-presets.ts** - Add the new preset to `src/config/theme-presets.ts`

Example:
```typescript
"my-custom-theme": {
  label: "My Custom Theme",
  styles: {
    light: {
      background: "#ffffff",
      foreground: "#000000",
      // ... all other variables
    },
    dark: {
      background: "#000000",
      foreground: "#ffffff",
      // ... all other variables
    },
  },
},
```

## Component Guidelines

### Using Color Classes
```tsx
// ✅ Good - uses semantic colors
<div className="bg-background text-foreground">
<button className="bg-primary text-primary-foreground">

// ❌ Bad - hardcoded colors
<div className="bg-white text-black">
<button className="bg-blue-600 text-white">
```

### Border Radius
```tsx
// ✅ Good - uses radius variables
<div className="rounded-lg"> // Uses --radius-lg
<div className="rounded-md"> // Uses --radius-md

// ❌ Bad - hardcoded radius
<div className="rounded-[12px]">
```

### Shadows
```tsx
// ✅ Good - uses theme-aware shadows
<div className="shadow-sm">

// ❌ Bad - hardcoded shadow colors
<div className="shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
```

## Files to Reference

- `src/app/globals.css` - CSS variable definitions
- `src/config/theme-presets.ts` - Theme preset definitions
- `src/store/theme-store.ts` - Theme state management
- `src/components/theme-selector.tsx` - Theme selection UI
- `src/lib/theme-utils.ts` - Theme application utilities

## Testing Themes

When making UI changes:
1. Test with multiple themes from the theme selector
2. Test both light and dark modes
3. Ensure text is readable with proper contrast
4. Verify interactive states (hover, focus, active) work correctly

## Resources

- **tweakcn**: https://tweakcn.com - Visual theme editor
- **shadcn/ui**: https://ui.shadcn.com - Component documentation
- **Tailwind CSS**: https://tailwindcss.com - Utility classes reference
