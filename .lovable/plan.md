
# Hospital Portal Complete System - Gap Analysis & Implementation Plan

## Current State Analysis

After thorough exploration of the codebase, I've identified the following gaps:

### What's Already Implemented
- `/hospital` route (HospitalPortal.tsx) - PIN authentication and stock management UI
- `/blood-stock` route (BloodStock.tsx) - Public view of hospital blood stock
- Edge functions: `verify-hospital-pin` and `update-blood-stock`
- Database tables: `hospitals`, `blood_stock`, `blood_stock_history` with RLS policies
- Hospital stock components: `HospitalStockManager`, `BloodStockCard`, `StockUpdateSheet`, `ExpiryAlerts`

### Gaps Found
1. **Admin Panel Missing Hospital Management** - No way to add/edit hospitals (the merchants tab exists but hospitals tab does not)
2. **No hospitals in database** - Query confirmed the `hospitals` table is empty
3. **No navigation to Blood Stock** - Not in BottomNav or Index page tabs
4. **BottomNav lacks Hospital/BloodStock link** - Users can't discover the feature

---

## Implementation Plan

### Part 1: Create Hospital Admin Panel Component

Create a new component `src/components/HospitalAdminPanel.tsx` following the `MerchantAdminPanel` pattern:

**Features:**
- List all hospitals with name, location, phone, status
- Add new hospital (generate 6-digit PIN with hashing)
- Edit existing hospital details
- Toggle hospital active/inactive status
- Delete hospital (with confirmation)
- Show/hide PIN with copy functionality
- Display blood stock summary per hospital

**Form Fields:**
- Hospital Name (required)
- Phone
- Email
- Atoll (select from existing atolls)
- Island (select based on atoll)
- Address
- 6-digit PIN (auto-generate or manual entry)

### Part 2: Add Hospital Tab to Admin Panel

Modify `src/pages/Admin.tsx`:
- Add "Hospitals" to `TAB_ORDER` array (position after "merchants")
- Add Building2 icon import
- Add navItem for hospitals
- Add new `TabsContent` for hospitals tab
- Import and render `HospitalAdminPanel`

```typescript
// Updated TAB_ORDER
const TAB_ORDER = ["donors", "requests", "donations", "rewards", "merchants", "hospitals", "audit", "settings", "admins"] as const;
```

### Part 3: Create Edge Function for Hospital PIN Generation

Create `supabase/functions/create-hospital/index.ts`:
- Accept hospital details + plain PIN
- Hash PIN with same algorithm as verify-hospital-pin (SHA-256 + salt)
- Insert into hospitals table
- Return created hospital (without PIN hash)

This ensures PIN hashing is consistent between create and verify operations.

### Part 4: Add Blood Stock Navigation

**Option A: Add to Index Page**
Add a "Blood Stock" tab alongside Directory/Stats/Compatibility:
```typescript
// Fourth tab in Index.tsx
<TabsTrigger value="bloodstock">
  <Droplets className="h-4 w-4" />
  Blood Stock
</TabsTrigger>
```

**Option B: Add Quick Access Card**
Add a prominent "Check Blood Availability" card in the authenticated home page.

**Footer Links:**
Add "Blood Stock" and "Hospital Portal" links to the footer section.

### Part 5: Fix BottomNav (Optional Enhancement)

Consider adding blood stock as the 5th nav item or replacing one:
```typescript
const navItems = [
  { to: "/", icon: Home, label: "Home", end: true },
  { to: "/blood-requests", icon: Droplet, label: "Requests" },
  { to: "/blood-stock", icon: Activity, label: "Stock" }, // NEW
  { to: "/history", icon: History, label: "History" },
  { to: "/profile", icon: User, label: "Profile" },
];
```

---

## File Changes Summary

### New Files
| File | Description |
|------|-------------|
| `src/components/HospitalAdminPanel.tsx` | Hospital management UI for admins |
| `supabase/functions/create-hospital/index.ts` | Edge function for creating hospitals with hashed PIN |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/Admin.tsx` | Add "hospitals" tab, import HospitalAdminPanel |
| `src/pages/Index.tsx` | Add Blood Stock quick access or 4th tab |
| `src/components/BottomNav.tsx` | Consider adding Blood Stock link |
| `supabase/config.toml` | Add create-hospital function config |

---

## Database Operations

No schema changes needed - tables already exist. Admin will use the new UI to:
1. Add hospitals with names, locations, and PINs
2. Share the PIN with hospital staff
3. Hospital staff use `/hospital` to log in and manage stock
4. Public users view stock at `/blood-stock`

---

## User Flow After Implementation

### Admin Flow
1. Go to Admin Panel > Hospitals tab
2. Click "Add Hospital"
3. Fill in hospital details, generate/set PIN
4. Share PIN with hospital staff securely
5. Monitor hospitals and their stock levels

### Hospital Staff Flow
1. Navigate to `/hospital`
2. Enter 6-digit PIN
3. View their hospital's blood stock dashboard
4. Update stock levels (add/remove/set units)
5. Set expiry dates and notes
6. Log out when done

### Public User Flow
1. Access Blood Stock via Index page tab or navigation
2. View all hospitals and their current stock
3. Filter by atoll and blood type
4. See real-time updates (realtime enabled)
5. Contact hospital for blood needs

---

## Technical Implementation Details

### HospitalAdminPanel Component Structure

```tsx
// Key state management
const [hospitals, setHospitals] = useState<Hospital[]>([]);
const [showAddDialog, setShowAddDialog] = useState(false);
const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
const [showPins, setShowPins] = useState<Record<string, boolean>>({});

// Form data with atoll/island selection
const [formData, setFormData] = useState({
  name: "",
  phone: "",
  email: "",
  atoll: "",
  island: "",
  address: "",
  pin: "",
});

// PIN generation (same as MerchantAdminPanel)
const generatePin = () => {
  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  setFormData({ ...formData, pin });
};
```

### Create Hospital Edge Function

```typescript
// Hash PIN with same method as verify-hospital-pin
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "hospital_salt_key");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### Index Page Blood Stock Tab

```tsx
<TabsTrigger 
  value="bloodstock" 
  className="rounded-xl flex items-center gap-2 text-sm font-medium"
>
  <Droplets className="h-4 w-4" />
  <span className="hidden sm:inline">Blood Stock</span>
  <span className="sm:hidden">Stock</span>
</TabsTrigger>

<TabsContent value="bloodstock">
  <BloodStockOverview /> {/* New embedded component */}
</TabsContent>
```

---

## Security Considerations

1. **PIN Storage**: PINs are hashed with SHA-256 before storage (matching existing pattern)
2. **Admin Only**: Hospital CRUD operations protected by admin RLS policies
3. **Stock Updates**: Only via edge function with PIN verification
4. **Public Read**: Blood stock is publicly viewable (intentional for public health)

---

## Testing Checklist

After implementation, test:
1. Admin can add a new hospital with generated PIN
2. Admin can edit hospital details
3. Admin can toggle hospital active/inactive
4. Admin can delete a hospital
5. Hospital staff can log in with correct PIN
6. Hospital staff can update blood stock
7. Public blood stock page shows real-time data
8. Stock status auto-calculates (available/low/critical)
9. History logging works on stock changes
