

# Donor Health Timeline - Implementation Plan

## Overview

Create a private, advanced health timeline dashboard for donors that tracks hemoglobin levels, donation intervals, deferral history, and health notes. This feature encourages safe, responsible donation by providing donors with visibility into their health metrics over time.

---

## Design Approach

Following the existing Instagram-inspired UI patterns, the Health Timeline will be a new tab in the Profile page with a modern, visually-rich design featuring:

- **Timeline visualization** with connected health entries
- **Interactive charts** for hemoglobin trends using Recharts (already installed)
- **Collapsible sections** for detailed health records
- **Color-coded status indicators** for health metrics

---

## Database Schema Changes

### New Table: `donor_health_records`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Primary key |
| `donor_id` | uuid (FK) | References profiles.id |
| `donation_id` | uuid (FK, nullable) | References donation_history.id |
| `record_date` | date | Date of the health record |
| `hemoglobin_level` | numeric(4,1) | Hemoglobin in g/dL (e.g., 13.5) |
| `blood_pressure_systolic` | integer | Optional: systolic BP |
| `blood_pressure_diastolic` | integer | Optional: diastolic BP |
| `pulse_rate` | integer | Optional: pulse in BPM |
| `weight_kg` | numeric(5,2) | Optional: weight in kg |
| `deferral_reason` | text | If deferred, the reason |
| `deferral_duration_days` | integer | Days of deferral |
| `health_notes` | text | Private notes |
| `recorded_by` | text | 'self' or 'hospital' |
| `created_at` | timestamptz | Auto timestamp |
| `updated_at` | timestamptz | Auto timestamp |

### RLS Policies

```sql
-- Users can only view their own health records
CREATE POLICY "Users can view own health records"
ON donor_health_records FOR SELECT
USING (auth.uid() = donor_id);

-- Users can insert their own health records
CREATE POLICY "Users can insert own health records"
ON donor_health_records FOR INSERT
WITH CHECK (auth.uid() = donor_id);

-- Users can update their own health records
CREATE POLICY "Users can update own health records"
ON donor_health_records FOR UPDATE
USING (auth.uid() = donor_id);

-- Users can delete their own health records
CREATE POLICY "Users can delete own health records"
ON donor_health_records FOR DELETE
USING (auth.uid() = donor_id);

-- Admins can manage all records
CREATE POLICY "Admins can manage all health records"
ON donor_health_records FOR ALL
USING (has_role(auth.uid(), 'admin'));
```

---

## Component Architecture

### New Components

```
src/components/
├── health/
│   ├── HealthTimeline.tsx          # Main timeline component
│   ├── HealthTimelineEntry.tsx     # Individual timeline entry
│   ├── HemoglobinChart.tsx         # Recharts line chart for Hb trends
│   ├── DonationIntervalStats.tsx   # Interval analysis component
│   ├── DeferralHistory.tsx         # Deferral records section
│   ├── AddHealthRecordSheet.tsx    # Bottom sheet for adding records
│   └── HealthInsightsCard.tsx      # AI-powered health insights
```

---

## UI/UX Design

### Profile Page Tab Addition

Add a new "Health" tab (Heart icon) to the existing Profile tabs:

```
[Posts] [Saved] [Health] [Settings]
  📸      🔖      ❤️       ⚙️
```

### Health Timeline Tab Content

```text
┌─────────────────────────────────────────────┐
│  ❤️ Health Timeline                         │
│  Private health dashboard                   │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─ Hemoglobin Trend ─────────────────────┐ │
│  │  📈 Line chart (last 12 months)        │ │
│  │  Current: 14.2 g/dL  ✅ Normal         │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌─ Quick Stats ──────────────────────────┐ │
│  │  [⏱️ Avg Interval] [📊 Records] [⚠️ ]  │ │
│  │    102 days         12          0 def. │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌─ Health Records ───────────────────────┐ │
│  │  🔴 Jan 15, 2025                       │ │
│  │  ├─ Hb: 14.2 g/dL (Normal)             │ │
│  │  ├─ BP: 120/80 mmHg                    │ │
│  │  └─ Hospital donation                   │ │
│  │                                         │ │
│  │  🔴 Oct 08, 2024                       │ │
│  │  ├─ Hb: 13.8 g/dL (Normal)             │ │
│  │  └─ Self-recorded                       │ │
│  │                                         │ │
│  │  ⚠️ Jul 22, 2024 - DEFERRED            │ │
│  │  ├─ Hb: 11.5 g/dL (Low)                │ │
│  │  └─ Reason: Low hemoglobin             │ │
│  └────────────────────────────────────────┘ │
│                                             │
│           [+ Add Health Record]             │
└─────────────────────────────────────────────┘
```

### Add Health Record Sheet

```text
┌─────────────────────────────────────────────┐
│           Add Health Record                 │
│  Track your donation health metrics         │
├─────────────────────────────────────────────┤
│                                             │
│  Record Date                                │
│  [📅 Jan 28, 2026                    ▼]    │
│                                             │
│  ─ Hemoglobin ───────────────────────────  │
│  [    14.2    ] g/dL                       │
│  Normal: 12.0-17.5 for adults              │
│                                             │
│  ─ Blood Pressure (optional) ────────────  │
│  [  120  ] / [  80  ] mmHg                 │
│                                             │
│  ─ Other Metrics ────────────────────────  │
│  Pulse: [  72  ] BPM                       │
│  Weight: [  65.5  ] kg                     │
│                                             │
│  ─ Deferral Info ────────────────────────  │
│  [ ] I was deferred from donating          │
│                                             │
│  ─ Health Notes (private) ───────────────  │
│  [                                    ]    │
│  [                                    ]    │
│                                             │
├─────────────────────────────────────────────┤
│  [Cancel]              [Save Record]        │
└─────────────────────────────────────────────┘
```

