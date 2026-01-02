/**
 * Milestone Icon Utilities
 *
 * Shared milestone icon components and helpers using Phosphor Icons.
 */

import { Car, Handshake, ClipboardText, Package, Star, Check } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

const iconMap: Record<string, Icon> = {
  Car,
  Handshake,
  ClipboardCheck: ClipboardText,
  Package,
  Star,
};

export type MilestoneIconName = keyof typeof iconMap;

/**
 * Get milestone icon component by name
 */
export function getMilestoneIcon(
  iconName: string,
  size = 16,
  color = 'currentColor'
): React.ReactNode {
  const IconComponent = iconMap[iconName];
  return IconComponent ? (
    <IconComponent size={size} color={color} weight="fill" />
  ) : null;
}

/**
 * Checkmark icon for completed states
 */
export function CheckmarkIcon({ size = 12, color = 'white' }: { size?: number; color?: string }) {
  return <Check size={size} color={color} weight="bold" />;
}
