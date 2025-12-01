# Automated Voucher Cleanup Setup

The expired voucher cleanup system is ready to use! Here's how to set it up:

## Manual Cleanup

Admins can manually run cleanup anytime from:
**Admin Panel → Settings Tab → "Run Cleanup" button**

This will:
- Find all expired vouchers (past expiry date, status='pending')
- Refund points to donors
- Record refund transactions
- Delete vouchers older than 7 days

## Automated Cleanup (Recommended)

For automatic daily cleanup, use one of these methods:

### Option 1: GitHub Actions (Free, Easy)

Create `.github/workflows/cleanup-vouchers.yml`:

```yaml
name: Cleanup Expired Vouchers

on:
  schedule:
    # Runs every day at 2 AM UTC
    - cron: '0 2 * * *'
  workflow_dispatch: # Allows manual trigger

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Run cleanup
        run: |
          curl -X POST \
            'https://jfiepcajyctszbfskgfu.supabase.co/functions/v1/cleanup-expired-vouchers' \
            -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmaWVwY2FqeWN0c3piZnNrZ2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0OTM3MjcsImV4cCI6MjA4MDA2OTcyN30.PdzJ3gLC3sxFdgnyFVsNFcH9Gjt7hYAauc-oPSMYSjI' \
            -H 'Content-Type: application/json'
```

### Option 2: Vercel Cron Jobs

In `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cleanup-vouchers",
    "schedule": "0 2 * * *"
  }]
}
```

Create `api/cleanup-vouchers.ts`:

```typescript
export default async function handler(req: any, res: any) {
  const response = await fetch(
    'https://jfiepcajyctszbfskgfu.supabase.co/functions/v1/cleanup-expired-vouchers',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmaWVwY2FqeWN0c3piZnNrZ2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0OTM3MjcsImV4cCI6MjA4MDA2OTcyN30.PdzJ3gLC3sxFdgnyFVsNFcH9Gjt7hYAauc-oPSMYSjI',
        'Content-Type': 'application/json'
      }
    }
  );

  const data = await response.json();
  res.json(data);
}
```

### Option 3: EasyCron (No-Code)

1. Go to [EasyCron.com](https://www.easycron.com)
2. Create free account
3. Add new cron job:
   - **URL**: `https://jfiepcajyctszbfskgfu.supabase.co/functions/v1/cleanup-expired-vouchers`
   - **Method**: POST
   - **Schedule**: Daily at 2 AM
   - **Headers**:
     ```
     Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmaWVwY2FqeWN0c3piZnNrZ2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0OTM3MjcsImV4cCI6MjA4MDA2OTcyN30.PdzJ3gLC3sxFdgnyFVsNFcH9Gjt7hYAauc-oPSMYSjI
     Content-Type: application/json
     ```

## What Gets Cleaned Up?

1. **Expired Vouchers** (expired but not yet refunded):
   - Status changes from 'pending' to 'expired'
   - Points refunded to donor
   - Transaction recorded as 'expired' type

2. **Old Expired Vouchers** (expired >7 days ago):
   - Completely deleted from database
   - Keeps database clean

## Monitoring

Check the cleanup logs in:
- **Admin Panel → Redemptions tab** (see status changes)
- **Backend → Edge Functions → cleanup-expired-vouchers** (see function logs)

## Manual Testing

Test the cleanup function by clicking "Run Cleanup" in the admin settings tab.
