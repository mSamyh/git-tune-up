
# Enhanced Hospital Portal: Email/Password Auth & Individual Blood Unit Tracking

## Overview

This plan transforms the hospital portal from PIN-based authentication to email/password authentication (using Supabase Auth), and upgrades blood stock management from aggregate counts to individual unit tracking with full traceability.

---

## Current State vs New State

| Feature | Current | New |
|---------|---------|-----|
| **Hospital Auth** | 6-digit PIN (shared credential) | Email/Password per hospital account |
| **Blood Tracking** | Aggregate units per blood group | Individual unit with full metadata |
| **Unit Details** | Only expiry date + notes | Collection date, donor ID, expiry, status, batch, remarks |
| **Admin Control** | PIN generation | Full credential management (email/password reset) |

---

## Part 1: Database Schema Changes

### 1.1 Update `hospitals` Table

Add columns for Supabase Auth integration:

```sql
ALTER TABLE hospitals ADD COLUMN auth_user_id UUID REFERENCES auth.users(id);
ALTER TABLE hospitals ADD COLUMN login_email TEXT;
-- Keep pin_hash for backwards compatibility during transition
```

### 1.2 Create `blood_units` Table (Individual Unit Tracking)

```sql
CREATE TABLE blood_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  blood_group TEXT NOT NULL,
  
  -- Collection Details
  collection_date DATE NOT NULL,
  donor_id TEXT, -- External donor reference (not linked to app donors)
  donor_name TEXT,
  
  -- Unit Details  
  bag_number TEXT, -- Bag/unit identifier
  volume_ml INTEGER DEFAULT 450,
  
  -- Expiry & Status
  expiry_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'available', 
  -- Statuses: 'available', 'reserved', 'transfused', 'expired', 'discarded', 'transferred'
  
  -- Tracking
  reserved_for TEXT, -- Patient name if reserved
  reserved_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  
  -- Metadata
  batch_number TEXT,
  component_type TEXT DEFAULT 'whole_blood', 
  -- Types: 'whole_blood', 'packed_rbc', 'plasma', 'platelets', 'cryoprecipitate'
  
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX idx_blood_units_hospital ON blood_units(hospital_id);
CREATE INDEX idx_blood_units_blood_group ON blood_units(blood_group);
CREATE INDEX idx_blood_units_status ON blood_units(status);
CREATE INDEX idx_blood_units_expiry ON blood_units(expiry_date);
```

### 1.3 Create `blood_unit_history` Table (Audit Trail)

```sql
CREATE TABLE blood_unit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blood_unit_id UUID REFERENCES blood_units(id) ON DELETE SET NULL,
  hospital_id UUID NOT NULL REFERENCES hospitals(id),
  blood_group TEXT NOT NULL,
  
  action TEXT NOT NULL, -- 'created', 'reserved', 'transfused', 'expired', 'discarded', 'status_changed'
  previous_status TEXT,
  new_status TEXT,
  
  patient_name TEXT,
  notes TEXT,
  
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.4 RLS Policies

```sql
-- blood_units: Hospital staff can manage their own units
CREATE POLICY "Hospitals can manage their own units"
ON blood_units FOR ALL
USING (
  hospital_id IN (
    SELECT id FROM hospitals WHERE auth_user_id = auth.uid()
  )
);

-- Public can view available units (counts only, not individual details)
CREATE POLICY "Public can view blood unit counts"
ON blood_units FOR SELECT
USING (true);

-- blood_unit_history: Hospital staff can view their history
CREATE POLICY "Hospitals can view their own history"
ON blood_unit_history FOR SELECT
USING (
  hospital_id IN (
    SELECT id FROM hospitals WHERE auth_user_id = auth.uid()
  )
);

-- Admins can view all
CREATE POLICY "Admins can manage all blood units"
ON blood_units FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all history"
ON blood_unit_history FOR ALL
USING (has_role(auth.uid(), 'admin'));
```

---

## Part 2: Edge Function Updates

### 2.1 New Edge Function: `create-hospital-account`

Creates a Supabase Auth user for the hospital and links it:

```typescript
// Request body
{
  hospital_id: string, // Existing hospital ID
  email: string,
  password: string,
  // OR action to update existing
  action: "create" | "update_password" | "update_email"
}

// Process:
1. Validate admin caller
2. Create Supabase auth user via supabase.auth.admin.createUser()
3. Update hospitals table with auth_user_id and login_email
4. Return credentials (email only, never password)
```

### 2.2 Update `create-hospital` Edge Function

Modify to also create auth account:

```typescript
// After creating hospital record:
const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
  email: formData.email,
  password: formData.password,
  email_confirm: true, // Auto-confirm
  user_metadata: {
    hospital_id: hospital.id,
    hospital_name: hospital.name,
    role: 'hospital'
  }
});

