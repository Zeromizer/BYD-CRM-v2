/**
 * Milestone Icon Utilities
 *
 * Shared milestone icon components and helpers.
 */

import { Car, Handshake, ClipboardCheck, Package, Star } from 'lucide-react';

const iconComponents = { Car, Handshake, ClipboardCheck, Package, Star };

export type MilestoneIconName = keyof typeof iconComponents;

/**
 * Get milestone icon component by name
 */
export function getMilestoneIcon(
  iconName: string,
  size = 16,
  color = 'currentColor'
): React.ReactNode {
  const IconComponent = iconComponents[iconName as MilestoneIconName];
  return IconComponent ? <IconComponent size={size} color={color} strokeWidth={2} /> : null;
}

/**
 * Checkmark SVG for completed states
 */
export function CheckmarkIcon({ size = 12, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
