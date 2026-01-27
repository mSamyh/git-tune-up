import { Clock, Ban, CalendarCheck, UserPlus } from "lucide-react";

/**
 * Centralized status color configuration for donor availability
 * Ensures consistent visual representation across all components
 */

export const STATUS_COLORS = {
  available: {
    bg: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/50",
    badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  unavailable: {
    bg: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    ring: "ring-red-500/50",
    badge: "bg-red-500/10 text-red-600 border-red-500/20",
  },
  reserved: {
    bg: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-500/50",
    badge: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  available_soon: {
    bg: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/50",
    badge: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  unregistered: {
    bg: "bg-muted-foreground/30",
    text: "text-muted-foreground",
    ring: "ring-muted-foreground/30",
    badge: "bg-muted text-muted-foreground border-muted-foreground/20",
  },
} as const;

export type StatusType = keyof typeof STATUS_COLORS;

export interface StatusConfig {
  color: string;
  textColor: string;
  ringColor: string;
  icon: React.ReactNode | null;
  label: string;
}

/**
 * Get status configuration for a donor
 */
export const getStatusConfig = (
  status: string | null | undefined,
  options?: {
    isRegistered?: boolean;
    lastDonationDate?: string | null;
    availableDate?: string | null;
    reservedUntil?: string | null;
  }
): StatusConfig => {
  const { isRegistered = true, lastDonationDate, availableDate, reservedUntil } = options || {};

  // Handle unregistered donors
  if (!isRegistered) {
    return {
      color: STATUS_COLORS.unregistered.bg,
      textColor: STATUS_COLORS.unregistered.text,
      ringColor: STATUS_COLORS.unregistered.ring,
      icon: null, // UserPlus icon handled by component
      label: "Not registered",
    };
  }

  const effectiveStatus = status || 'available';

  switch (effectiveStatus) {
    case 'available':
      return {
        color: STATUS_COLORS.available.bg,
        textColor: STATUS_COLORS.available.text,
        ringColor: STATUS_COLORS.available.ring,
        icon: null,
        label: "Available",
      };

    case 'unavailable':
      // Check if they're in the 90-day cooldown period
      if (lastDonationDate) {
        const daysSinceLastDonation = Math.floor(
          (new Date().getTime() - new Date(lastDonationDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceLastDonation < 90) {
          const daysUntil = 90 - daysSinceLastDonation;
          return {
            color: STATUS_COLORS.available_soon.bg,
            textColor: STATUS_COLORS.available_soon.text,
            ringColor: STATUS_COLORS.available_soon.ring,
            icon: null, // Clock icon
            label: `${daysUntil}d`,
          };
        }
      }
      return {
        color: STATUS_COLORS.unavailable.bg,
        textColor: STATUS_COLORS.unavailable.text,
        ringColor: STATUS_COLORS.unavailable.ring,
        icon: null, // Ban icon
        label: "Unavailable",
      };

    case 'available_soon':
      const daysUntil = availableDate
        ? Math.ceil((new Date(availableDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        color: STATUS_COLORS.available_soon.bg,
        textColor: STATUS_COLORS.available_soon.text,
        ringColor: STATUS_COLORS.available_soon.ring,
        icon: null,
        label: `${daysUntil}d`,
      };

    case 'reserved':
      let label = "Reserved";
      if (reservedUntil) {
        const date = new Date(reservedUntil);
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });
        const year = date.getFullYear();
        label = `Reserved for ${monthName} ${year}`;
      }
      return {
        color: STATUS_COLORS.reserved.bg,
        textColor: STATUS_COLORS.reserved.text,
        ringColor: STATUS_COLORS.reserved.ring,
        icon: null,
        label,
      };

    default:
      return {
        color: STATUS_COLORS.unavailable.bg,
        textColor: STATUS_COLORS.unavailable.text,
        ringColor: STATUS_COLORS.unavailable.ring,
        icon: null,
        label: "Unavailable",
      };
  }
};

/**
 * Get badge styling for status display
 */
export const getStatusBadgeClass = (status: string | null | undefined): string => {
  const effectiveStatus = status || 'available';
  
  switch (effectiveStatus) {
    case 'available':
      return STATUS_COLORS.available.badge;
    case 'reserved':
      return STATUS_COLORS.reserved.badge;
    case 'available_soon':
    case 'unavailable':
      return STATUS_COLORS.available_soon.badge;
    default:
      return STATUS_COLORS.unavailable.badge;
  }
};