// Link auth user to hospital
await supabase
  .from("hospitals")
  .update({ 
    auth_user_id: authUser.user.id,
    login_email: formData.email 
  })
  .eq("id", hospital.id);
```

### 2.3 New Edge Function: `manage-blood-unit`

Handles individual unit CRUD operations:

```typescript
interface ManageBloodUnitRequest {
  action: "add" | "update" | "reserve" | "transfuse" | "discard" | "expire";
  hospital_id: string;
  unit_id?: string; // For updates
  
  // For adding new unit
  blood_group?: string;
  collection_date?: string;
  expiry_date?: string;
  donor_id?: string;
  donor_name?: string;
  bag_number?: string;
  volume_ml?: number;
  batch_number?: string;
  component_type?: string;
  remarks?: string;
  
  // For reserve/transfuse
  patient_name?: string;
  notes?: string;
}
```

---

## Part 3: Frontend Changes

### 3.1 Update `HospitalAdminPanel.tsx`

**New Form Fields:**
```tsx
const [formData, setFormData] = useState({
  name: "",
  phone: "",
  email: "", // Now used for login
  password: "", // New field
  confirmPassword: "", // New field
  atoll: "",
  island: "",
  address: "",
});

// Password generation helper
const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  setFormData({ ...formData, password, confirmPassword: password });
};
```

**UI Changes:**
- Replace PIN field with Email/Password fields
- Add "Generate Password" button
- Add password visibility toggle
- Add "Reset Password" action for existing hospitals
- Show login email instead of PIN

**Credential Management Section:**
```tsx
<Card className="mt-4">
  <CardHeader>
    <CardTitle className="text-base">Login Credentials</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label>Login Email *</Label>
      <Input
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        placeholder="hospital@example.com"
      />
    </div>
    <div className="space-y-2">
      <Label>Password *</Label>
      <div className="flex gap-2">
        <Input
          type={showPassword ? "text" : "password"}
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          placeholder="Min 8 characters"
        />
        <Button variant="outline" size="icon" onClick={togglePasswordVisibility}>
          {showPassword ? <EyeOff /> : <Eye />}
        </Button>
        <Button variant="outline" size="icon" onClick={generatePassword}>
          <RefreshCw />
        </Button>
      </div>
    </div>
  </CardContent>
</Card>
```

### 3.2 Update `HospitalPortal.tsx`

**Replace PIN auth with email/password login:**

```tsx
const HospitalPortal = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  
  // Check if already logged in as hospital
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.user_metadata?.hospital_id) {
        fetchHospitalData(session.user.user_metadata.hospital_id);
      }
    };
    checkSession();
  }, []);
  
  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      toast.error(error.message);
      return;
    }
    
    // Verify this is a hospital account
    if (!data.user.user_metadata?.hospital_id) {
      await supabase.auth.signOut();
      toast.error("This account is not authorized for hospital portal");
      return;
    }
    
    fetchHospitalData(data.user.user_metadata.hospital_id);
  };
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setHospital(null);
    toast.info("Logged out successfully");
  };
  
  // Login UI
  if (!hospital) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Building2 className="h-12 w-12 mx-auto text-primary mb-4" />
            <CardTitle>Hospital Portal</CardTitle>
            <CardDescription>Login with your hospital credentials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hospital@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>
            <Button onClick={handleLogin} className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Contact admin for portal access
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Dashboard (same as before but with new stock manager)
  return (
    <div className="min-h-screen">
      {/* Header with logout */}
      <HospitalStockManager
        hospitalId={hospital.id}
        bloodUnits={bloodUnits}
        onUpdate={fetchBloodUnits}
      />
    </div>
  );
};
```

### 3.3 New Component: `BloodUnitManager.tsx`

**Individual Unit Management Interface:**

```tsx
interface BloodUnit {
  id: string;
  blood_group: string;
  collection_date: string;
  expiry_date: string;
  donor_id: string | null;
  donor_name: string | null;
  bag_number: string | null;
  volume_ml: number;
  status: 'available' | 'reserved' | 'transfused' | 'expired' | 'discarded';
  reserved_for: string | null;
  component_type: string;
  remarks: string | null;
}

