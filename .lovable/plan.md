
# Comprehensive Website Audit Report

## Executive Summary

After a thorough review of the codebase, I've identified **24 issues** across 8 categories. The application is generally well-structured with good patterns in place (isMounted cleanup, RLS policies, secure RPC functions), but there are opportunities for improvement in race condition prevention, performance optimization, error handling, and visual consistency.

---

## 1. Race Conditions & Concurrency Issues

### 1.1 DonorTable N+1 Query Pattern (CRITICAL)
**File:** `src/components/DonorTable.tsx` (lines 80-90)

**Problem:** The `fetchDonors` function uses `Promise.all` with individual RPC calls for each donor, creating N+1 queries. Although bulk functions exist (`get_bulk_donation_counts`), they're used in `DonorContext.tsx` but NOT in `DonorTable.tsx`.

**Current Code:**
```typescript
const donorsWithCounts = await Promise.all(
  allDonors.map(async (donor) => {
    if (donor.source === 'profile') {
      const { data: countData } = await supabase.rpc('get_donation_count', { donor_uuid: donor.id });
      return { ...donor, donation_count: countData || 0 };
    } else {
      const { data: countData } = await supabase.rpc('get_directory_donation_count', { donor_uuid: donor.id });
      return { ...donor, donation_count: countData || 0 };
    }
  })
);
```

**Fix:** Use the existing bulk RPC functions (`get_bulk_donation_counts` and `get_bulk_directory_donation_counts`) that are already used in `DonorContext.tsx`.

### 1.2 Missing isMounted Cleanup Patterns
**Files affected:**
- `src/pages/Index.tsx` (lines 60-69) - fetchAtolls
- `src/components/DonorDirectory.tsx` (lines 38-48) - fetchDonors, fetchAtolls
- `src/components/DonorTable.tsx` (lines 60-90) - fetchDonors
- `src/components/DonorStatsDashboard.tsx` (lines 40-111) - fetchStats
- `src/components/LocationSelector.tsx` (lines 65-75) - fetchIslands

**Problem:** These components perform async state updates without checking if the component is still mounted.

**Fix:** Add isMounted pattern (already used correctly in Profile.tsx and History.tsx):
```typescript
useEffect(() => {
  let isMounted = true;
  const fetchData = async () => {
    const { data } = await supabase.from("atolls").select("*");
    if (isMounted && data) setAtolls(data);
  };
  fetchData();
  return () => { isMounted = false; };
}, []);
```

### 1.3 BloodRequests N+1 for Poster Names
**File:** `src/components/BloodRequests.tsx` (lines 160-175)

**Problem:** Individual profile lookups for each blood request.

```typescript
const requestsWithPosters = await Promise.all(
  data.map(async (request) => {
    if (request.requested_by) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", request.requested_by)
        .single();
```

**Fix:** Use a single query with `.in()` filter for all unique `requested_by` IDs.

---

## 2. Performance Issues

### 2.1 Realtime Subscription Refresh Rate
**File:** `src/components/BloodRequests.tsx` (lines 100-101)

**Problem:** The expiry interval runs every 60 seconds AND there's a realtime subscription. This could cause excessive database calls.

### 2.2 DonorStatsDashboard Console Error
**File:** `src/components/DonorStatsDashboard.tsx` (line 107)

**Problem:** Uses `console.error` in production code without conditional logging.

### 2.3 Duplicate Data Fetching
**Files:** `DonorContext.tsx` and `DonorTable.tsx` both fetch donor lists independently.

**Fix:** Consider lifting state to context or using React Query for caching.

---

## 3. Single Source of Truth Violations

### 3.1 Tier Thresholds Duplication
**Files:**
- `src/lib/tierSystem.ts` (lines 107-112) - Local fallback
- Database `reward_settings` table
- `src/contexts/ReferenceDataContext.tsx`

**Problem:** Tier thresholds (Bronze: 0, Silver: 500, Gold: 1000, Platinum: 2000) are hardcoded in `tierSystem.ts` as fallbacks. If database values change, the frontend fallback won't match.

**Fix:** Always prefer fetching from database, and add a warning when fallback is used.

### 3.2 Blood Groups Fallback
**File:** `src/contexts/ReferenceDataContext.tsx` (line 143)

**Problem:** `FALLBACK_BLOOD_GROUPS` is hardcoded and used across multiple components when reference data fails to load.