---

## Key Features

### 1. Hemoglobin Trend Chart
- Line chart using Recharts (already installed)
- Shows last 12 months of hemoglobin readings
- Color-coded zones: Green (normal), Yellow (borderline), Red (low)
- Normal range indicator bands

### 2. Donation Interval Analysis
- Calculate average days between donations
- Show consistency patterns
- Alert if donating too frequently (< 56 days)

### 3. Deferral Tracking
- Log deferral reasons (low hemoglobin, medication, travel, illness, etc.)
- Track deferral duration
- Show deferral history with reasons

### 4. Health Insights Card
- AI-powered insights using Lovable AI
- "Your hemoglobin has been stable for 6 months"
- "Consider increasing iron-rich foods before next donation"
- "You've maintained healthy donation intervals"

### 5. Privacy First
- All health data is private (RLS enforced)
- Option to add private notes
- No health data visible to other users

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/pages/Profile.tsx` | MODIFY | Add "Health" tab and integrate HealthTimeline |
| `src/components/health/HealthTimeline.tsx` | CREATE | Main health timeline component |
| `src/components/health/HealthTimelineEntry.tsx` | CREATE | Individual entry in timeline |
| `src/components/health/HemoglobinChart.tsx` | CREATE | Recharts hemoglobin trend line chart |
| `src/components/health/DonationIntervalStats.tsx` | CREATE | Interval statistics component |
| `src/components/health/DeferralHistory.tsx` | CREATE | Deferral records display |
| `src/components/health/AddHealthRecordSheet.tsx` | CREATE | Sheet for adding health records |
| `src/components/health/HealthInsightsCard.tsx` | CREATE | AI-powered health insights |

---

## Migration SQL

```sql
-- Create donor_health_records table
CREATE TABLE public.donor_health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  donation_id UUID REFERENCES donation_history(id) ON DELETE SET NULL,
  record_date DATE NOT NULL,
  hemoglobin_level NUMERIC(4,1),
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  pulse_rate INTEGER,
  weight_kg NUMERIC(5,2),
  deferral_reason TEXT,
  deferral_duration_days INTEGER,
  health_notes TEXT,
  recorded_by TEXT DEFAULT 'self',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE donor_health_records ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_health_records_donor ON donor_health_records(donor_id);
CREATE INDEX idx_health_records_date ON donor_health_records(donor_id, record_date DESC);

-- Add updated_at trigger
CREATE TRIGGER update_health_records_updated_at
  BEFORE UPDATE ON donor_health_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Technical Implementation Details

### HealthTimeline Component Structure

```tsx
// Main component with data fetching and state management
const HealthTimeline = ({ userId }: { userId: string }) => {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [showAddSheet, setShowAddSheet] = useState(false);
  
  // Fetch health records with isMounted pattern
  // Calculate statistics (avg Hb, avg interval, deferral count)
  // Render chart, stats, and timeline entries
};
```

### Hemoglobin Chart Configuration

```tsx
// Using Recharts with gradient fill
<ResponsiveContainer width="100%" height={180}>
  <LineChart data={hemoglobinData}>
    <defs>
      <linearGradient id="hbGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
      </linearGradient>
    </defs>
    <XAxis dataKey="date" />
    <YAxis domain={[10, 18]} />
    <ReferenceLine y={12} stroke="#fbbf24" strokeDasharray="3 3" />
    <Line type="monotone" dataKey="hemoglobin" stroke="#ef4444" />
    <Area type="monotone" dataKey="hemoglobin" fill="url(#hbGradient)" />
  </LineChart>
</ResponsiveContainer>
```

### Health Status Indicators

```tsx
// Hemoglobin status helper
const getHemoglobinStatus = (level: number) => {
  if (level < 12.0) return { status: 'low', color: 'red', label: 'Low' };
  if (level < 12.5) return { status: 'borderline', color: 'amber', label: 'Borderline' };
  return { status: 'normal', color: 'green', label: 'Normal' };
};
```

---

## Design Consistency

Following existing patterns from the codebase:

- **Cards**: `rounded-2xl border-border/50 shadow-soft`
- **Inner sections**: `rounded-xl bg-muted/30`
- **Icons in containers**: `w-10 h-10 rounded-xl bg-primary/10`
- **Buttons**: `h-11 rounded-xl`
- **Badge styling**: Following PointsHistoryPanel patterns
- **Timeline design**: Similar to DonationHistoryByYear collapsible year groups
- **Sheet component**: `side="bottom" className="rounded-t-3xl"`

---

## Privacy & Security Considerations

1. **RLS Policies**: Strict row-level security ensuring users only access their own health data
2. **No Public Visibility**: Health data is never exposed in donor directory or public profiles
3. **Optional Fields**: Most fields are optional to respect user privacy
4. **Private Notes**: Health notes are for personal use only
5. **Admin Access**: Admins can view for support purposes but limited to necessity

