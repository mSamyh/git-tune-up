
# Hospital Portal: Full System Audit & Fix

## Issues Discovered

### CRITICAL: Hospital Deletion Fails
**Root Cause**: The `blood_unit_history` table has a foreign key to `hospitals(id)` **without** `ON DELETE CASCADE`. When the `delete-hospital` function tries to delete the hospital record, it fails with:
```
Key (id)=(b6f8ba7c-...) is still referenced from table "blood_unit_history"
```

The delete function cleans up `blood_units` and `blood_stock`, but misses `blood_unit_history`. Even if it did delete those records, the FK constraint without CASCADE would still block the hospital deletion.

**Current FK cascade status**:
| Table | FK to hospitals | ON DELETE |
|-------|----------------|-----------|
| blood_units | hospital_id | CASCADE |
| blood_stock | hospital_id | CASCADE |
| blood_stock_history | hospital_id | CASCADE |
| blood_unit_history | hospital_id | **NONE (BUG)** |

### CRITICAL: Blood Stock Not Showing After Adding Units
**Root Cause**: The `syncBloodStock` function in `manage-blood-unit` works correctly in logic, but there are two problems:

1. **`functions.invoke` error handling bug**: The Supabase JS client's `functions.invoke` does NOT throw on HTTP errors (4xx/5xx). Instead, it returns `{ data: null, error: FunctionsHttpError }`. The frontend code checks `if (error) throw error` which is correct, BUT the edge function returns errors in the response body with non-200 status codes. The client SDK treats 2xx as success and puts the parsed JSON in `data`, and treats non-2xx as error. So the error handling is actually fine. However, there is a more subtle issue...

2. **The `syncBloodStock` function uses upsert-like logic but without proper conflict handling**: It does a `select().single()` first, then either updates or inserts. Between the select and the insert/update, there could be a race condition. More importantly, the insert doesn't set `last_updated`, and the existing `blood_stock_history` trigger fires on every insert/update, which could fail if the `blood_stock_id` reference is NULL for newly created records.

3. **Test data is in broken state**: The test hospital has had its `blood_stock` and `blood_units` deleted (from previous deletion attempts) but `blood_unit_history` records remain, preventing the hospital from being deleted. Meanwhile no stock records exist, so nothing shows on the public page.

### Password Update Issues
- The `handleResetPassword` function uses `window.prompt()` which is poor UX and inconsistent with the rest of the admin panel
- When the auth user doesn't exist (orphaned `auth_user_id`), the reset silently fails with a confusing error

### Realtime Stock Visibility
- The `blood_stock` table IS in the realtime publication (confirmed)
- But `BloodUnitManager.tsx` (hospital portal) does NOT subscribe to realtime -- it only fetches once on mount
- When a hospital adds a unit, other viewers of the stock page WILL see updates (realtime works on `blood_stock`) but the hospital's own view doesn't auto-refresh

### Legacy Dead Code
- `update-blood-stock` edge function still uses old PIN-based authentication (dead code)
- `verify-hospital-pin` edge function is no longer used
- `HospitalStockManager.tsx` and `StockUpdateSheet.tsx` still reference the old PIN system and are imported nowhere actively

### AddBloodUnitSheet State Bug
- When `editingUnit` changes, the component's state fields (bloodGroup, collectionDate, etc.) are initialized in `useState` with `editingUnit` values, but `useState` only runs on initial mount. So editing a unit shows stale/default values instead of the selected unit's data.

---

## Fix Plan

### Part 1: Database Migration

Fix the foreign key constraint and clean up orphaned data:

```sql
-- Fix: Add ON DELETE CASCADE to blood_unit_history -> hospitals FK
ALTER TABLE blood_unit_history 
  DROP CONSTRAINT blood_unit_history_hospital_id_fkey;
ALTER TABLE blood_unit_history 
  ADD CONSTRAINT blood_unit_history_hospital_id_fkey 
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
```

### Part 2: Fix delete-hospital Edge Function

Update the function to:
1. Delete `blood_unit_history` records BEFORE the hospital
2. Delete `blood_stock_history` records (safety net)
3. Handle "auth user not found" gracefully
4. Add proper logging for each step

```text
Deletion order:
1. Get hospital details (auth_user_id)
2. Delete auth user (ignore "not found" errors)
3. Delete blood_unit_history  <-- NEW
4. Delete blood_units
5. Delete blood_stock_history  <-- NEW
6. Delete blood_stock
7. Delete hospital record
```

