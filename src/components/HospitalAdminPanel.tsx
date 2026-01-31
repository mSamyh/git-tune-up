import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Pencil, Trash2, Copy, Eye, EyeOff, RefreshCw, MapPin, Phone, Mail, Droplets } from "lucide-react";

interface Hospital {
  id: string;
  name: string;
  address: string | null;
  atoll: string | null;
  island: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

interface Atoll {
  id: string;
  name: string;
}

interface Island {
  id: string;
  name: string;
  atoll_id: string;
}

export const HospitalAdminPanel = () => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [showPins, setShowPins] = useState<Record<string, boolean>>({});
  const [hospitalPins, setHospitalPins] = useState<Record<string, string>>({});
  const [atolls, setAtolls] = useState<Atoll[]>([]);
  const [islands, setIslands] = useState<Island[]>([]);
  const [filteredIslands, setFilteredIslands] = useState<Island[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    atoll: "",
    island: "",
    address: "",
    pin: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (formData.atoll) {
      const atoll = atolls.find(a => a.name === formData.atoll);
      if (atoll) {
        setFilteredIslands(islands.filter(i => i.atoll_id === atoll.id));
      } else {
        setFilteredIslands([]);
      }
    } else {
      setFilteredIslands([]);
    }
  }, [formData.atoll, atolls, islands]);

  const fetchData = async () => {
    setLoading(true);
    const [hospitalsRes, atollsRes, islandsRes] = await Promise.all([
      supabase.from("hospitals").select("*").order("created_at", { ascending: false }),
      supabase.from("atolls").select("*").order("name"),
      supabase.from("islands").select("*").order("name"),
    ]);

    if (hospitalsRes.error) {
      toast({ variant: "destructive", title: "Error", description: hospitalsRes.error.message });
    } else {
      setHospitals(hospitalsRes.data || []);
    }
    
    if (atollsRes.data) setAtolls(atollsRes.data);
    if (islandsRes.data) setIslands(islandsRes.data);
    setLoading(false);
  };

  const generatePin = () => {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    setFormData({ ...formData, pin });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.pin) {
      toast({ variant: "destructive", title: "Error", description: "Name and PIN are required" });
      return;
    }

    if (formData.pin.length !== 6) {
      toast({ variant: "destructive", title: "Error", description: "PIN must be 6 digits" });
      return;
    }

    setSubmitting(true);

    try {
      if (editingHospital) {
        // Update existing hospital via edge function
        const { data, error } = await supabase.functions.invoke("create-hospital", {
          body: {
            action: "update",
            hospitalId: editingHospital.id,
            name: formData.name,
            phone: formData.phone || null,
            email: formData.email || null,
            atoll: formData.atoll || null,
            island: formData.island || null,
            address: formData.address || null,
            pin: formData.pin,
          },
        });

        if (error) throw error;

        toast({ title: "Updated", description: "Hospital updated successfully" });
        // Store the PIN for display
        setHospitalPins(prev => ({ ...prev, [editingHospital.id]: formData.pin }));
      } else {
        // Create new hospital via edge function
        const { data, error } = await supabase.functions.invoke("create-hospital", {
          body: {
            action: "create",
            name: formData.name,
            phone: formData.phone || null,
            email: formData.email || null,
            atoll: formData.atoll || null,
            island: formData.island || null,
            address: formData.address || null,
            pin: formData.pin,
          },
        });

        if (error) throw error;

        toast({ title: "Created", description: "Hospital created successfully" });
        // Store the PIN for display
        if (data?.hospital?.id) {
          setHospitalPins(prev => ({ ...prev, [data.hospital.id]: formData.pin }));
        }
      }

      setShowAddDialog(false);
      setEditingHospital(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to save hospital" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", phone: "", email: "", atoll: "", island: "", address: "", pin: "" });
  };

  const handleEdit = (hospital: Hospital) => {
    setEditingHospital(hospital);
    setFormData({
      name: hospital.name,
      phone: hospital.phone || "",
      email: hospital.email || "",
      atoll: hospital.atoll || "",
      island: hospital.island || "",
      address: hospital.address || "",
      pin: hospitalPins[hospital.id] || "",
    });
    setShowAddDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this hospital? This will also delete all blood stock records.")) return;

    const { error } = await supabase.from("hospitals").delete().eq("id", id);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Deleted", description: "Hospital deleted successfully" });
      fetchData();
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("hospitals")
      .update({ is_active: !isActive })
      .eq("id", id);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      fetchData();
    }
  };

  const copyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    toast({ title: "Copied", description: "PIN copied to clipboard" });
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Hospital Management
            </CardTitle>
            <CardDescription>Manage hospitals and their access PINs for blood stock updates</CardDescription>
          </div>
          <Dialog open={showAddDialog} onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) {
              setEditingHospital(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-xl">
                <Plus className="h-4 w-4 mr-1" />
                Add Hospital
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingHospital ? "Edit" : "Add"} Hospital</DialogTitle>
                <DialogDescription>
                  {editingHospital ? "Update hospital details" : "Create a new hospital with access PIN"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Hospital Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. IGMH"
                    className="rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Atoll</Label>
                    <Select
                      value={formData.atoll}
                      onValueChange={(value) => setFormData({ ...formData, atoll: value, island: "" })}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select atoll" />
                      </SelectTrigger>
                      <SelectContent>
                        {atolls.map((atoll) => (
                          <SelectItem key={atoll.id} value={atoll.name}>{atoll.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Island</Label>
                    <Select
                      value={formData.island}
                      onValueChange={(value) => setFormData({ ...formData, island: value })}
                      disabled={!formData.atoll}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select island" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredIslands.map((island) => (
                          <SelectItem key={island.id} value={island.name}>{island.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Street address"
                    className="rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="3xxxxxx"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="hospital@example.com"
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>6-Digit PIN *</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.pin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setFormData({ ...formData, pin: val });
                      }}
                      placeholder="123456"
                      className="rounded-xl font-mono text-center text-lg"
                      maxLength={6}
                    />
                    <Button variant="outline" size="icon" onClick={generatePin} className="rounded-xl">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this PIN with hospital staff to access the stock management portal
                  </p>
                </div>

                <Button onClick={handleSubmit} className="w-full rounded-xl" disabled={submitting}>
                  {submitting ? "Saving..." : (editingHospital ? "Update" : "Create")} Hospital
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : hospitals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No hospitals yet. Add your first hospital above.</p>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="sm:hidden space-y-3">
              {hospitals.map((hospital) => (
                <div key={hospital.id} className="bg-muted/30 border rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{hospital.name}</p>
                      {(hospital.atoll || hospital.island) && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[hospital.island, hospital.atoll].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={hospital.is_active}
                        onCheckedChange={() => toggleActive(hospital.id, hospital.is_active)}
                      />
                    </div>
                  </div>
                  
                  {hospitalPins[hospital.id] && (
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-1 rounded text-sm font-mono flex-1 text-center">
                        {showPins[hospital.id] ? hospitalPins[hospital.id] : "••••••"}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setShowPins({ ...showPins, [hospital.id]: !showPins[hospital.id] })}
                      >
                        {showPins[hospital.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyPin(hospitalPins[hospital.id])}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-2 border-t">
                    <Button size="sm" variant="outline" className="flex-1 h-9 rounded-xl" onClick={() => handleEdit(hospital)}>
                      <Pencil className="h-4 w-4 mr-1.5" /> Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl" 
                      onClick={() => handleDelete(hospital.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hospital</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>PIN</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hospitals.map((hospital) => (
                    <TableRow key={hospital.id}>
                      <TableCell>
                        <p className="font-medium">{hospital.name}</p>
                      </TableCell>
                      <TableCell>
                        {(hospital.atoll || hospital.island) ? (
                          <span className="text-sm text-muted-foreground">
                            {[hospital.island, hospital.atoll].filter(Boolean).join(", ")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {hospital.phone && (
                            <p className="text-sm flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {hospital.phone}
                            </p>
                          )}
                          {hospital.email && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {hospital.email}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {hospitalPins[hospital.id] ? (
                          <div className="flex items-center gap-2">
                            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                              {showPins[hospital.id] ? hospitalPins[hospital.id] : "••••••"}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setShowPins({ ...showPins, [hospital.id]: !showPins[hospital.id] })}
                            >
                              {showPins[hospital.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => copyPin(hospitalPins[hospital.id])}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Edit to set PIN</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={hospital.is_active}
                            onCheckedChange={() => toggleActive(hospital.id, hospital.is_active)}
                          />
                          <Badge variant={hospital.is_active ? "default" : "secondary"}>
                            {hospital.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(hospital)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(hospital.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
