

# Fix: Donor Wellness Check SMS Logic

## Problem

Abdul Rasheed donated last night, making him "unavailable" due to the 90-day waiting period. The wellness check function treats ALL unavailable donors the same and sent him a "we noticed you've been unavailable for a while" SMS — which is wrong. He's unavailable because he just donated, not because something is wrong.

## Root Cause

In `donor-wellness-check/index.ts`, Part 2 (line 191-195) queries:
```typescript
.eq("availability_status", "unavailable")
.not("phone", "is", null)
```

This grabs EVERY unavailable donor, including those in their 90-day post-donation cooldown. There's no filter to exclude donors with `available_date` in the future (meaning they're waiting out the 90-day period).

## Fix

### 1. Exclude 90-day waiting period donors

Add a filter to skip donors whose `available_date` is in the future. These donors are unavailable because they donated, not by choice — they already get an "availability_restored" SMS when their 90 days are up (Part 1 of the function).

### 2. Change first wellness check timing from 30 days to 7 days

The user wants the first wellness SMS sent after **1 week** of being manually unavailable, not 30 days. Follow-up checks can remain monthly (every 30 days after the first).

### Changes to `supabase/functions/donor-wellness-check/index.ts`

**Line 93-94** — Add a 7-day threshold:
```typescript
const today = new Date().toISOString().split("T")[0];
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
```

**Lines 191-195** — Add filter to exclude 90-day donors:
```typescript
const { data: needsWellnessCheck, error: wellnessError } = await supabase
  .from("profiles")
  .select("id, full_name, phone, blood_group, availability_status, available_date, last_wellness_check, unavailable_until, last_donation_date")
  .eq("availability_status", "unavailable")
  .not("phone", "is", null);
```

**Lines 202-211** — Add 90-day exclusion check and adjust timing:
```typescript
for (const donor of needsWellnessCheck) {
  // SKIP donors in 90-day waiting period (they donated recently)
  // These donors have available_date set in the future
  if (donor.available_date) {
    const availDate = new Date(donor.available_date);
    if (availDate > new Date()) {
      console.log(`[Wellness] Skipping ${donor.full_name} - in 90-day waiting period (available: ${donor.available_date})`);
      results.wellnessCheck.skipped++;
      continue;
    }
  }

  // Skip if unavailable_until is set and in the future (temporary unavailability with end date)
  if (donor.unavailable_until) {
    const unavailableUntil = new Date(donor.unavailable_until);
    if (unavailableUntil > new Date()) {
      console.log(`[Wellness] Skipping ${donor.full_name} - unavailable until ${donor.unavailable_until}`);
      results.wellnessCheck.skipped++;
      continue;
    }
  }

  // Determine if this is the first check or a follow-up
  const isFirstCheck = !donor.last_wellness_check;

  // For FIRST check: wait 7 days of unavailability before sending
  // For FOLLOW-UP: wait 30 days since last check
  if (isFirstCheck) {
    // Skip if no way to determine how long they've been unavailable
    // We use last_wellness_check absence + updated_at would be ideal,
    // but we don't have "unavailable_since". 
    // Use the absence of last_wellness_check as the signal.
    // The 7-day gate is already handled by the cron running daily —
    // we just need to NOT send on day 1. We'll skip if they have
    // a recent donation (already filtered above) or recent check.
    // No additional filter needed for first check timing since
    // 90-day donors are already excluded above.
  } else {
    // Follow-up: check if last wellness check was within 30 days
    const lastCheck = new Date(donor.last_wellness_check);
    if (lastCheck > thirtyDaysAgo) {
      console.log(`[Wellness] Skipping ${donor.full_name} - checked on ${donor.last_wellness_check}`);
      results.wellnessCheck.skipped++;
      continue;
    }
  }

  // ... rest of send logic stays the same
}
```

Wait — the 7-day timing needs a way to know WHEN the donor became unavailable. Currently there's no `unavailable_since` column. Let me reconsider.

**Better approach**: We track when they became unavailable using the `updated_at` column on profiles. When someone sets themselves to "unavailable", `updated_at` gets set. For the first wellness check, we check if `updated_at` was more than 7 days ago AND `last_wellness_check` is null.

## Revised Logic

```text
For each unavailable donor:
  1. SKIP if available_date > today (90-day waiting period)
  2. SKIP if unavailable_until > today (has a set end date)
  3. If never had a wellness check (first time):
     - SKIP if updated_at < 7 days ago (became unavailable recently)
     - Send "wellness_check_first" SMS
  4. If had a previous check:
     - SKIP if last_wellness_check < 30 days ago
     - Send "wellness_check_followup" SMS
```

## File Changes

| File | Change |
|------|--------|
| `supabase/functions/donor-wellness-check/index.ts` | Add 90-day exclusion filter, add 7-day first-check delay, fetch `updated_at` and `last_donation_date` |

## Summary

- Donors in their 90-day post-donation cooldown will NO longer receive wellness check SMS
- First wellness SMS is sent after **7 days** of being manually unavailable (not 30)
- Follow-up wellness SMS continues monthly (every 30 days)
- The "availability_restored" notification (Part 1) is unaffected — it correctly fires when available_date = today
