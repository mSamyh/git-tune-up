

# Advanced Hospital Portal & Blood Stock Management

## Overview

Create a comprehensive hospital portal system that allows hospitals to manage their blood stock inventory while providing public visibility of blood availability to all users. This feature will help patients and requesters find blood at specific hospitals and enable hospitals to keep their stock information current.

---

## System Architecture

### User Roles & Access

| Role | Capabilities |
|------|-------------|
| **Hospital Staff** | Full CRUD on their hospital's blood stock, update contact info, view analytics |
| **Admin** | Manage all hospitals, add/remove hospital accounts, view all stocks |
| **Public Users** | View blood stock levels (read-only) from all hospitals |

### Portal Features

1. **Hospital Registration & Authentication** (PIN-based like Merchant Portal)
2. **Blood Stock Management** (Add, Edit, Delete stock entries)
3. **Real-time Stock Display** (Public visibility on main app)
4. **Stock Analytics** (Usage trends, expiry alerts)
5. **Contact Information Management**

---

## Database Schema

### New Table: `hospitals`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Primary key |
| `name` | text | Hospital name |
| `address` | text | Full address |
| `atoll` | text | Atoll location |
| `island` | text | Island location |
| `phone` | text | Contact phone |
| `email` | text | Contact email (optional) |
| `pin_hash` | text | Hashed 6-digit PIN for authentication |
| `is_active` | boolean | Whether hospital is active |
| `logo_url` | text | Hospital logo (optional) |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |

### New Table: `blood_stock`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Primary key |
| `hospital_id` | uuid (FK) | References hospitals.id |
| `blood_group` | text | Blood type (A+, A-, B+, etc.) |
| `units_available` | integer | Current units available |
| `units_reserved` | integer | Units reserved for pending surgeries |
| `expiry_date` | date | Earliest expiry date in this batch |
| `last_updated` | timestamptz | When stock was last updated |
| `notes` | text | Optional notes (e.g., "Low - need donations") |
| `status` | text | 'available', 'low', 'critical', 'out_of_stock' |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |

### New Table: `blood_stock_history`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Primary key |
| `blood_stock_id` | uuid (FK) | References blood_stock.id |
| `hospital_id` | uuid (FK) | References hospitals.id |
| `blood_group` | text | Blood type |
| `previous_units` | integer | Units before change |
| `new_units` | integer | Units after change |
| `change_type` | text | 'add', 'remove', 'adjust', 'expire' |
| `change_reason` | text | Reason for change |
| `changed_at` | timestamptz | When change occurred |

---

## RLS Policies

### hospitals table
```sql
-- Public can view active hospitals
CREATE POLICY "Public can view active hospitals"
ON hospitals FOR SELECT USING (is_active = true);

-- Admins can manage all hospitals
CREATE POLICY "Admins can manage hospitals"
ON hospitals FOR ALL USING (has_role(auth.uid(), 'admin'));
```

### blood_stock table
```sql
-- Everyone can view blood stock (public health information)
CREATE POLICY "Public can view blood stock"
ON blood_stock FOR SELECT USING (true);

-- Hospital can only manage their own stock (via edge function)
-- Direct updates blocked, all modifications via edge function
```

### blood_stock_history table
```sql
-- Admins can view history
CREATE POLICY "Admins can view stock history"
ON blood_stock_history FOR SELECT
USING (has_role(auth.uid(), 'admin'));
```

---

## Component Architecture

### New Pages & Components

```
src/pages/
├── HospitalPortal.tsx          # Main hospital portal (PIN auth + stock management)
├── BloodStock.tsx              # Public blood stock viewer

src/components/
├── hospital/
│   ├── HospitalStockManager.tsx    # CRUD interface for stock
│   ├── BloodStockCard.tsx          # Individual blood type stock card
│   ├── StockUpdateSheet.tsx        # Bottom sheet for updating stock
│   ├── StockAnalytics.tsx          # Usage trends and analytics
│   ├── ExpiryAlerts.tsx            # Upcoming expiry warnings
│   └── HospitalInfo.tsx            # Hospital details display
├── BloodStockOverview.tsx          # Public view of all hospital stocks
├── HospitalBloodStockCard.tsx      # Public card showing hospital stock
```