// Component structure:
<Tabs defaultValue="available">
  <TabsList>
    <TabsTrigger value="available">Available ({availableCount})</TabsTrigger>
    <TabsTrigger value="reserved">Reserved ({reservedCount})</TabsTrigger>
    <TabsTrigger value="all">All Units</TabsTrigger>
  </TabsList>
  
  <TabsContent value="available">
    {/* Grid of blood groups with expandable unit lists */}
    {BLOOD_GROUPS.map(group => (
      <BloodGroupSection
        key={group}
        bloodGroup={group}
        units={units.filter(u => u.blood_group === group && u.status === 'available')}
        onUnitAction={handleUnitAction}
      />
    ))}
  </TabsContent>
</Tabs>
```

### 3.4 New Component: `AddBloodUnitSheet.tsx`

**Form for adding individual blood units:**

```tsx
<Sheet>
  <SheetContent side="bottom" className="h-[90vh]">
    <SheetHeader>
      <SheetTitle>Add Blood Unit</SheetTitle>
    </SheetHeader>
    
    <div className="space-y-6">
      {/* Blood Group Selection */}
      <div className="grid grid-cols-4 gap-2">
        {BLOOD_GROUPS.map(group => (
          <Button
            key={group}
            variant={selectedGroup === group ? "default" : "outline"}
            onClick={() => setSelectedGroup(group)}
          >
            {group}
          </Button>
        ))}
      </div>
      
      {/* Collection Details */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Collection Date *</Label>
            <DatePicker value={collectionDate} onChange={setCollectionDate} />
          </div>
          <div className="space-y-2">
            <Label>Expiry Date *</Label>
            <DatePicker value={expiryDate} onChange={setExpiryDate} />
            <p className="text-xs text-muted-foreground">
              Default: 35 days from collection
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Donor ID</Label>
            <Input placeholder="External donor ID" />
          </div>
          <div className="space-y-2">
            <Label>Donor Name</Label>
            <Input placeholder="Optional" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Bag Number</Label>
            <Input placeholder="Unit/Bag identifier" />
          </div>
          <div className="space-y-2">
            <Label>Volume (ml)</Label>
            <Input type="number" defaultValue={450} />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Component Type</Label>
            <Select defaultValue="whole_blood">
              <SelectItem value="whole_blood">Whole Blood</SelectItem>
              <SelectItem value="packed_rbc">Packed RBC</SelectItem>
              <SelectItem value="plasma">Fresh Frozen Plasma</SelectItem>
              <SelectItem value="platelets">Platelets</SelectItem>
              <SelectItem value="cryoprecipitate">Cryoprecipitate</SelectItem>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Batch Number</Label>
            <Input placeholder="Optional" />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Remarks</Label>
          <Textarea placeholder="Any additional notes..." />
        </div>
      </div>
      
      <Button className="w-full" onClick={handleAddUnit}>
        Add Blood Unit
      </Button>
    </div>
  </SheetContent>
</Sheet>
```

### 3.5 New Component: `BloodUnitCard.tsx`

**Individual unit display with quick actions:**

```tsx
<Card className="p-4">
  <div className="flex items-start justify-between">
    <div className="flex items-center gap-3">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getStatusColor(unit.status)}`}>
        <Droplets className="h-6 w-6" />
      </div>
      <div>
        <p className="font-semibold">{unit.blood_group}</p>
        <p className="text-sm text-muted-foreground">Bag: {unit.bag_number || 'N/A'}</p>
      </div>
    </div>
    <Badge variant={getStatusVariant(unit.status)}>
      {unit.status}
    </Badge>
  </div>
  
  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
    <div>
      <p className="text-muted-foreground">Collected</p>
      <p>{format(unit.collection_date, 'MMM d, yyyy')}</p>
    </div>
    <div>
      <p className="text-muted-foreground">Expires</p>
      <p className={isExpiringSoon(unit.expiry_date) ? 'text-amber-600 font-medium' : ''}>
        {format(unit.expiry_date, 'MMM d, yyyy')}
      </p>
    </div>
    {unit.donor_name && (
      <div className="col-span-2">
        <p className="text-muted-foreground">Donor</p>
        <p>{unit.donor_name} {unit.donor_id && `(${unit.donor_id})`}</p>
      </div>
    )}
  </div>
  
  {/* Quick Actions */}
  {unit.status === 'available' && (
    <div className="mt-4 flex gap-2">
      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleReserve(unit)}>
        <Bookmark className="h-4 w-4 mr-1" /> Reserve
      </Button>
      <Button size="sm" variant="default" className="flex-1" onClick={() => handleTransfuse(unit)}>
        <HeartPulse className="h-4 w-4 mr-1" /> Use
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleDiscard(unit)}>
            <Trash2 className="h-4 w-4 mr-2" /> Discard
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleEdit(unit)}>
            <Pencil className="h-4 w-4 mr-2" /> Edit
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )}
</Card>
```

