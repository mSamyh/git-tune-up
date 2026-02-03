
# Donor Wellness Check & Availability Notification System

## Overview

This plan implements an automated notification system to:
1. **Notify donors when their 90-day waiting period is complete** - Congratulate them on being eligible to donate again
2. **Monthly wellness check-ins for unavailable donors** - Send caring messages to donors who set themselves as unavailable to check on their well-being

All message templates will be fully configurable by admins.

---

## System Architecture

The system uses a **scheduled Edge Function** that runs daily (via pg_cron) to:
1. Check all donor profiles for eligibility transitions
2. Send SMS notifications via the existing Textbee integration
3. Log all notifications for audit purposes

---

## Part 1: Database Schema

### 1.1 Create `notification_messages` Table

Store configurable message templates:

```sql
CREATE TABLE notification_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_key TEXT NOT NULL UNIQUE,
  message_title TEXT NOT NULL,
  message_template TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE notification_messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage notification messages"
ON notification_messages FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view notification messages"
ON notification_messages FOR SELECT
USING (true);
```

### 1.2 Create `donor_wellness_logs` Table

Track sent notifications to prevent duplicates and enable check-in history:

```sql
CREATE TABLE donor_wellness_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'availability_restored', 'wellness_check'
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_via TEXT NOT NULL DEFAULT 'sms', -- 'sms', 'telegram', 'in_app'
  message_sent TEXT,
  status TEXT DEFAULT 'sent', -- 'sent', 'failed', 'delivered'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wellness_logs_donor ON donor_wellness_logs(donor_id);
CREATE INDEX idx_wellness_logs_type_date ON donor_wellness_logs(notification_type, sent_at);

-- RLS
ALTER TABLE donor_wellness_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage wellness logs"
ON donor_wellness_logs FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own logs"
ON donor_wellness_logs FOR SELECT
USING (auth.uid() = donor_id);
```

### 1.3 Add Tracking Column to Profiles

Track last wellness check date:

```sql
ALTER TABLE profiles ADD COLUMN last_wellness_check TIMESTAMPTZ;
```

### 1.4 Insert Default Message Templates

```sql
INSERT INTO notification_messages (message_key, message_title, message_template, description) VALUES
(
  'availability_restored',
  'Ready to Donate Again',
  'Hi {full_name}! Great news - your 90-day waiting period is complete. You are now eligible to donate blood again! Your blood type ({blood_group}) can save lives. Thank you for being a hero! - LeyHadhiyaMv',
  'Sent when a donor becomes eligible after 90-day cooldown'
),
(
  'wellness_check_first',
  'First Wellness Check',
  'Hi {full_name}, we noticed you''ve been unavailable for a while. We hope everything is okay! When you''re feeling better, we''d love to have you back. Take care! - LeyHadhiyaMv',
  'First wellness check after 30 days of being unavailable'
),
(
  'wellness_check_followup',
  'Follow-up Wellness Check',
  'Hi {full_name}, just checking in! We miss you in our donor community. If there''s anything we can help with, please reach out. Hope to see you soon! - LeyHadhiyaMv',
  'Monthly follow-up for donors still unavailable'
);
```

---

## Part 2: Edge Function - `donor-wellness-check`

Create `supabase/functions/donor-wellness-check/index.ts`:

**Functionality:**

1. **Availability Restoration Notifications**
   - Query donors where `available_date` = today and `availability_status` = 'unavailable'
   - Check they haven't been notified (no recent log entry)
   - Send SMS using existing Textbee integration
   - Log the notification

2. **Monthly Wellness Checks**
   - Query donors where:
     - `availability_status` = 'unavailable' 
     - `unavailable_until` is NULL or in the past (indefinite unavailability)
     - Last wellness check was > 30 days ago OR never sent
   - Send caring check-in message
   - Update `last_wellness_check` timestamp

**Key Logic:**
```typescript
// Find donors who became available today
const { data: newlyAvailable } = await supabase
  .from('profiles')
  .select('*')
  .eq('availability_status', 'unavailable')
  .eq('available_date', new Date().toISOString().split('T')[0])
  .not('phone', 'is', null);

// Find donors for wellness check (unavailable for 30+ days without check)
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const { data: needsWellnessCheck } = await supabase
  .from('profiles')
  .select('*')
  .eq('availability_status', 'unavailable')
  .or(`unavailable_until.is.null,unavailable_until.lt.${new Date().toISOString()}`)
  .or(`last_wellness_check.is.null,last_wellness_check.lt.${thirtyDaysAgo.toISOString()}`);
```

---

## Part 3: Scheduled Job Setup

Use pg_cron to run the function daily:

```sql
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily at 9 AM Maldives time (4 AM UTC)
SELECT cron.schedule(
  'donor-wellness-check-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jfiepcajyctszbfskgfu.supabase.co/functions/v1/donor-wellness-check',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

## Part 4: Admin UI - Message Template Manager

### 4.1 Create `NotificationMessagesManager.tsx`

**Features:**
- List all notification message templates
- Edit message templates with preview
- Enable/disable individual message types
- Support template variables: `{full_name}`, `{blood_group}`, `{phone}`
- Show description and usage context
- Preview how message will look with sample data

**UI Layout:**
```text
┌─────────────────────────────────────────────────┐
│  Notification Messages                          │
├─────────────────────────────────────────────────┤
│  Configure automated SMS messages sent to donors│
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐    │
│  │ ✅ Ready to Donate Again               │    │
│  │    Sent when 90-day waiting ends        │    │
│  │                                         │    │
│  │ Template:                               │    │
│  │ [Hi {full_name}! Great news - your 90-  │    │
│  │  day waiting period is complete...]     │    │
│  │                                         │    │
│  │ Variables: {full_name}, {blood_group}   │    │
│  │ [Edit] [Test]                           │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ ✅ First Wellness Check                │    │
│  │    Sent after 30 days unavailable       │    │
│  │    ...                                  │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ ✅ Follow-up Wellness Check            │    │
│  │    Monthly check for unavailable donors │    │
│  │    ...                                  │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### 4.2 Add to Admin Settings Tab

Integrate into the existing Admin page settings tab alongside TelegramConfigManager:

```tsx
// In Admin.tsx settings tab
<Accordion type="multiple">
  <AccordionItem value="telegram">
    <AccordionTrigger>Telegram Notifications</AccordionTrigger>
    <AccordionContent>
      <TelegramConfigManager />
    </AccordionContent>
  </AccordionItem>
  
  <AccordionItem value="donor-notifications">
    <AccordionTrigger>Donor Notification Messages</AccordionTrigger>
    <AccordionContent>
      <NotificationMessagesManager />
    </AccordionContent>
  </AccordionItem>
  
  {/* ... existing accordion items */}
</Accordion>
```

---

## Part 5: Wellness Check History Panel

### 5.1 Create `WellnessCheckHistory.tsx`

Display log of all sent wellness notifications:

**Features:**
- Table showing: Donor Name, Type, Sent At, Status
- Filter by notification type
- Search by donor name
- Pagination
- Export capability

---

## File Changes Summary

### New Files
| File | Description |
|------|-------------|
| `supabase/functions/donor-wellness-check/index.ts` | Scheduled function for availability & wellness checks |
| `src/components/NotificationMessagesManager.tsx` | Admin UI for message template management |
| `src/components/WellnessCheckHistory.tsx` | Audit log of sent notifications |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/Admin.tsx` | Add NotificationMessagesManager to settings tab |
| `supabase/config.toml` | Register donor-wellness-check function |

### Database Changes
| Change | Description |
|--------|-------------|
| New table `notification_messages` | Store configurable message templates |
| New table `donor_wellness_logs` | Track sent notifications |
| New column `profiles.last_wellness_check` | Track last wellness check timestamp |
| New cron job | Schedule daily wellness check |

---

## Message Template Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{full_name}` | Donor's full name | Ahmed Ibrahim |
| `{blood_group}` | Donor's blood type | O+ |
| `{phone}` | Donor's phone number | 7915563 |
| `{days_unavailable}` | Days since set unavailable | 45 |
| `{last_donation}` | Last donation date | Jan 15, 2026 |

---

## Notification Flow Diagram

```text
┌─────────────┐
│  pg_cron    │
│  (Daily)    │
└──────┬──────┘
       │ 9 AM MVT
       ▼
┌────────────────────────┐
│ donor-wellness-check   │
│ Edge Function          │
└──────┬─────────────────┘
       │
       ├─────────────────────────────────────┐
       │                                     │
       ▼                                     ▼
┌────────────────────┐            ┌────────────────────┐
│ Check Available    │            │ Check Wellness     │
│ Date = Today       │            │ 30+ days inactive  │
└────────┬───────────┘            └────────┬───────────┘
         │                                 │
         ▼                                 ▼
┌────────────────────┐            ┌────────────────────┐
│ Get Message:       │            │ Get Message:       │
│ availability_      │            │ wellness_check_    │
│ restored           │            │ first/followup     │
└────────┬───────────┘            └────────┬───────────┘
         │                                 │
         └─────────────┬───────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │ Send SMS via   │
              │ Textbee API    │
              └────────┬───────┘
                       │
                       ▼
              ┌────────────────┐
              │ Log to         │
              │ wellness_logs  │
              └────────────────┘
```

---

## Security Considerations

1. **Message Templates**: Only admins can modify templates (RLS protected)
2. **Scheduled Job**: Uses anon key with no sensitive data in request
3. **SMS Rate Limiting**: One notification per donor per type per day
4. **Logging**: Full audit trail of all sent messages
5. **Opt-out**: Future enhancement could add SMS opt-out preference

---

## Testing Checklist

1. Admin can view and edit notification message templates
2. Message variables are correctly replaced with donor data
3. Scheduled function identifies correct donors for availability notification
4. Scheduled function identifies correct donors for wellness check
5. SMS is sent successfully via Textbee
6. Notifications are logged correctly
7. Duplicate notifications are prevented
8. Disabled messages are not sent
9. Telegram admin notification summarizes daily sends
