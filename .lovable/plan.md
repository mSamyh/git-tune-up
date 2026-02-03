
# Fix Hospital Portal Issues: Deletion, Stock Visibility, and UI Cleanup

## Issues Identified

### Issue 1: Hospital Deletion Not Working
**Root Cause**: The admin panel attempts to delete hospitals using direct Supabase client calls, but the RLS policy `Admins can manage all hospitals` requires the `admin` role check which doesn't work with the anon key from the frontend.

**Solution**: Create a new edge function `delete-hospital` that:
- Uses service role to bypass RLS
- Deletes the associated auth user (to prevent orphaned accounts)
- Cleans up related blood_stock and blood_units records
- Updates the admin panel to call this function instead of direct delete

### Issue 2: Stock Not Visible After Adding
**Root Cause**: Two completely separate data systems exist:
- `blood_stock` table (aggregate counts per blood group) - read by public pages
- `blood_units` table (individual unit tracking) - written by hospital portal

When hospitals add units via the portal, they go to `blood_units`, but the public stock pages read from `blood_stock` which remains empty.

**Solution**: Update `manage-blood-unit` edge function to sync `blood_stock` table whenever units are added, removed, or status changes. The function will:
1. Count available units per blood group for the hospital
2. Update the corresponding `blood_stock` record with the new count
3. Trigger status recalculation (available/low/critical/out_of_stock)

### Issue 3: Stock Page UI Too Busy
**Request**: Make the stock page more minimal while keeping visual consistency.

**Solution**: Simplify the `BloodStock.tsx` page:
- Reduce visual elements and spacing
- Use a more compact card layout
- Remove redundant badges and reduce text
- Keep the color-coded blood group grid but make it smaller
- Streamline the header and filters

---

## Technical Implementation

### Part 1: Delete Hospital Edge Function

Create `supabase/functions/delete-hospital/index.ts`:

```typescript
// Actions:
// 1. Verify hospital exists
// 2. Delete auth user if exists (supabase.auth.admin.deleteUser)
// 3. Delete blood_units for hospital (cascade or explicit)
// 4. Delete blood_stock for hospital
// 5. Delete the hospital record
// 6. Return success
```

### Part 2: Sync blood_stock in manage-blood-unit

Add a helper function to recalculate and update `blood_stock`:

```typescript
async function syncBloodStock(supabase, hospitalId, bloodGroup) {
  // Count available units for this hospital/blood group
  const { count } = await supabase
    .from("blood_units")
    .select("*", { count: "exact", head: true })
    .eq("hospital_id", hospitalId)
    .eq("blood_group", bloodGroup)
    .eq("status", "available");

  // Update blood_stock record
  await supabase
    .from("blood_stock")
    .update({
      units_available: count || 0,
      last_updated: new Date().toISOString(),
    })
    .eq("hospital_id", hospitalId)
    .eq("blood_group", bloodGroup);
}
```

Call this function after every action that changes unit status (add, reserve, transfuse, discard, delete, unreserve).

### Part 3: Minimal Stock Page UI

Update `BloodStock.tsx`:
- Compact header with inline filters
- Smaller blood group grid (reduce padding)
- Remove hospital address/phone from card header
- Use pills instead of boxes for blood counts
- Single line footer with last updated
- Remove critical count badge when all OK

---

## File Changes Summary

### New Files
| File | Description |
|------|-------------|
| `supabase/functions/delete-hospital/index.ts` | Secure hospital deletion with cleanup |

### Modified Files
| File | Changes |
|------|---------|
| `supabase/functions/manage-blood-unit/index.ts` | Add blood_stock sync after each action |
| `src/components/HospitalAdminPanel.tsx` | Use delete-hospital edge function |
| `src/pages/BloodStock.tsx` | Minimal redesign with compact layout |
| `src/components/BloodStockOverview.tsx` | Match minimal design for consistency |
| `supabase/config.toml` | Register delete-hospital function |

---

## UI Before vs After

### Current (Verbose)
```text
┌─────────────────────────────────────────────┐
│  🩸 Blood Availability          [Refresh]   │
├─────────────────────────────────────────────┤
│  [Filter: All Atolls ▾] [Blood: All Types ▾]│
├─────────────────────────────────────────────┤
│  ┌─ IGM Hospital ─────────────────────────┐ │
│  │  📍 Feridhoo, Aa Atoll                 │ │
│  │  📞 6666666                [3 critical]│ │
│  │                                        │ │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐           │ │
│  │  │ A+ │ │ A- │ │ B+ │ │ B- │           │ │
│  │  │ 12 │ │  5 │ │  8 │ │  2 │           │ │
│  │  └────┘ └────┘ └────┘ └────┘           │ │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐           │ │
│  │  │ O+ │ │ O- │ │AB+ │ │AB- │           │ │
│  │  │ 15 │ │  0 │ │  3 │ │  0 │           │ │
│  │  └────┘ └────┘ └────┘ └────┘           │ │
│  │                                        │ │
│  │  45 total units      Updated 10m ago   │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### After (Minimal)
```text
┌─────────────────────────────────────────────┐
│  Blood Stock    [All ▾] [Type ▾] [↻]        │
├─────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐   │
│  │ IGM Hospital              Aa · 10m   │   │
│  │                                      │   │
│  │ A+ A- B+ B- O+ O- AB+ AB-            │   │
│  │ 12  5  8  2 15  0   3   0            │   │
│  └──────────────────────────────────────┘   │
│  ┌──────────────────────────────────────┐   │
│  │ ADK Hospital              K' · 2h    │   │
│  │                                      │   │
│  │ A+ A- B+ B- O+ O- AB+ AB-            │   │
│  │  8  3 12  1 20  5   6   2            │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

---

## Security Notes

1. **delete-hospital**: Uses service role to ensure admin can delete regardless of session
2. **blood_stock sync**: Uses service role in manage-blood-unit (already present)
3. No new RLS policies needed - existing policies cover the operations
