
# Rewards Page Redesign & Status Duration Enhancement

## Overview

This plan covers two major enhancements:
1. **Redesign Rewards Page**: Transform the popup dialog into a dedicated full-page rewards experience at `/rewards`
2. **Enhanced Availability Status**: Add time-based duration options for "Unavailable" and automatic reversion for "Reserved" with 90-day rule integration

---

## Part 1: Rewards Page Redesign

### Current State
- Rewards are displayed in a Dialog popup triggered from Profile page
- Content is cramped in a modal with scrolling
- All sections (Points, Achievements, Rewards, Vouchers, History) are collapsible

### New Design: Full-Page Rewards Experience

**Route:** `/rewards`

**Layout Structure:**
```text
┌─────────────────────────────────────────────┐
│  🎁 My Rewards                    [← Back]  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─ Points Card ────────────────────────┐   │
│  │  🏆 1,250 points         Gold Member │   │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━       │   │
│  │  850 pts to Platinum                 │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─ Tab Navigation ─────────────────────┐   │
│  │ [🎁 Rewards] [🎫 Vouchers] [📊 Stats]│   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─ Rewards Tab Content ────────────────┐   │
│  │                                      │   │
│  │  Filter: [All ▾] [Category ▾]        │   │
│  │                                      │   │
│  │  ┌─ Reward Card ──────────────────┐  │   │
│  │  │ [Logo] Title          500 pts  │  │   │
│  │  │        Description    [Redeem] │  │   │
│  │  │        🎁 10% discount applies  │  │   │
│  │  └────────────────────────────────┘  │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

### File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/pages/Rewards.tsx` | CREATE | New full-page rewards experience |
| `src/App.tsx` | MODIFY | Add `/rewards` route |
| `src/pages/Profile.tsx` | MODIFY | Change "Rewards" button to navigate to /rewards |
| `src/components/RewardsSection.tsx` | MODIFY | Adapt for both dialog and full-page use |

### Technical Implementation

**New `/rewards` Route Features:**
- Full-screen page with AppHeader and BottomNav
- Sticky points summary card at top
- Tab navigation: Rewards, My Vouchers, Achievements, History
- Category filters with horizontal scrolling chips
- Pull-to-refresh capability
- Animated reward cards with modern design
- QR code generation inline (no dialog)

---

## Part 2: Enhanced Availability Status

### Current State
- "Unavailable" status has optional note only
- "Reserved" status has month/year selection but no auto-reversion
- No automatic status changes after time periods

### New Features

#### 2.1 Unavailable Duration Options

When user selects "Unavailable", show enhanced dialog:

```text
┌─────────────────────────────────────────────┐
│  🚫 Set Unavailable Period                  │
├─────────────────────────────────────────────┤
│                                             │
│  ─ Duration ─────────────────────────────  │
│  [1 Week] [1 Month] [Until Date] [Indefinite]│
│                                             │
│  📅 If "Until Date" selected:               │
│  [Select Date Picker]                       │
│                                             │
│  ─ Reason (optional) ────────────────────  │
│  [What's happening?                    ]    │
│                                             │
│  Quick: [Out of town] [Medical] [Personal]  │
│                                             │
│  ℹ️ You'll automatically become available   │
│     on [calculated date]                    │
│                                             │
├─────────────────────────────────────────────┤
│  [Cancel]              [Save]               │
└─────────────────────────────────────────────┘
```

**Duration Options:**
- **1 Week**: `unavailable_until = CURRENT_DATE + 7`
- **1 Month**: `unavailable_until = CURRENT_DATE + 30`
- **Until Date**: User picks specific date
- **Indefinite**: No auto-reversion (current behavior)

#### 2.2 Reserved Status Auto-Reversion

When reserved period ends:
1. System automatically sets status to "available"
2. BUT if a donation is logged during reserved period → apply 90-day rule

#### 2.3 Database Changes

**Add column to profiles:**
```sql
ALTER TABLE profiles ADD COLUMN unavailable_until DATE;
```

