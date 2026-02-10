import {
  Rocket,
  Target,
  Flag,
  Star,
  Zap,
  Heart,
  Trophy,
  Shield,
  Flame,
  Crown,
  Compass,
  Gem,
  Mountain,
  Sparkles,
  Sun,
  Moon,
  Globe,
  Lightbulb,
  Megaphone,
  Bookmark,
  Bolt,
  Anchor,
  Puzzle,
  Palette,
  Package,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  rocket: Rocket,
  target: Target,
  flag: Flag,
  star: Star,
  zap: Zap,
  heart: Heart,
  trophy: Trophy,
  shield: Shield,
  flame: Flame,
  crown: Crown,
  compass: Compass,
  gem: Gem,
  mountain: Mountain,
  sparkles: Sparkles,
  sun: Sun,
  moon: Moon,
  globe: Globe,
  lightbulb: Lightbulb,
  megaphone: Megaphone,
  bookmark: Bookmark,
  bolt: Bolt,
  anchor: Anchor,
  puzzle: Puzzle,
  palette: Palette,
  package: Package,
};

export const MILESTONE_ICONS = Object.keys(ICON_MAP);

export function getMilestoneIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Rocket;
}

interface MilestoneIconProps {
  name: string;
  className?: string;
}

export function MilestoneIcon({ name, className }: MilestoneIconProps) {
  const Icon = getMilestoneIcon(name);
  return <Icon className={className} />;
}