---

## UI Design

### Hospital Portal (PIN Authentication)

```text
┌─────────────────────────────────────────────┐
│  🏥 Hospital Portal                         │
├─────────────────────────────────────────────┤
│                                             │
│       [Hospital Icon]                       │
│                                             │
│    Enter your 6-digit Hospital PIN          │
│    [○][○][○][○][○][○]                       │
│                                             │
│    [━━━━━━ Verify PIN ━━━━━━]               │
│                                             │
│    Contact admin for portal access          │
└─────────────────────────────────────────────┘
```

### Hospital Dashboard (After Authentication)

```text
┌─────────────────────────────────────────────┐
│  🏥 IGM Hospital                   [Logout] │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─ Quick Stats ──────────────────────────┐ │
│  │ [8 Types] [156 Units] [3 Critical]     │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌─ Blood Stock ──────────────────────────┐ │
│  │                                         │ │
│  │  [A+]     45 units    ✅ Available     │ │
│  │  [A-]     12 units    ⚠️ Low           │ │
│  │  [B+]     38 units    ✅ Available     │ │
│  │  [B-]     2 units     🔴 Critical      │ │
│  │  [O+]     52 units    ✅ Available     │ │
│  │  [O-]     0 units     ❌ Out           │ │
│  │  [AB+]    7 units     ⚠️ Low           │ │
│  │  [AB-]    0 units     ❌ Out           │ │
│  │                                         │ │
│  └────────────────────────────────────────┘ │
│                                             │
│        [+ Add/Update Stock]                 │
│                                             │
│  ┌─ Expiring Soon ────────────────────────┐ │
│  │  ⚠️ 5 units A+ expire in 3 days        │ │
│  │  ⚠️ 2 units B- expire in 5 days        │ │
│  └────────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

### Stock Update Sheet

```text
┌─────────────────────────────────────────────┐
│           Update Blood Stock                │
│           A+ (A Positive)                   │
├─────────────────────────────────────────────┤
│                                             │
│  Current Stock: 45 units                    │
│                                             │
│  ─ Update Type ──────────────────────────  │
│  [➕ Add] [➖ Remove] [📝 Set Total]         │
│                                             │
│  Units                                      │
│  [-] [_____10_____] [+]                    │
│                                             │
│  ─ Expiry Date (optional) ───────────────  │
│  [📅 Select earliest expiry date    ▼]     │
│                                             │
│  ─ Reason ───────────────────────────────  │
│  [Donation received ▼]                      │
│  Options: Donation, Transfusion, Expired,   │
│           Transfer, Correction              │
│                                             │
│  ─ Notes (optional) ─────────────────────  │
│  [                                    ]     │
│                                             │
├─────────────────────────────────────────────┤
│  [Cancel]              [Update Stock]       │
└─────────────────────────────────────────────┘
```

### Public Blood Stock Page

```text
┌─────────────────────────────────────────────┐
│  🩸 Blood Availability                      │
├─────────────────────────────────────────────┤
│                                             │
│  [Filter: All ▾] [Blood Type: All ▾]       │
│                                             │
│  ┌─ IGM Hospital ─────────────────────────┐ │
│  │  📍 Malé, Malé Atoll                   │ │
│  │  📞 3335335                            │ │
│  │                                         │ │
│  │  [A+:45] [A-:12] [B+:38] [B-:2]        │ │
│  │  [O+:52] [O-:0]  [AB+:7] [AB-:0]       │ │
│  │                                         │ │
│  │  🔴 2 types critical  ⏱️ 10 min ago    │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌─ ADK Hospital ─────────────────────────┐ │
│  │  📍 Malé, Malé Atoll                   │ │
│  │  📞 3313553                            │ │
│  │                                         │ │
│  │  [A+:32] [A-:8]  [B+:25] [B-:5]        │ │
│  │  [O+:41] [O-:3]  [AB+:12][AB-:2]       │ │
│  │                                         │ │
│  │  ✅ All available  ⏱️ 2 hours ago      │ │
│  └────────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Edge Functions