**Updated trigger function:**
```sql
CREATE OR REPLACE FUNCTION auto_revert_availability_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if reserved period has ended
  IF NEW.availability_status = 'reserved' 
     AND NEW.reserved_until IS NOT NULL 
     AND NEW.reserved_until < CURRENT_DATE THEN
    -- Check if there's a recent donation requiring 90-day wait
    IF NEW.last_donation_date IS NOT NULL 
       AND (CURRENT_DATE - NEW.last_donation_date) < 90 THEN
      NEW.availability_status := 'unavailable';
      NEW.reserved_until := NULL;
    ELSE
      NEW.availability_status := 'available';
      NEW.reserved_until := NULL;
    END IF;
  END IF;
  
  -- Check if unavailable period has ended
  IF NEW.availability_status = 'unavailable' 
     AND NEW.unavailable_until IS NOT NULL 
     AND NEW.unavailable_until < CURRENT_DATE THEN
    -- Check 90-day rule
    IF NEW.last_donation_date IS NOT NULL 
       AND (CURRENT_DATE - NEW.last_donation_date) < 90 THEN
      -- Keep unavailable, but clear the until date
      NEW.unavailable_until := NULL;
    ELSE
      NEW.availability_status := 'available';
      NEW.unavailable_until := NULL;
      NEW.status_note := NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Scheduled job for auto-reversion:**
```sql
-- Run daily to auto-revert expired statuses
SELECT cron.schedule(
  'auto-revert-availability',
  '0 0 * * *', -- Every day at midnight
  $$
  UPDATE profiles 
  SET availability_status = CASE
    WHEN last_donation_date IS NOT NULL AND (CURRENT_DATE - last_donation_date) < 90 
    THEN 'unavailable'
    ELSE 'available'
  END,
  reserved_until = NULL,
  unavailable_until = NULL,
  status_note = NULL
  WHERE (
    (availability_status = 'reserved' AND reserved_until < CURRENT_DATE)
    OR (availability_status = 'unavailable' AND unavailable_until IS NOT NULL AND unavailable_until < CURRENT_DATE)
  );
  $$
);
```

### File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/AvailabilityToggle.tsx` | MODIFY | Add duration options for unavailable |
| Database migration | CREATE | Add `unavailable_until` column and cron job |

---

## Part 3: Updated AvailabilityToggle Component

### New Unavailable Dialog Design

```tsx
// Duration options
const UNAVAILABLE_DURATIONS = [
  { value: "1week", label: "1 Week", days: 7 },
  { value: "1month", label: "1 Month", days: 30 },
  { value: "custom", label: "Until Date", days: null },
  { value: "indefinite", label: "Indefinite", days: null },
];
```

**Enhanced onChange callback:**
```typescript
onChange: (status: string, metadata?: { 
  reservedUntil?: string; 
  statusNote?: string;
  unavailableUntil?: string; // NEW
}) => void;
```

---

## UI Component Updates

### Profile.tsx Updates

```tsx
// Update updateAvailability function
const updateAvailability = async (status: string, metadata?: { 
  reservedUntil?: string; 
  statusNote?: string;
  unavailableUntil?: string; // NEW
}) => {
  const updateData: Record<string, any> = { availability_status: status };
  
  if (status === 'reserved' && metadata?.reservedUntil) {
    updateData.reserved_until = metadata.reservedUntil;
  }
  
  if (status === 'unavailable') {
    updateData.status_note = metadata?.statusNote || null;
    updateData.unavailable_until = metadata?.unavailableUntil || null; // NEW
  }
  
  // ... rest of function
};
```

---

## Summary of Changes

### New Files
1. `src/pages/Rewards.tsx` - Full-page rewards experience

### Modified Files
1. `src/App.tsx` - Add `/rewards` route
2. `src/pages/Profile.tsx` - Navigate to /rewards instead of dialog, update availability function
3. `src/components/AvailabilityToggle.tsx` - Add duration options for unavailable
4. `src/components/RewardsSection.tsx` - Minor adaptations

### Database Changes
1. Add `unavailable_until DATE` column to profiles
2. Update `clear_status_metadata()` trigger to clear `unavailable_until`
3. Create cron job for daily auto-reversion of expired statuses

---

## Visual Mockups

### Rewards Page Mobile View
```text
┌─────────────────────────┐
│ ← My Rewards            │
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │  🏆 1,250 pts       │ │
│ │  Gold Member        │ │
│ │  ━━━━━━━━━━━━━━━━━ │ │
│ │  850 to Platinum    │ │
│ └─────────────────────┘ │
│                         │
│ [🎁][🎫][🏆][📊]       │
│                         │
│ ┌─────────────────────┐ │
│ │ [🍔] Coffee Voucher │ │
│ │ Partner Cafe        │ │
│ │ 100pts     [Redeem] │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ [🏥] Health Check   │ │
│ │ Partner Hospital    │ │
│ │ 500pts     [Redeem] │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

### Enhanced Unavailable Dialog
```text
┌─────────────────────────┐
│ 🚫 Set Unavailable     │
├─────────────────────────┤
│ How long?               │
│ [1 Week●] [1 Month]     │
│ [Until...] [Indefinite] │
│                         │
│ Reason (optional)       │
│ [________________]      │
│                         │
│ [Medical] [Travel]      │
│ [Personal] [Busy]       │
│                         │
│ ℹ️ Available on Feb 5   │
├─────────────────────────┤
│ [Cancel]    [Save]      │
└─────────────────────────┘
```
