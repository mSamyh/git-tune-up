import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Heart, History, Settings, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DonationHistoryManager } from "@/components/DonationHistoryManager";
import { CSVImporter } from "@/components/CSVImporter";
import { UserRoleManager } from "@/components/UserRoleManager";
import { Textarea } from "@/components/ui/textarea";
import { AppHeader } from "@/components/AppHeader";

const Admin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [donors, setDonors] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [atolls, setAtolls] = useState<any[]>([]);
  const [islands, setIslands] = useState<any[]>([]);
  const [smsTemplate, setSmsTemplate] = useState("");
  const [newAtoll, setNewAtoll] = useState("");
  const [newIsland, setNewIsland] = useState("");
  const [selectedAtollForIsland, setSelectedAtollForIsland] = useState("");
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
      supabase.from("sms_templates").select("*").eq("template_name", "blood_request_notification").single(),
    ]);

    if (donorsData.data) setDonors(donorsData.data);
    if (requestsData.data) setRequests(requestsData.data);
    if (donationsData.data) setDonations(donationsData.data);
    if (atollsData.data) setAtolls(atollsData.data);
    if (islandsData.data) setIslands(islandsData.data);
    if (templateData.data) setSmsTemplate(templateData.data.template_body);
    setLoading(false);
  };

  const updateRequestStatus = async (id: string, status: string) => {
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
          <p className="text-muted-foreground">Manage donors, requests, and donations</p>
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
          <TabsList>
            <TabsTrigger value="donors">Donors</TabsTrigger>
            <TabsTrigger value="import">Import CSV</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="donations">Donations</TabsTrigger>
            <TabsTrigger value="history">Manage History</TabsTrigger>
            <TabsTrigger value="admins">Admins</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="sms">SMS Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="donors">
            <Card>
              <CardHeader>
                <CardTitle>All Donors</CardTitle>
                <CardDescription>View and manage all registered blood donors (from profiles and donor_directory)</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Blood Group</TableHead>
                      <TableHead>District</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {donors.map((donor) => (
                      <TableRow key={donor.id}>
                        <TableCell className="font-medium">{donor.full_name}</TableCell>
                        <TableCell>
                          <Badge>{donor.blood_group}</Badge>
                        </TableCell>
                        <TableCell>{donor.district || donor.atoll || '-'}</TableCell>
                        <TableCell>{donor.phone}</TableCell>
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
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              if (confirm(`Delete ${donor.full_name}?`)) {
                                const { error } = await supabase.from("profiles").delete().eq("id", donor.id);
                                if (error) {
                                  toast({ variant: "destructive", title: "Delete failed", description: error.message });
                                } else {
                                  toast({ title: "Donor deleted" });
                                  fetchData();
                                }
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import">
            <CSVImporter />
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
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {donations.map((donation) => (
                      <TableRow key={donation.id}>
                        <TableCell className="font-medium">
                          {donation.profiles?.full_name || "Unknown"}
                        </TableCell>
                        <TableCell>{new Date(donation.donation_date).toLocaleDateString()}</TableCell>
                        <TableCell>{donation.hospital_name}</TableCell>
                        <TableCell>{donation.notes || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <DonationHistoryManager />
          </TabsContent>

          <TabsContent value="admins">
            <UserRoleManager />
          </TabsContent>

          <TabsContent value="locations">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Manage Atolls
                  </CardTitle>
                  <CardDescription>Add or remove atolls</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Atoll name"
                      value={newAtoll}
                      onChange={(e) => setNewAtoll(e.target.value)}
                    />
                    <Button onClick={addAtoll}>Add</Button>
                  </div>
                  <div className="space-y-2">
                    {atolls.map((atoll) => (
                      <div key={atoll.id} className="flex items-center justify-between p-2 border rounded">
                        <span>{atoll.name}</span>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => deleteAtoll(atoll.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Manage Islands
                  </CardTitle>
                  <CardDescription>Add or remove islands</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Atoll</Label>
                    <select
                      className="w-full p-2 border rounded"
                      value={selectedAtollForIsland}
                      onChange={(e) => setSelectedAtollForIsland(e.target.value)}
                    >
                      <option value="">Select atoll</option>
                      {atolls.map((atoll) => (
                        <option key={atoll.id} value={atoll.id}>
                          {atoll.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Island name"
                      value={newIsland}
                      onChange={(e) => setNewIsland(e.target.value)}
                    />
                    <Button onClick={addIsland} disabled={!selectedAtollForIsland}>
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {islands.map((island: any) => (
                      <div key={island.id} className="flex items-center justify-between p-2 border rounded">
                        <span>
                          {island.name} ({island.atolls?.name})
                        </span>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => deleteIsland(island.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sms">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  SMS Template Settings
                </CardTitle>
                <CardDescription>
                  Customize the SMS notification sent to donors. Use placeholders: {"{blood_group}"}, {"{hospital_name}"}, {"{patient_name}"}, {"{contact_name}"}, {"{contact_phone}"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>SMS Template</Label>
                  <Textarea
                    value={smsTemplate}
                    onChange={(e) => setSmsTemplate(e.target.value)}
                    rows={5}
                    placeholder="Enter SMS template with placeholders"
                  />
                </div>
                <Button onClick={updateSmsTemplate}>
                  Save Template
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;