### Part 3: Fix manage-blood-unit syncBloodStock

Improve the sync function to use proper upsert:
```typescript
async function syncBloodStock(supabase, hospitalId, bloodGroup) {
  const { count } = await supabase
    .from("blood_units")
    .select("*", { count: "exact", head: true })
    .eq("hospital_id", hospitalId)
    .eq("blood_group", bloodGroup)
    .eq("status", "available");

  const availableCount = count || 0;

  // Use upsert with the unique constraint
  const { error } = await supabase
    .from("blood_stock")
    .upsert(
      {
        hospital_id: hospitalId,
        blood_group: bloodGroup,
        units_available: availableCount,
        last_updated: new Date().toISOString(),
      },
      { onConflict: "hospital_id,blood_group" }
    );
    
  if (error) console.error("Sync error:", error);
  else console.log(`Synced: ${hospitalId}/${bloodGroup} = ${availableCount}`);
}
```

### Part 4: Fix AddBloodUnitSheet State Initialization

Add a `useEffect` to re-initialize form state when `editingUnit` changes:

```typescript
useEffect(() => {
  if (editingUnit) {
    setBloodGroup(editingUnit.blood_group);
    setCollectionDate(new Date(editingUnit.collection_date));
    setExpiryDate(new Date(editingUnit.expiry_date));
    setDonorId(editingUnit.donor_id || "");
    setDonorName(editingUnit.donor_name || "");
    setBagNumber(editingUnit.bag_number || "");
    setVolumeMl(editingUnit.volume_ml?.toString() || "450");
    setBatchNumber(editingUnit.batch_number || "");
    setComponentType(editingUnit.component_type || "whole_blood");
    setRemarks(editingUnit.remarks || "");
  }
}, [editingUnit]);
```

### Part 5: Fix Password Reset UX

Replace `window.prompt()` with a proper dialog component:
- Add a `resetPasswordDialog` state with `{ open, hospital, newPassword }` fields
- Create a dialog with password input, generate button, and confirm button
- Show success feedback with option to copy credentials

### Part 6: Add Realtime to BloodUnitManager

Add a realtime subscription so the hospital portal auto-refreshes when units change:

```typescript
useEffect(() => {
  fetchUnits();
  
  const channel = supabase
    .channel(`blood-units-${hospitalId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'blood_units',
      filter: `hospital_id=eq.${hospitalId}`,
    }, () => {
      fetchUnits();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [hospitalId]);
```

### Part 7: Clean Up Legacy Code

Remove unused edge functions and components:
- Delete `supabase/functions/update-blood-stock/` (PIN-based, replaced by manage-blood-unit)
- Delete `supabase/functions/verify-hospital-pin/` (PIN auth is deprecated)
- Remove their entries from `supabase/config.toml`
- Note: Keep `HospitalStockManager.tsx`, `StockUpdateSheet.tsx`, `BloodStockCard.tsx`, `ExpiryAlerts.tsx` for now as they may still be imported elsewhere -- but they are effectively dead code

---

## File Changes Summary

### Database
| Change | Purpose |
|--------|---------|
| Fix `blood_unit_history_hospital_id_fkey` to CASCADE | Allow hospital deletion |

### Edge Functions
| File | Changes |
|------|---------|
| `supabase/functions/delete-hospital/index.ts` | Add blood_unit_history & blood_stock_history cleanup, better error handling |
| `supabase/functions/manage-blood-unit/index.ts` | Fix syncBloodStock to use upsert |
| `supabase/functions/update-blood-stock/` | DELETE (legacy) |
| `supabase/functions/verify-hospital-pin/` | DELETE (legacy) |

### Frontend
| File | Changes |
|------|---------|
| `src/components/hospital/AddBloodUnitSheet.tsx` | Fix state initialization with useEffect |
| `src/components/hospital/BloodUnitManager.tsx` | Add realtime subscription |
| `src/components/HospitalAdminPanel.tsx` | Replace prompt() with proper reset password dialog |
| `supabase/config.toml` | Remove legacy function entries |

---

## Testing Checklist

1. Create a new hospital via admin panel with email/password
2. Login to hospital portal with the credentials
3. Add blood units (various blood groups)
4. Verify stock appears on /blood-stock page in real time
5. Reserve, transfuse, and discard units
6. Verify stock counts update on /blood-stock after each action
7. Reset hospital password from admin panel
8. Login with new password
9. Delete hospital from admin panel
10. Verify all related data is cleaned up
