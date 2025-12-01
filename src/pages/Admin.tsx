import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Heart, History, Edit, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CSVImporter } from "@/components/CSVImporter";
import { UserRoleManager } from "@/components/UserRoleManager";
import { TelegramConfigManager } from "@/components/TelegramConfigManager";
import { Textarea } from "@/components/ui/textarea";
import { AppHeader } from "@/components/AppHeader";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

interface DonorProfile {
  id: string;
  full_name: string;
  blood_group: string;
  phone: string;
  district?: string;
  atoll?: string;
  is_available: boolean;
  last_donation_date?: string;
  address?: string;
  availability_status?: string;
}

const Admin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [donors, setDonors] = useState<DonorProfile[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [atolls, setAtolls] = useState<any[]>([]);
  const [islands, setIslands] = useState<any[]>([]);
  const [smsTemplate, setSmsTemplate] = useState("");
  const [newAtoll, setNewAtoll] = useState("");
  const [newIsland, setNewIsland] = useState("");
  const [selectedAtollForIsland, setSelectedAtollForIsland] = useState("");
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState<DonorProfile | null>(null);
  
  // Edit form states
  const [editForm, setEditForm] = useState({
    full_name: "",
    blood_group: "",
    phone: "",
    district: "",
    address: "",
  });
  
  // History form states
  const [historyForm, setHistoryForm] = useState({
    donation_date: new Date(),
    hospital_name: "",
    units_donated: 1,
    notes: "",
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!data) {
      toast({
        variant: "destructive",
        title: "Access denied",
        description: "You don't have admin permissions",
      });
      navigate("/");
      return;
    }

    setIsAdmin(true);
    fetchData();
  };

  const fetchData = async () => {
    const [donorsData, requestsData, donationsData, atollsData, islandsData, templateData] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("blood_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("donation_history").select("*, profiles(full_name)").order("created_at", { ascending: false }),
      supabase.from("atolls").select("*").order("name"),
      supabase.from("islands").select("*, atolls(name)").order("name"),
      supabase.from("sms_templates").select("*").eq("template_name", "blood_request_notification").maybeSingle(),
    ]);

    if (donorsData.data) setDonors(donorsData.data);
    if (requestsData.data) setRequests(requestsData.data);
    if (donationsData.data) setDonations(donationsData.data);
    if (atollsData.data) setAtolls(atollsData.data);
    if (islandsData.data) setIslands(islandsData.data);
    if (templateData.data) setSmsTemplate(templateData.data.template_body);
    setLoading(false);
  };

  const openEditDialog = (donor: DonorProfile) => {
    setSelectedDonor(donor);
    setEditForm({
      full_name: donor.full_name,
      blood_group: donor.blood_group,
      phone: donor.phone,
      district: donor.district || "",
      address: donor.address || "",
    });
    setEditDialogOpen(true);
  };

  const openHistoryDialog = (donor: DonorProfile) => {
    setSelectedDonor(donor);
    setHistoryForm({
      donation_date: new Date(),
      hospital_name: "",
      units_donated: 1,
      notes: "",
    });
    setHistoryDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!selectedDonor) return;

    const { error } = await supabase
      .from("profiles")
      .update(editForm)
      .eq("id", selectedDonor.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    } else {
      toast({ title: "Donor updated successfully" });
      setEditDialogOpen(false);
      fetchData();
    }
  };

  const handleHistoryAdd = async () => {
    if (!selectedDonor) return;

    const { error } = await supabase
      .from("donation_history")
      .insert({
        donor_id: selectedDonor.id,
        donation_date: format(historyForm.donation_date, "yyyy-MM-dd"),
        hospital_name: historyForm.hospital_name,
        units_donated: historyForm.units_donated,
        notes: historyForm.notes,
      });

    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to add donation history",
        description: error.message,
      });
    } else {
      // Update last_donation_date in profiles
      await supabase
        .from("profiles")
        .update({ last_donation_date: format(historyForm.donation_date, "yyyy-MM-dd") })
        .eq("id", selectedDonor.id);

      toast({ title: "Donation history added successfully" });
      setHistoryDialogOpen(false);
      fetchData();
    }
  };

  const handleDeleteDonor = async (donor: DonorProfile) => {
    if (!confirm(`Delete ${donor.full_name}? This will also delete their donation history.`)) return;

    const { error } = await supabase.from("profiles").delete().eq("id", donor.id);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message,
      });
    } else {
      toast({ title: "Donor deleted successfully" });
      fetchData();
    }
  };

  const updateRequestStatus = async (id: string, status: string) => {
    const request = requests.find(r => r.id === id);
    
    const { error } = await supabase
      .from("blood_requests")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    } else {
      if (request) {
        const { notifyBloodRequestUpdate } = await import("@/lib/telegramNotifications");
        await notifyBloodRequestUpdate({
          patient_name: request.patient_name,
          blood_group: request.blood_group,
          status
        });
      }
      
      toast({
        title: "Status updated",
        description: `Request marked as ${status}`,
      });
      fetchData();
    }
  };

  const addAtoll = async () => {
    if (!newAtoll) return;

    const { error } = await supabase
      .from("atolls")
      .insert({ name: newAtoll });

    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to add atoll",
        description: error.message,
      });
    } else {
      toast({ title: "Atoll added successfully" });
      setNewAtoll("");
      fetchData();
    }
  };

  const addIsland = async () => {
    if (!newIsland || !selectedAtollForIsland) return;

    const { error } = await supabase
      .from("islands")
      .insert({ 
        atoll_id: selectedAtollForIsland,
        name: newIsland 
      });

    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to add island",
        description: error.message,
      });
    } else {
      toast({ title: "Island added successfully" });
      setNewIsland("");
      fetchData();
    }
  };

  const updateSmsTemplate = async () => {
    const { error } = await supabase
      .from("sms_templates")
      .update({ template_body: smsTemplate })
      .eq("template_name", "blood_request_notification");

    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to update template",
        description: error.message,
      });
    } else {
      toast({ title: "SMS template updated successfully" });
    }
  };

  const deleteAtoll = async (id: string) => {
    const { error } = await supabase
      .from("atolls")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to delete atoll",
        description: error.message,
      });
    } else {
      toast({ title: "Atoll deleted successfully" });
      fetchData();
    }
  };

  const deleteIsland = async (id: string) => {
    const { error } = await supabase
      .from("islands")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to delete island",
        description: error.message,
      });
    } else {
      toast({ title: "Island deleted successfully" });
      fetchData();
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage donors, requests, and system settings</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Donors</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{donors.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Requests</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {requests.filter((r) => r.status === "active").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Donations</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{donations.length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="donors" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="donors">Donors</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="donations">Donations</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="admins">Admins</TabsTrigger>
          </TabsList>

          <TabsContent value="donors">
            <Card>
              <CardHeader>
                <CardTitle>Donor Management</CardTitle>
                <CardDescription>Quick actions for each donor</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <CSVImporter />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Blood Group</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {donors.map((donor) => (
                      <TableRow key={donor.id}>
                        <TableCell className="font-medium">{donor.full_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{donor.blood_group}</Badge>
                        </TableCell>
                        <TableCell>{donor.phone}</TableCell>
                        <TableCell>{donor.district || donor.atoll || '-'}</TableCell>
                        <TableCell>
                          {donor.is_available ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              Available
                            </Badge>
                          ) : (
                            <Badge variant="outline">Unavailable</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditDialog(donor)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openHistoryDialog(donor)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              History
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteDonor(donor)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle>Blood Requests</CardTitle>
                <CardDescription>Manage all blood donation requests</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Blood Group</TableHead>
                      <TableHead>Hospital</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">{request.patient_name}</TableCell>
                        <TableCell>
                          <Badge>{request.blood_group}</Badge>
                        </TableCell>
                        <TableCell>{request.hospital_name}</TableCell>
                        <TableCell>{request.contact_phone}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              request.status === "active"
                                ? "default"
                                : request.status === "fulfilled"
                                ? "outline"
                                : "destructive"
                            }
                          >
                            {request.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {request.status === "active" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateRequestStatus(request.id, "fulfilled")}
                              >
                                Fulfill
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updateRequestStatus(request.id, "cancelled")}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="donations">
            <Card>
              <CardHeader>
                <CardTitle>Donation History</CardTitle>
                <CardDescription>View all completed donations</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Donor</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Hospital</TableHead>
                      <TableHead>Units</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {donations.map((donation) => (
                      <TableRow key={donation.id}>
                        <TableCell className="font-medium">
                          {donation.profiles?.full_name || 'Unknown'}
                        </TableCell>
                        <TableCell>{new Date(donation.donation_date).toLocaleDateString()}</TableCell>
                        <TableCell>{donation.hospital_name}</TableCell>
                        <TableCell>{donation.units_donated || 1}</TableCell>
                        <TableCell>{donation.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Locations</CardTitle>
                <CardDescription>Manage atolls and islands</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label>Add New Atoll</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Atoll name"
                      value={newAtoll}
                      onChange={(e) => setNewAtoll(e.target.value)}
                    />
                    <Button onClick={addAtoll}>Add</Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Atoll Name</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {atolls.map((atoll) => (
                        <TableRow key={atoll.id}>
                          <TableCell>{atoll.name}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteAtoll(atoll.id)}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-4">
                  <Label>Add New Island</Label>
                  <div className="flex gap-2">
                    <Select value={selectedAtollForIsland} onValueChange={setSelectedAtollForIsland}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select atoll" />
                      </SelectTrigger>
                      <SelectContent>
                        {atolls.map((atoll) => (
                          <SelectItem key={atoll.id} value={atoll.id}>
                            {atoll.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Island name"
                      value={newIsland}
                      onChange={(e) => setNewIsland(e.target.value)}
                    />
                    <Button onClick={addIsland}>Add</Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Island Name</TableHead>
                        <TableHead>Atoll</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {islands.map((island) => (
                        <TableRow key={island.id}>
                          <TableCell>{island.name}</TableCell>
                          <TableCell>{island.atolls?.name}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteIsland(island.id)}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SMS Template</CardTitle>
                <CardDescription>Customize blood request SMS notification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={smsTemplate}
                  onChange={(e) => setSmsTemplate(e.target.value)}
                  rows={6}
                />
                <Button onClick={updateSmsTemplate}>Update Template</Button>
              </CardContent>
            </Card>

            <TelegramConfigManager />
          </TabsContent>

          <TabsContent value="admins">
            <UserRoleManager />
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Donor Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Donor</DialogTitle>
            <DialogDescription>Update donor information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Blood Group</Label>
              <Select
                value={editForm.blood_group}
                onValueChange={(value) => setEditForm({ ...editForm, blood_group: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A-">A-</SelectItem>
                  <SelectItem value="B+">B+</SelectItem>
                  <SelectItem value="B-">B-</SelectItem>
                  <SelectItem value="AB+">AB+</SelectItem>
                  <SelectItem value="AB-">AB-</SelectItem>
                  <SelectItem value="O+">O+</SelectItem>
                  <SelectItem value="O-">O-</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>District</Label>
              <Input
                value={editForm.district}
                onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
              />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Donation History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Donation History</DialogTitle>
            <DialogDescription>
              Record a new donation for {selectedDonor?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Donation Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(historyForm.donation_date, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={historyForm.donation_date}
                    onSelect={(date) =>
                      date && setHistoryForm({ ...historyForm, donation_date: date })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Hospital Name</Label>
              <Input
                value={historyForm.hospital_name}
                onChange={(e) =>
                  setHistoryForm({ ...historyForm, hospital_name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Units Donated</Label>
              <Input
                type="number"
                min="1"
                value={historyForm.units_donated}
                onChange={(e) =>
                  setHistoryForm({ ...historyForm, units_donated: parseInt(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={historyForm.notes}
                onChange={(e) => setHistoryForm({ ...historyForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleHistoryAdd}>Add Donation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;