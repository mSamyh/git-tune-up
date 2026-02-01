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
import { Building2, Plus, Pencil, Trash2, Copy, Eye, EyeOff, RefreshCw, MapPin, Phone, Mail, Key } from "lucide-react";

interface Hospital {
  id: string;
  name: string;
  address: string | null;
  atoll: string | null;
  island: string | null;
  phone: string | null;
  email: string | null;
  login_email: string | null;
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
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [hospitalPasswords, setHospitalPasswords] = useState<Record<string, string>>({});
  const [atolls, setAtolls] = useState<Atoll[]>([]);
  const [islands, setIslands] = useState<Island[]>([]);
  const [filteredIslands, setFilteredIslands] = useState<Island[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    atoll: "",
    island: "",
    address: "",
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

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.email) {
      toast({ variant: "destructive", title: "Error", description: "Name and email are required" });
      return;
    }

    if (!editingHospital && !formData.password) {
      toast({ variant: "destructive", title: "Error", description: "Password is required for new hospitals" });
      return;
    }

    if (formData.password && formData.password.length < 8) {
      toast({ variant: "destructive", title: "Error", description: "Password must be at least 8 characters" });
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
            email: formData.email,
            password: formData.password || undefined, // Only send if provided
            atoll: formData.atoll || null,
            island: formData.island || null,
            address: formData.address || null,
          },
        });

        if (error) throw error;

        toast({ title: "Updated", description: "Hospital updated successfully" });
        // Store the password for display if new one was set
        if (formData.password) {
          setHospitalPasswords(prev => ({ ...prev, [editingHospital.id]: formData.password }));
        }
      } else {
        // Create new hospital via edge function
        const { data, error } = await supabase.functions.invoke("create-hospital", {
          body: {
            action: "create",
            name: formData.name,
            phone: formData.phone || null,
            email: formData.email,
            password: formData.password,
            atoll: formData.atoll || null,
            island: formData.island || null,
            address: formData.address || null,
          },
        });

        if (error) throw error;

        toast({ title: "Created", description: "Hospital created successfully" });
        // Store the password for display
        if (data?.hospital?.id) {
          setHospitalPasswords(prev => ({ ...prev, [data.hospital.id]: formData.password }));
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
    setFormData({ name: "", phone: "", email: "", password: "", atoll: "", island: "", address: "" });
  };

  const handleEdit = (hospital: Hospital) => {
    setEditingHospital(hospital);
    setFormData({
      name: hospital.name,
      phone: hospital.phone || "",
      email: hospital.login_email || hospital.email || "",
      password: "", // Don't populate password - let them set new one if needed
      atoll: hospital.atoll || "",
      island: hospital.island || "",
      address: hospital.address || "",
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

  const copyCredentials = (email: string, password: string) => {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`);
    toast({ title: "Copied", description: "Credentials copied to clipboard" });
  };

  const handleResetPassword = async (hospital: Hospital) => {
    const newPassword = prompt("Enter new password (min 8 characters):");
    if (!newPassword || newPassword.length < 8) {
      if (newPassword) {
        toast({ variant: "destructive", title: "Error", description: "Password must be at least 8 characters" });
      }
      return;
    }

    try {
      const { error } = await supabase.functions.invoke("create-hospital", {
        body: {
          action: "reset_password",
          hospitalId: hospital.id,
          email: hospital.login_email || hospital.email,
          password: newPassword,
          name: hospital.name,
        },
      });

      if (error) throw error;

      toast({ title: "Success", description: "Password reset successfully" });
      setHospitalPasswords(prev => ({ ...prev, [hospital.id]: newPassword }));
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to reset password" });
    }
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
            <CardDescription>Manage hospitals with email/password login for blood stock updates</CardDescription>
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
                  {editingHospital ? "Update hospital details" : "Create a new hospital with login credentials"}
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

                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="3xxxxxx"
                    className="rounded-xl"
                  />
                </div>

                {/* Login Credentials Section */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Login Credentials
                  </h4>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Login Email *</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="hospital@example.com"
                        className="rounded-xl"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Password {!editingHospital && "*"}</Label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder={editingHospital ? "Leave empty to keep current" : "Min 8 characters"}
                          className="rounded-xl font-mono"
                        />
                        <Button variant="outline" size="icon" onClick={generatePassword} className="rounded-xl shrink-0">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {editingHospital 
                          ? "Leave empty to keep current password, or enter new password to change it"
                          : "Share these credentials with hospital staff to access the portal"
                        }
                      </p>
                    </div>
                  </div>
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
                  
                  {hospital.login_email && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {hospital.login_email}
                      </p>
                      {hospitalPasswords[hospital.id] && (
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded text-xs font-mono flex-1">
                            {showPasswords[hospital.id] ? hospitalPasswords[hospital.id] : "••••••••"}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setShowPasswords({ ...showPasswords, [hospital.id]: !showPasswords[hospital.id] })}
                          >
                            {showPasswords[hospital.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => copyCredentials(hospital.login_email!, hospitalPasswords[hospital.id])}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-2 border-t">
                    <Button size="sm" variant="outline" className="flex-1 h-9 rounded-xl" onClick={() => handleEdit(hospital)}>
                      <Pencil className="h-4 w-4 mr-1.5" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="h-9 rounded-xl" onClick={() => handleResetPassword(hospital)}>
                      <Key className="h-4 w-4" />
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
                    <TableHead>Login</TableHead>
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
                        </div>
                      </TableCell>
                      <TableCell>
                        {hospital.login_email ? (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {hospital.login_email}
                            </p>
                            {hospitalPasswords[hospital.id] && (
                              <div className="flex items-center gap-1">
                                <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                                  {showPasswords[hospital.id] ? hospitalPasswords[hospital.id] : "••••••••"}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => setShowPasswords({ ...showPasswords, [hospital.id]: !showPasswords[hospital.id] })}
                                >
                                  {showPasswords[hospital.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => copyCredentials(hospital.login_email!, hospitalPasswords[hospital.id])}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Edit to set credentials</span>
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
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleResetPassword(hospital)}
                            title="Reset Password"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(hospital.id)}
                            title="Delete"
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