### 3.6 Update `HospitalStockManager.tsx`

**Replace aggregate view with unit-based view:**

```tsx
const HospitalStockManager = ({ hospitalId }: { hospitalId: string }) => {
  const [units, setUnits] = useState<BloodUnit[]>([]);
  const [viewMode, setViewMode] = useState<'summary' | 'units'>('summary');
  
  // Calculate summary from individual units
  const summary = useMemo(() => {
    const grouped = groupBy(units.filter(u => u.status === 'available'), 'blood_group');
    return BLOOD_GROUPS.map(group => ({
      blood_group: group,
      total_units: grouped[group]?.length || 0,
      expiring_soon: grouped[group]?.filter(u => isExpiringSoon(u.expiry_date)).length || 0,
      oldest_expiry: grouped[group]?.sort((a, b) => 
        new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
      )[0]?.expiry_date || null,
    }));
  }, [units]);
  
  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex gap-2">
        <Button
          variant={viewMode === 'summary' ? 'default' : 'outline'}
          onClick={() => setViewMode('summary')}
        >
          Summary View
        </Button>
        <Button
          variant={viewMode === 'units' ? 'default' : 'outline'}
          onClick={() => setViewMode('units')}
        >
          Unit Details
        </Button>
      </div>
      
      {viewMode === 'summary' ? (
        <BloodStockSummary summary={summary} onSelectGroup={handleGroupSelect} />
      ) : (
        <BloodUnitList units={units} onUnitAction={handleUnitAction} />
      )}
      
      {/* Add Unit FAB */}
      <AddBloodUnitSheet hospitalId={hospitalId} onAdd={handleAddUnit} />
    </div>
  );
};
```

---

## Part 4: Public Blood Stock View Updates

### 4.1 Update `BloodStock.tsx` and `BloodStockOverview.tsx`

Aggregate individual units for public display:

```tsx
// Query aggregated data from blood_units instead of blood_stock
const { data: stockData } = await supabase
  .from('blood_units')
  .select('hospital_id, blood_group')
  .eq('status', 'available')
  .then(result => {
    // Group by hospital and blood type
    return Object.entries(groupBy(result.data, 'hospital_id')).map(([hospitalId, units]) => ({
      hospital_id: hospitalId,
      stock: BLOOD_GROUPS.map(group => ({
        blood_group: group,
        count: units.filter(u => u.blood_group === group).length
      }))
    }));
  });
```

---

## Part 5: Migration Strategy

### 5.1 Backwards Compatibility

Keep the existing `blood_stock` table and PIN system during transition:
1. New hospitals get email/password auth
2. Existing hospitals can continue using PIN
3. Admin can "upgrade" existing hospitals to email auth
4. Eventually deprecate PIN system

### 5.2 Data Migration

If hospitals have existing aggregate stock data, provide option to:
- Import as individual units (estimated)
- Start fresh with individual tracking

---

## File Changes Summary

### New Files
| File | Description |
|------|-------------|
| `src/components/hospital/BloodUnitManager.tsx` | Main unit management interface |
| `src/components/hospital/AddBloodUnitSheet.tsx` | Form for adding new units |
| `src/components/hospital/BloodUnitCard.tsx` | Individual unit display card |
| `src/components/hospital/BloodUnitActions.tsx` | Reserve/Transfuse/Discard dialogs |
| `src/components/hospital/BloodStockSummary.tsx` | Summary view of aggregated units |
| `supabase/functions/manage-blood-unit/index.ts` | CRUD for individual units |
| `supabase/functions/create-hospital-account/index.ts` | Hospital auth management |

### Modified Files
| File | Changes |
|------|---------|
| `src/components/HospitalAdminPanel.tsx` | Replace PIN with email/password, add credential management |
| `src/pages/HospitalPortal.tsx` | Replace PIN auth with email/password login |
| `src/components/hospital/HospitalStockManager.tsx` | Support individual unit tracking |
| `src/pages/BloodStock.tsx` | Aggregate from blood_units |
| `src/components/BloodStockOverview.tsx` | Aggregate from blood_units |
| `supabase/functions/create-hospital/index.ts` | Add auth user creation |

### Database Migrations
1. Add `auth_user_id` and `login_email` columns to hospitals
2. Create `blood_units` table with indexes
3. Create `blood_unit_history` table
4. Add RLS policies for new tables
5. Add trigger for auto-expiry status updates

