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
import { useToast } from "@/hooks/use-toast";
import { Store, Plus, Pencil, Trash2, Copy, Eye, EyeOff, RefreshCw } from "lucide-react";

interface Merchant {
  id: string;
  name: string;
  pin: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export const MerchantAdminPanel = () => {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [showPins, setShowPins] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    pin: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchMerchants();
  }, []);

  const fetchMerchants = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("merchant_accounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      setMerchants(data || []);
    }
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

    if (editingMerchant) {
      const { error } = await supabase
        .from("merchant_accounts")
        .update({
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          pin: formData.pin,
        })
        .eq("id", editingMerchant.id);

      if (error) {
        toast({ variant: "destructive", title: "Error", description: error.message });
      } else {
        toast({ title: "Updated", description: "Merchant updated successfully" });
        setShowAddDialog(false);
        setEditingMerchant(null);
        resetForm();
        fetchMerchants();
      }
    } else {
      const { error } = await supabase
        .from("merchant_accounts")
        .insert({
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          pin: formData.pin,
        });

      if (error) {
        if (error.message.includes("duplicate")) {
          toast({ variant: "destructive", title: "Error", description: "PIN already exists" });
        } else {
          toast({ variant: "destructive", title: "Error", description: error.message });
        }
      } else {
        toast({ title: "Created", description: "Merchant created successfully" });
        setShowAddDialog(false);
        resetForm();
        fetchMerchants();
      }
    }
  };

  const resetForm = () => {
    setFormData({ name: "", email: "", phone: "", pin: "" });
  };

  const handleEdit = (merchant: Merchant) => {
    setEditingMerchant(merchant);
    setFormData({
      name: merchant.name,
      email: merchant.email || "",
      phone: merchant.phone || "",
      pin: merchant.pin,
    });
    setShowAddDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this merchant?")) return;

    const { error } = await supabase
      .from("merchant_accounts")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Deleted", description: "Merchant deleted successfully" });
      fetchMerchants();
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("merchant_accounts")
      .update({ is_active: !isActive })
      .eq("id", id);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      fetchMerchants();
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
              <Store className="h-5 w-5" />
              Merchant Accounts
            </CardTitle>
            <CardDescription>Manage merchant PINs for voucher verification</CardDescription>
          </div>
          <Dialog open={showAddDialog} onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) {
              setEditingMerchant(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-xl">
                <Plus className="h-4 w-4 mr-1" />
                Add Merchant
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm rounded-2xl">
              <DialogHeader>
                <DialogTitle>{editingMerchant ? "Edit" : "Add"} Merchant</DialogTitle>
                <DialogDescription>
                  {editingMerchant ? "Update merchant details" : "Create a new merchant account with a unique PIN"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Merchant Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Coffee Shop"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="merchant@example.com"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="7xxxxxx"
                    className="rounded-xl"
                  />
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
                </div>
                <Button onClick={handleSubmit} className="w-full rounded-xl">
                  {editingMerchant ? "Update" : "Create"} Merchant
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : merchants.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No merchants yet. Add your first merchant above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>PIN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {merchants.map((merchant) => (
                  <TableRow key={merchant.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{merchant.name}</p>
                        {merchant.email && (
                          <p className="text-xs text-muted-foreground">{merchant.email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                          {showPins[merchant.id] ? merchant.pin : "••••••"}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setShowPins({ ...showPins, [merchant.id]: !showPins[merchant.id] })}
                        >
                          {showPins[merchant.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copyPin(merchant.pin)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={merchant.is_active}
                          onCheckedChange={() => toggleActive(merchant.id, merchant.is_active)}
                        />
                        <Badge variant={merchant.is_active ? "default" : "secondary"}>
                          {merchant.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(merchant)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(merchant.id)}
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
        )}
      </CardContent>
    </Card>
  );
};