### `verify-hospital-pin`
Verifies hospital PIN and returns hospital details with session token.

### `update-blood-stock`
Securely updates blood stock with validation, logging, and status calculation.

---

## Integration with Existing App

### Home Page Enhancement
Add "Blood Stock" tab or section in the authenticated home page showing quick stock overview.

### Blood Requests Page Integration
Show nearby hospital stock availability when creating a blood request.

### Navigation Updates
- Add Hospital icon in BottomNav (optional, could be in more menu)
- Add "Blood Stock" link in the app for public access
- Add "Hospital Portal" in footer/settings for hospital staff

---

## Stock Status Logic

```typescript
const getStockStatus = (units: number, bloodGroup: string) => {
  // Different thresholds for different blood types (rarer types have lower thresholds)
  const isRare = ['AB-', 'B-', 'O-', 'A-'].includes(bloodGroup);
  const criticalThreshold = isRare ? 2 : 5;
  const lowThreshold = isRare ? 5 : 15;
  
  if (units === 0) return 'out_of_stock';
  if (units <= criticalThreshold) return 'critical';
  if (units <= lowThreshold) return 'low';
  return 'available';
};
```

---

## File Changes Summary

### New Files

| File | Description |
|------|-------------|
| `src/pages/HospitalPortal.tsx` | Hospital staff portal with PIN auth |
| `src/pages/BloodStock.tsx` | Public blood stock viewer page |
| `src/components/hospital/HospitalStockManager.tsx` | Stock CRUD interface |
| `src/components/hospital/BloodStockCard.tsx` | Individual blood type card |
| `src/components/hospital/StockUpdateSheet.tsx` | Update stock bottom sheet |
| `src/components/hospital/ExpiryAlerts.tsx` | Expiry warning component |
| `src/components/BloodStockOverview.tsx` | Public stock overview |
| `supabase/functions/verify-hospital-pin/index.ts` | Hospital PIN verification |
| `supabase/functions/update-blood-stock/index.ts` | Secure stock update |

### Modified Files

| File | Changes |
|------|---------|
| `src/App.tsx` | Add `/hospital` and `/blood-stock` routes |
| `src/components/BottomNav.tsx` | Consider adding Hospital/Stock icon |
| `src/pages/Index.tsx` | Add blood stock quick view tab/section |
| `src/pages/Admin.tsx` | Add hospital management section |

### Database Migrations

1. Create `hospitals` table with RLS
2. Create `blood_stock` table with RLS
3. Create `blood_stock_history` table with RLS
4. Add function for auto status calculation
5. Add trigger for stock history logging

---

## Security Considerations

1. **PIN Authentication**: Hospitals authenticate via 6-digit PIN (hashed, like merchant portal)
2. **Stock Updates**: All stock modifications go through edge function with validation
3. **Audit Trail**: All stock changes logged in `blood_stock_history`
4. **RLS Policies**: Public can only read, updates require hospital verification
5. **Rate Limiting**: Prevent brute-force PIN attempts

---

## Visual Design Tokens

Following existing app patterns:
- **Cards**: `rounded-2xl border-border/50 shadow-soft`
- **Status Colors**: 
  - Available: `emerald-500`
  - Low: `amber-500`
  - Critical: `red-500`
  - Out of Stock: `gray-400`
- **Blood Type Pills**: Compact badges with blood group colors
- **Animations**: `animate-fade-in`, `animate-pulse-soft` for alerts

---

## Real-time Updates

Enable real-time subscriptions for blood stock changes:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE blood_stock;
```

This allows the public blood stock page to update automatically when hospitals modify their inventory.