---

## Visual Mockups

### Admin Hospital Form (New)
```text
┌─────────────────────────────────────────────┐
│           Add Hospital                      │
├─────────────────────────────────────────────┤
│  Hospital Name *                            │
│  [________________________]                 │
│                                             │
│  [Atoll ▾]          [Island ▾]              │
│  [Address________________________]          │
│  [Phone_________]  [Contact Email____]      │
│                                             │
│  ─ Login Credentials ────────────────────  │
│                                             │
│  Login Email *                              │
│  [hospital@example.com_________________]    │
│                                             │
│  Password *                                 │
│  [●●●●●●●●●●●●] [👁] [🔄 Generate]          │
│                                             │
│  ℹ️ Share these credentials with hospital   │
│     staff to access the portal              │
│                                             │
├─────────────────────────────────────────────┤
│  [Cancel]              [Create Hospital]    │
└─────────────────────────────────────────────┘
```

### Hospital Portal Login (New)
```text
┌─────────────────────────────────────────────┐
│        🏥 Hospital Portal                   │
├─────────────────────────────────────────────┤
│                                             │
│      Login with your hospital credentials   │
│                                             │
│  Email                                      │
│  [hospital@example.com_________________]    │
│                                             │
│  Password                                   │
│  [________________________]                 │
│                                             │
│  [━━━━━━━━━━ Login ━━━━━━━━━━]              │
│                                             │
│  [Forgot password?]                         │
│                                             │
│  Contact admin for portal access            │
└─────────────────────────────────────────────┘
```

### Blood Unit List View
```text
┌─────────────────────────────────────────────┐
│  [Summary] [Unit Details●]                  │
├─────────────────────────────────────────────┤
│  Filter: [All ▾] [Available ▾]              │
│  Search: [Bag number, donor...]             │
├─────────────────────────────────────────────┤
│  ┌── A+ ─────────────────────────────────┐  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │ 🩸 A+           [Available]     │  │  │
│  │  │ Bag: BG-2024-001               │  │  │
│  │  │ Collected: Jan 15  Expires: Feb 19│  │
│  │  │ Donor: Ahmed Ibrahim            │  │  │
│  │  │ [Reserve] [Use] [⋮]             │  │  │
│  │  └─────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │ 🩸 A+           [Available]     │  │  │
│  │  │ Bag: BG-2024-002  ⚠️ Exp: 3 days│  │  │
│  │  │ ...                             │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌── B+ ─────────────────────────────────┐  │
│  │  ...                                  │  │
│  └───────────────────────────────────────┘  │
│                                             │
│        [+ Add Blood Unit]                   │
└─────────────────────────────────────────────┘
```

### Add Blood Unit Form
```text
┌─────────────────────────────────────────────┐
│           Add Blood Unit                    │
├─────────────────────────────────────────────┤
│  Blood Group                                │
│  [A+] [A-] [B+] [B-]                        │
│  [O+●][O-] [AB+][AB-]                       │
│                                             │
│  ─ Collection Details ───────────────────  │
│  [📅 Collection Date]  [📅 Expiry Date]    │
│        Jan 15, 2026         Feb 19, 2026   │
│                                             │
│  [Donor ID_______]  [Donor Name________]    │
│                                             │
│  ─ Unit Details ─────────────────────────  │
│  [Bag Number____]  [Volume: 450 ml]        │
│  [Batch No______]  [Component: Whole Blood▾]│
│                                             │
│  Remarks                                    │
│  [__________________________________]       │
│                                             │
├─────────────────────────────────────────────┤
│  [Cancel]              [Add Unit]           │
└─────────────────────────────────────────────┘
```

---

## Security Considerations

1. **Hospital Authentication**: Uses Supabase Auth (same security as donor accounts)
2. **Session Management**: JWT-based, automatic refresh
3. **RLS Policies**: Hospital staff can only access their own hospital's data
4. **Audit Trail**: All unit actions logged with user ID and timestamp
5. **Password Requirements**: Minimum 8 characters, recommend auto-generation

---

## Testing Checklist

1. Admin can create new hospital with email/password
2. Admin can reset hospital password
3. Hospital can login with email/password
4. Hospital can add individual blood units
5. Hospital can reserve/transfuse/discard units
6. Expiring units are highlighted
7. Expired units auto-marked (via scheduled job)
8. Public stock view shows aggregated counts
9. Unit history is properly logged
10. RLS prevents cross-hospital access