**Current pattern is acceptable** but should log a warning when fallback is used.

### 3.3 Missing Fields in DonorContext
**File:** `src/contexts/DonorContext.tsx` (lines 53-63)

**Problem:** The `topDonors` fetch doesn't include `reserved_until` and `status_note` fields that are needed for the Instagram-style bubbles in `DonorTable.tsx`.

**Fix:** Ensure the select statement includes all required fields.

---

## 4. Error Handling Gaps

### 4.1 Silent Failures in Data Fetching
**Files:**
- `src/pages/Index.tsx` (lines 60-68)
- `src/components/DonorDirectory.tsx` (lines 43-48)
- `src/components/LocationSelector.tsx` (lines 65-75)

**Problem:** No try/catch blocks, errors are silently ignored.

**Fix:** Add proper error handling with user feedback:
```typescript
const fetchAtolls = async () => {
  try {
    const { data, error } = await supabase.from("atolls").select("*");
    if (error) throw error;
    if (data) setAtolls(data);
  } catch (error) {
    console.error("Failed to fetch atolls:", error);
    // Optionally show toast notification
  }
};
```

### 4.2 Missing Error Boundaries
**Problem:** No React Error Boundaries to catch rendering errors.

**Fix:** Add Error Boundary components around critical sections.

---

## 5. Production Logging Issues

### 5.1 Console Logs in Production
**Files with excessive logging:**
- `src/lib/donationPoints.ts` (lines 17, 42, 48, 52, 78, 84, 88, 107)
- `src/components/BloodRequests.tsx` (lines 130, 136)
- Edge functions: `verify-qr-code`, `preview-voucher`, `broadcast-sms`

**Fix:** Replace with conditional logging:
```typescript
const isDev = import.meta.env.DEV;
if (isDev) console.log('Debug info:', data);
```

Or use a logging utility that can be disabled in production.

---

## 6. Visual Inconsistencies

### 6.1 Status Badge Colors Inconsistency
**Files:**
- `DonorTable.tsx` uses: emerald-500, amber-500, red-500, blue-500
- `DonorDirectory.tsx` uses: green-500, yellow-500, blue-500
- `DonorProfileDialog.tsx` may use different colors

**Fix:** Create a centralized status color utility:
```typescript
// src/lib/statusColors.ts
export const STATUS_COLORS = {
  available: { bg: 'bg-emerald-500', text: 'text-emerald-600', ring: 'ring-emerald-500/50' },
  unavailable: { bg: 'bg-red-500', text: 'text-red-600', ring: 'ring-red-500/50' },
  reserved: { bg: 'bg-blue-500', text: 'text-blue-600', ring: 'ring-blue-500/50' },
  available_soon: { bg: 'bg-amber-500', text: 'text-amber-600', ring: 'ring-amber-500/50' },
};
```

### 6.2 Card Border Radius Inconsistency
- Most cards use `rounded-2xl`
- Some use `rounded-xl`
- Filter chips use various radii

**Already documented** in design system standards, but enforcement could be improved.

### 6.3 Button Height Inconsistency
- Some buttons use `h-10`
- Some use `h-11`
- Some use `h-12`

**Fix:** Standardize to h-11 for regular buttons, h-12 for primary CTAs.

---

## 7. Function Gaps & Missing Features

### 7.1 Missing Pull-to-Refresh
**Files:** `DonorTable.tsx`, `BloodRequests.tsx`

**Problem:** Mobile users expect pull-to-refresh on list views.

**Fix:** Implement using a library like `react-pull-to-refresh` or custom hook.

### 7.2 Missing Offline Support
**Problem:** No indication when the user is offline, data becomes stale.

**Fix:** Add online/offline detection and show appropriate UI.

### 7.3 Missing Loading States for Filter Changes
**File:** `src/pages/Index.tsx`

**Problem:** When filters change, there's no loading indicator while data re-filters.

### 7.4 Missing Input Validation on DonorFilterSheet
**File:** `src/components/DonorFilterSheet.tsx`

**Problem:** Island dropdown should be disabled if no atoll is selected (currently handled, but could be more explicit visually).

---

## 8. Data Integrity Issues

### 8.1 Potential Duplicate Points Award
**File:** `src/pages/History.tsx` (lines 161-166)

**Problem:** While `awardDonationPoints` checks for duplicates server-side, rapid clicks could still cause issues if the frontend doesn't debounce.

**Current safeguard exists** in the RPC function, but adding frontend debounce would improve UX.

### 8.2 Redemption Rollback Edge Case
**File:** `src/components/RewardsSection.tsx` (lines 280-289)

**Problem:** If redemption creation succeeds but points deduction fails, the code attempts rollback, but network issues could leave orphaned records.

**Fix:** Use a database transaction via RPC function instead of frontend logic.

---

## Implementation Priority

### Critical (Fix Immediately)
1. DonorTable N+1 query → Use bulk RPC functions
2. BloodRequests N+1 for poster names → Use `.in()` query
3. Add isMounted cleanup to 5 components

### High Priority
4. Add error handling to 3 fetch functions
5. Create centralized status color utility
6. Replace console.log with conditional logging

### Medium Priority
7. Standardize button heights
8. Add missing fields to DonorContext
9. Add loading state for filter changes

### Low Priority
10. Add pull-to-refresh
11. Add offline detection
12. Add Error Boundaries

---

## Technical Implementation Details

### Fix 1: DonorTable Bulk Query
```typescript
const fetchDonors = async () => {
  // ... existing profile and directory fetch ...
  
  const profileIds = profileDonorsList.map(d => d.id);
  const directoryIds = directoryDonorsList.map(d => d.id);

  const [profileCountsResult, directoryCountsResult] = await Promise.all([
    profileIds.length > 0 
      ? supabase.rpc('get_bulk_donation_counts', { donor_ids: profileIds })
      : { data: [] },
    directoryIds.length > 0 
      ? supabase.rpc('get_bulk_directory_donation_counts', { donor_ids: directoryIds })
      : { data: [] }
  ]);

  const profileCountMap = new Map((profileCountsResult.data || []).map(r => [r.donor_id, r.donation_count]));
  const directoryCountMap = new Map((directoryCountsResult.data || []).map(r => [r.donor_id, r.donation_count]));

  const allDonors = [
    ...profileDonorsList.map(d => ({ ...d, donation_count: profileCountMap.get(d.id) || 0 })),
    ...directoryDonorsList.map(d => ({ ...d, donation_count: directoryCountMap.get(d.id) || 0 }))
  ];
```

### Fix 2: Status Colors Utility
```typescript
// src/lib/statusColors.ts
export const getStatusConfig = (status: string, donorData?: {
  lastDonationDate?: string | null;
  availableDate?: string | null;
  reservedUntil?: string | null;
}) => {
  // Centralized status logic
};
```

### Fix 3: Conditional Logger
```typescript
// src/lib/logger.ts
export const logger = {
  log: (...args: any[]) => {
    if (import.meta.env.DEV) console.log(...args);
  },
  error: (...args: any[]) => {
    console.error(...args); // Always log errors
  },
  warn: (...args: any[]) => {
    if (import.meta.env.DEV) console.warn(...args);
  },
};
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/DonorTable.tsx` | Use bulk RPC, add isMounted |
| `src/components/DonorDirectory.tsx` | Add isMounted cleanup |
| `src/components/BloodRequests.tsx` | Use bulk profile fetch |
| `src/components/DonorStatsDashboard.tsx` | Add isMounted, error handling |
| `src/components/LocationSelector.tsx` | Add isMounted, error handling |
| `src/pages/Index.tsx` | Add isMounted to fetchAtolls |
| `src/contexts/DonorContext.tsx` | Add missing fields to topDonors select |
| `src/lib/logger.ts` | **CREATE** - Conditional logging utility |
| `src/lib/statusColors.ts` | **CREATE** - Status color utility |
| `src/lib/donationPoints.ts` | Replace console.log with logger |

---

## Summary

The codebase is well-structured with many good patterns already in place:
- ✅ Secure RPC functions for points management
- ✅ isMounted patterns in key pages (Profile, History)
- ✅ isSubmitting guards on forms
- ✅ RLS policies on all tables
- ✅ Reference data context for single source of truth

The main areas needing attention are:
- ⚠️ N+1 query patterns in DonorTable and BloodRequests
- ⚠️ Missing isMounted cleanup in some components
- ⚠️ Console logging in production
- ⚠️ Visual inconsistencies in status colors
