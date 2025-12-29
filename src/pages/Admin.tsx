import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Heart, History, Edit, Trash2, Plus, ChevronDown, Gift, Settings as SettingsIcon, Shield, Droplet, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CSVImporter } from "@/components/CSVImporter";
import { UserRoleManager } from "@/components/UserRoleManager";
import { TelegramConfigManager } from "@/components/TelegramConfigManager";

import { RewardsAdminPanel } from "@/components/RewardsAdminPanel";
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
  title?: string;
  title_color?: string;
  user_type?: string;
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
  const [pointsPerDonation, setPointsPerDonation] = useState(100); // default value
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [editDonationDialogOpen, setEditDonationDialogOpen] = useState(false);
  const [editRequestDialogOpen, setEditRequestDialogOpen] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState<DonorProfile | null>(null);
  const [selectedDonation, setSelectedDonation] = useState<any | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  
  // Edit form states
  const [editForm, setEditForm] = useState({
    full_name: "",
    blood_group: "",
    phone: "",
    district: "",
    address: "",
    title: "",
    title_color: "",
  });
  
  // History form states
  const [historyForm, setHistoryForm] = useState({
    donation_date: new Date(),
    hospital_name: "",
    units_donated: 1,
    notes: "",
  });

  // Edit donation form states
  const [editDonationForm, setEditDonationForm] = useState({
    donation_date: new Date(),
    hospital_name: "",
    units_donated: 1,
    notes: "",
  });

  // Edit request form states
  const [editRequestForm, setEditRequestForm] = useState({
    patient_name: "",
    blood_group: "",
    hospital_name: "",
    contact_name: "",
    contact_phone: "",
    units_needed: 1,
    urgency: "",
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
    const [donorsData, requestsData, donationsData, atollsData, islandsData, templateData, pointsData] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("blood_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("donation_history").select("*, profiles(full_name)").order("created_at", { ascending: false }),
      supabase.from("atolls").select("*").order("name"),
      supabase.from("islands").select("*, atolls(name)").order("name"),
      supabase.from("sms_templates").select("*").eq("template_name", "blood_request_notification").maybeSingle(),
      supabase.from("reward_settings").select("setting_value").eq("setting_key", "points_per_donation").single(),
    ]);

    if (donorsData.data) setDonors(donorsData.data);
    
    // Fetch requests and enrich with profile data
    if (requestsData.data) {
      const requestsWithProfiles = await Promise.all(
        requestsData.data.map(async (request) => {
          if (request.requested_by) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", request.requested_by)
              .single();
            return { ...request, requester_name: profile?.full_name || "Unknown" };
          }
          return { ...request, requester_name: "Unknown" };
        })
      );
      setRequests(requestsWithProfiles);
    }
    
    if (donationsData.data) setDonations(donationsData.data);
    if (atollsData.data) setAtolls(atollsData.data);
    if (islandsData.data) setIslands(islandsData.data);
    if (templateData.data) setSmsTemplate(templateData.data.template_body);
    if (pointsData.data) setPointsPerDonation(parseInt(pointsData.data.setting_value));
    setLoading(false);
  };

  const awardPoints = async (donorId: string, donationId: string, hospitalName: string) => {
    // Create or update donor_points record
    const { data: existingPoints } = await supabase
      .from("donor_points")
      .select("*")
      .eq("donor_id", donorId)
      .single();

    if (existingPoints) {
      await supabase
        .from("donor_points")
        .update({
          total_points: existingPoints.total_points + pointsPerDonation,
          lifetime_points: existingPoints.lifetime_points + pointsPerDonation,
          updated_at: new Date().toISOString(),
        })
        .eq("donor_id", donorId);
    } else {
      await supabase
        .from("donor_points")
        .insert({
          donor_id: donorId,
          total_points: pointsPerDonation,
          lifetime_points: pointsPerDonation,
        });
    }

    // Record the transaction
    await supabase
      .from("points_transactions")
      .insert({
        donor_id: donorId,
        points: pointsPerDonation,
        transaction_type: "earned",
        description: `Points earned from blood donation at ${hospitalName}`,
        related_donation_id: donationId,
      });
  };

  const deductPoints = async (donorId: string, donationId: string, hospitalName: string) => {
    // Deduct points from donor_points record
    const { data: existingPoints } = await supabase
      .from("donor_points")
      .select("*")
      .eq("donor_id", donorId)
      .single();

    if (existingPoints) {
      await supabase
        .from("donor_points")
        .update({
          total_points: Math.max(0, existingPoints.total_points - pointsPerDonation),
          lifetime_points: Math.max(0, existingPoints.lifetime_points - pointsPerDonation),
          updated_at: new Date().toISOString(),
        })
        .eq("donor_id", donorId);

      // Record the transaction with negative points and 'adjusted' type
      await supabase
        .from("points_transactions")
        .insert({
          donor_id: donorId,
          points: -pointsPerDonation,
          transaction_type: "adjusted",
          description: `Points deducted for deleted donation at ${hospitalName}`,
        });
    }
  };

  const openEditDialog = (donor: DonorProfile) => {
    setSelectedDonor(donor);
    setEditForm({
      full_name: donor.full_name,
      blood_group: donor.blood_group,
      phone: donor.phone,
      district: donor.district || "",
      address: donor.address || "",
      title: donor.title || "",
      title_color: donor.title_color || "",
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

    const { data: newDonation, error } = await supabase
      .from("donation_history")
      .insert({
        donor_id: selectedDonor.id,
        donation_date: format(historyForm.donation_date, "yyyy-MM-dd"),
        hospital_name: historyForm.hospital_name,
        units_donated: historyForm.units_donated,
        notes: historyForm.notes,
      })
      .select()
      .single();

    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to add donation history",
        description: error.message,
      });
    } else {
      // Award points for the donation
      if (newDonation) {
        await awardPoints(selectedDonor.id, newDonation.id, historyForm.hospital_name);
      }

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

  const openEditDonationDialog = (donation: any) => {
    setSelectedDonation(donation);
    setEditDonationForm({
      donation_date: new Date(donation.donation_date),
      hospital_name: donation.hospital_name,
      units_donated: donation.units_donated || 1,
      notes: donation.notes || "",
    });
    setEditDonationDialogOpen(true);
  };

  const handleEditDonationSave = async () => {
    if (!selectedDonation) return;

    const { error } = await supabase
      .from("donation_history")
      .update({
        donation_date: format(editDonationForm.donation_date, "yyyy-MM-dd"),
        hospital_name: editDonationForm.hospital_name,
        units_donated: editDonationForm.units_donated,
        notes: editDonationForm.notes,
      })
      .eq("id", selectedDonation.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    } else {
      toast({ title: "Donation updated successfully" });
      setEditDonationDialogOpen(false);
      fetchData();
    }
  };

  const handleDeleteDonation = async (donationId: string, donorName: string) => {
    if (!confirm(`Delete this donation record for ${donorName}?`)) return;

    // Get donation details before deletion
    const { data: donation } = await supabase
      .from("donation_history")
      .select("donor_id, hospital_name")
      .eq("id", donationId)
      .single();

    if (donation) {
      // Deduct points before deleting
      await deductPoints(donation.donor_id, donationId, donation.hospital_name);
    }

    const { error } = await supabase
      .from("donation_history")
      .delete()
      .eq("id", donationId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message,
      });
    } else {
      // After deletion, recalculate last_donation_date for this donor
      if (donation) {
        const { data: remaining } = await supabase
          .from("donation_history")
          .select("donation_date")
          .eq("donor_id", donation.donor_id)
          .order("donation_date", { ascending: false })
          .limit(1);

        if (!remaining || remaining.length === 0) {
          // No more donations: clear last_donation_date and set available
          await supabase
            .from("profiles")
            .update({ 
              last_donation_date: null,
              availability_status: 'available'
            })
            .eq("id", donation.donor_id);
        } else {
          // Still has donations: set last_donation_date to most recent
          await supabase
            .from("profiles")
            .update({ last_donation_date: remaining[0].donation_date })
            .eq("id", donation.donor_id);
        }
      }
      
      toast({ title: "Donation deleted successfully" });
      fetchData();
    }
  };

  // Group donations by donor
  const donationsByDonor = donations.reduce((acc: any, donation: any) => {
    const donorId = donation.donor_id;
    if (!acc[donorId]) {
      acc[donorId] = {
        donor: donation.profiles,
        donations: [],
      };
    }
    acc[donorId].donations.push(donation);
    return acc;
  }, {});

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

  const openEditRequestDialog = (request: any) => {
    setSelectedRequest(request);
    setEditRequestForm({
      patient_name: request.patient_name,
      blood_group: request.blood_group,
      hospital_name: request.hospital_name,
      contact_name: request.contact_name,
      contact_phone: request.contact_phone,
      units_needed: request.units_needed,
      urgency: request.urgency,
      notes: request.notes || "",
    });
    setEditRequestDialogOpen(true);
  };

  const handleEditRequestSave = async () => {
    if (!selectedRequest) return;

    const { error } = await supabase
      .from("blood_requests")
      .update({
        patient_name: editRequestForm.patient_name,
        blood_group: editRequestForm.blood_group,
        hospital_name: editRequestForm.hospital_name,
        contact_name: editRequestForm.contact_name,
        contact_phone: editRequestForm.contact_phone,
        units_needed: editRequestForm.units_needed,
        urgency: editRequestForm.urgency,
        notes: editRequestForm.notes,
      })
      .eq("id", selectedRequest.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    } else {
      toast({
        title: "Request updated",
        description: "Blood request has been updated successfully",
      });
      setEditRequestDialogOpen(false);
      fetchData();
    }
  };

  const handleDeleteRequest = async (request: any) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the blood request for ${request.patient_name}?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("blood_requests")
      .delete()
      .eq("id", request.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message,
      });
    } else {
      // Get current user's profile for notification
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user?.id)
        .single();

      const { notifyBloodRequestDeleted } = await import("@/lib/telegramNotifications");
      await notifyBloodRequestDeleted({
        patient_name: request.patient_name,
        blood_group: request.blood_group,
        hospital_name: request.hospital_name,
        deleted_by: profile?.full_name || "Admin",
      });

      toast({
        title: "Request deleted",
        description: "Blood request has been deleted successfully",
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

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-7xl">
        {/* Compact Hero Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shrink-0">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">Admin Dashboard</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Manage donors, requests & settings</p>
            </div>
          </div>
        </div>

        {/* Compact Stats Cards */}
        <div className="grid gap-2 sm:gap-3 grid-cols-4 mb-4 sm:mb-6">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="p-2 sm:p-4">
              <div className="text-center sm:text-left sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg sm:text-2xl font-bold text-primary">{donors.length}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Donors</p>
                </div>
                <div className="hidden sm:flex h-10 w-10 rounded-xl bg-primary/20 items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-destructive/10 to-destructive/5">
            <CardContent className="p-2 sm:p-4">
              <div className="text-center sm:text-left sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg sm:text-2xl font-bold text-destructive">{requests.filter((r) => r.status === "active").length}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Active</p>
                </div>
                <div className="hidden sm:flex h-10 w-10 rounded-xl bg-destructive/20 items-center justify-center">
                  <Heart className="h-5 w-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-green-500/10 to-green-500/5">
            <CardContent className="p-2 sm:p-4">
              <div className="text-center sm:text-left sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg sm:text-2xl font-bold text-green-600">{donations.length}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Donations</p>
                </div>
                <div className="hidden sm:flex h-10 w-10 rounded-xl bg-green-500/20 items-center justify-center">
                  <Droplet className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-500/10 to-amber-500/5">
            <CardContent className="p-2 sm:p-4">
              <div className="text-center sm:text-left sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg sm:text-2xl font-bold text-amber-600">{requests.filter((r) => r.status === "fulfilled").length}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Fulfilled</p>
                </div>
                <div className="hidden sm:flex h-10 w-10 rounded-xl bg-amber-500/20 items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="donors" className="space-y-3 sm:space-y-4">
          {/* Scrollable tabs on mobile */}
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <TabsList className="w-max sm:w-full bg-muted/50 p-1 rounded-xl h-auto inline-flex sm:flex">
              <TabsTrigger value="donors" className="min-w-[70px] sm:flex-1 rounded-lg text-xs gap-1.5 py-2 px-3">
                <Users className="h-3.5 w-3.5" />
                <span>Donors</span>
              </TabsTrigger>
              <TabsTrigger value="requests" className="min-w-[70px] sm:flex-1 rounded-lg text-xs gap-1.5 py-2 px-3">
                <Heart className="h-3.5 w-3.5" />
                <span>Requests</span>
              </TabsTrigger>
              <TabsTrigger value="donations" className="min-w-[80px] sm:flex-1 rounded-lg text-xs gap-1.5 py-2 px-3">
                <Droplet className="h-3.5 w-3.5" />
                <span>Donations</span>
              </TabsTrigger>
              <TabsTrigger value="rewards" className="min-w-[70px] sm:flex-1 rounded-lg text-xs gap-1.5 py-2 px-3">
                <Gift className="h-3.5 w-3.5" />
                <span>Rewards</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="min-w-[70px] sm:flex-1 rounded-lg text-xs gap-1.5 py-2 px-3">
                <SettingsIcon className="h-3.5 w-3.5" />
                <span>Settings</span>
              </TabsTrigger>
              <TabsTrigger value="admins" className="min-w-[70px] sm:flex-1 rounded-lg text-xs gap-1.5 py-2 px-3">
                <Shield className="h-3.5 w-3.5" />
                <span>Admins</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="donors">
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardHeader className="pb-3 px-3 sm:px-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base sm:text-lg">Donor Management</CardTitle>
                    <CardDescription className="text-xs hidden sm:block">Manage donors by blood group</CardDescription>
                  </div>
                  <CSVImporter />
                </div>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <ScrollArea className="h-[60vh] sm:h-[500px]">
                {(() => {
                  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
                  const donorsByBloodGroup = bloodGroups.reduce((acc, group) => {
                    acc[group] = donors.filter(d => d.blood_group === group);
                    return acc;
                  }, {} as Record<string, DonorProfile[]>);
                  const groupsWithDonors = bloodGroups.filter(g => donorsByBloodGroup[g].length > 0);

                  return (
                    <Accordion type="multiple" defaultValue={['A+', 'B+', 'O+', 'AB+']} className="w-full space-y-2 pr-2 sm:pr-3">
                      {groupsWithDonors.map(group => (
                        <AccordionItem key={group} value={group} className="border rounded-xl bg-muted/20">
                          <AccordionTrigger className="px-3 sm:px-4 hover:no-underline">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <Badge className="bg-primary/10 text-primary border-0 font-bold text-xs sm:text-sm">{group}</Badge>
                              <span className="text-xs sm:text-sm text-muted-foreground">
                                {donorsByBloodGroup[group].length} donors
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-1 sm:px-4 pb-2">
                            {/* Mobile card view */}
                            <div className="sm:hidden space-y-2">
                              {donorsByBloodGroup[group].map((donor) => (
                                <div key={donor.id} className="bg-card border rounded-lg p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-sm truncate">{donor.full_name}</p>
                                      <p className="text-xs text-muted-foreground">{donor.phone}</p>
                                      {donor.district && (
                                        <p className="text-xs text-muted-foreground mt-0.5">{donor.district}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Badge variant="secondary" className="text-[10px] px-1.5">
                                        {donor.user_type === 'both' ? 'Both' : donor.user_type === 'receiver' ? 'Rcvr' : 'Donor'}
                                      </Badge>
                                      {donor.availability_status === 'available' ? (
                                        <span className="h-2 w-2 rounded-full bg-green-500" />
                                      ) : donor.availability_status === 'reserved' ? (
                                        <span className="h-2 w-2 rounded-full bg-orange-500" />
                                      ) : (
                                        <span className="h-2 w-2 rounded-full bg-red-500" />
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-1 mt-2 pt-2 border-t">
                                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => openEditDialog(donor)}>
                                      <Edit className="h-3 w-3 mr-1" /> Edit
                                    </Button>
                                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => openHistoryDialog(donor)}>
                                      <Plus className="h-3 w-3 mr-1" /> History
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDeleteDonor(donor)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* Desktop table view */}
                            <div className="hidden sm:block">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Name</TableHead>
                                    <TableHead className="text-xs">Phone</TableHead>
                                    <TableHead className="text-xs hidden md:table-cell">Location</TableHead>
                                    <TableHead className="text-xs">Type</TableHead>
                                    <TableHead className="text-xs">Status</TableHead>
                                    <TableHead className="text-xs">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {donorsByBloodGroup[group].map((donor) => (
                                    <TableRow key={donor.id}>
                                      <TableCell className="py-2">
                                        <p className="font-medium text-sm">{donor.full_name}</p>
                                      </TableCell>
                                      <TableCell className="text-sm">{donor.phone}</TableCell>
                                      <TableCell className="hidden md:table-cell text-sm">{donor.district || donor.atoll || '-'}</TableCell>
                                      <TableCell>
                                        <Badge variant="secondary" className="text-[10px] px-1.5">
                                          {donor.user_type === 'both' ? 'Both' : donor.user_type === 'receiver' ? 'Rcvr' : 'Donor'}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        {donor.availability_status === 'available' ? (
                                          <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] px-1.5">✓</Badge>
                                        ) : donor.availability_status === 'available_soon' ? (
                                          <Badge variant="outline" className="text-blue-600 border-blue-600 text-[10px] px-1.5">Soon</Badge>
                                        ) : donor.availability_status === 'reserved' ? (
                                          <Badge variant="outline" className="text-orange-600 border-orange-600 text-[10px] px-1.5">Rsv</Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-red-600 border-red-600 text-[10px] px-1.5">✗</Badge>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex gap-1">
                                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditDialog(donor)}>
                                            <Edit className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openHistoryDialog(donor)}>
                                            <Plus className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteDonor(donor)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  );
                })()}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests">
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardHeader className="pb-3 px-3 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Blood Requests</CardTitle>
                <CardDescription className="text-xs">Manage all blood donation requests</CardDescription>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <ScrollArea className="h-[60vh] sm:h-[500px]">
                  {/* Mobile card view */}
                  <div className="sm:hidden space-y-2 pr-2">
                    {requests.map((request) => (
                      <div key={request.id} className="bg-card border rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">{request.patient_name}</p>
                            <p className="text-xs text-muted-foreground">{request.hospital_name}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge className="bg-primary/10 text-primary border-0 text-xs">{request.blood_group}</Badge>
                            <Badge className={
                              request.status === "active" ? "bg-green-500/10 text-green-600 border-0 text-xs" :
                              request.status === "fulfilled" ? "bg-blue-500/10 text-blue-600 border-0 text-xs" :
                              "bg-red-500/10 text-red-600 border-0 text-xs"
                            }>{request.status}</Badge>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          <p>Contact: {request.contact_phone}</p>
                          <p>By: {request.requester_name || 'Unknown'}</p>
                        </div>
                        <div className="flex gap-1 pt-2 border-t">
                          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => openEditRequestDialog(request)}>
                            <Edit className="h-3 w-3 mr-1" /> Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDeleteRequest(request)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Desktop table view */}
                  <div className="hidden sm:block pr-3">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Patient</TableHead>
                          <TableHead className="text-xs">Blood</TableHead>
                          <TableHead className="text-xs hidden md:table-cell">Hospital</TableHead>
                          <TableHead className="text-xs hidden lg:table-cell">Contact</TableHead>
                          <TableHead className="text-xs hidden lg:table-cell">By</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {requests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell className="font-medium text-sm py-2">{request.patient_name}</TableCell>
                            <TableCell>
                              <Badge className="bg-primary/10 text-primary border-0 text-xs">{request.blood_group}</Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm">{request.hospital_name}</TableCell>
                            <TableCell className="hidden lg:table-cell text-sm">{request.contact_phone}</TableCell>
                            <TableCell className="hidden lg:table-cell text-sm">{request.requester_name || 'Unknown'}</TableCell>
                            <TableCell>
                              <Badge className={
                                request.status === "active" ? "bg-green-500/10 text-green-600 border-0 text-[10px]" :
                                request.status === "fulfilled" ? "bg-blue-500/10 text-blue-600 border-0 text-[10px]" :
                                "bg-red-500/10 text-red-600 border-0 text-[10px]"
                              }>{request.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditRequestDialog(request)}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteRequest(request)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="donations">
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardHeader className="pb-3 px-3 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Donation History</CardTitle>
                <CardDescription className="text-xs">View all completed donations grouped by donor</CardDescription>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <ScrollArea className="h-[60vh] sm:h-[500px]">
                {Object.keys(donationsByDonor).length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No donation records found</p>
                ) : (
                  <Accordion type="single" collapsible className="w-full space-y-2 pr-2 sm:pr-3">
                    {Object.entries(donationsByDonor).map(([donorId, data]: [string, any]) => (
                      <AccordionItem key={donorId} value={donorId} className="border rounded-xl bg-muted/20">
                        <AccordionTrigger className="px-3 sm:px-4 hover:no-underline">
                          <div className="flex items-center gap-2 sm:gap-4 text-left">
                            <div className="font-medium text-sm sm:text-base truncate">{data.donor?.full_name || 'Unknown Donor'}</div>
                            <Badge className="bg-green-500/10 text-green-600 border-0 text-xs shrink-0">
                              {data.donations.length} donations
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-1 sm:px-4 pb-2">
                          {/* Mobile card view */}
                          <div className="sm:hidden space-y-2">
                            {data.donations.map((donation: any) => (
                              <div key={donation.id} className="bg-card border rounded-lg p-3">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div>
                                    <p className="font-medium text-sm">
                                      {new Date(donation.donation_date).toLocaleDateString('en-US', {
                                        year: 'numeric', month: 'short', day: 'numeric',
                                      })}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{donation.hospital_name}</p>
                                  </div>
                                  <Badge variant="secondary" className="text-xs">{donation.units_donated || 1} unit</Badge>
                                </div>
                                {donation.notes && (
                                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{donation.notes}</p>
                                )}
                                <div className="flex gap-1 pt-2 border-t">
                                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => openEditDonationDialog(donation)}>
                                    <Edit className="h-3 w-3 mr-1" /> Edit
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDeleteDonation(donation.id, data.donor?.full_name || 'Unknown')}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {/* Desktop table view */}
                          <div className="hidden sm:block">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Date</TableHead>
                                  <TableHead className="text-xs">Hospital</TableHead>
                                  <TableHead className="text-xs">Units</TableHead>
                                  <TableHead className="text-xs hidden md:table-cell">Notes</TableHead>
                                  <TableHead className="text-xs">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {data.donations.map((donation: any) => (
                                  <TableRow key={donation.id}>
                                    <TableCell className="text-sm py-2">
                                      {new Date(donation.donation_date).toLocaleDateString('en-US', {
                                        year: 'numeric', month: 'short', day: 'numeric',
                                      })}
                                    </TableCell>
                                    <TableCell className="text-sm">{donation.hospital_name}</TableCell>
                                    <TableCell className="text-sm">{donation.units_donated || 1}</TableCell>
                                    <TableCell className="hidden md:table-cell text-sm max-w-xs truncate">{donation.notes || '-'}</TableCell>
                                    <TableCell>
                                      <div className="flex gap-1">
                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditDonationDialog(donation)}>
                                          <Edit className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteDonation(donation.id, data.donor?.full_name || 'Unknown')}>
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
                </ScrollArea>
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
                  
                  {/* Islands grouped by atoll - collapsible */}
                  <Accordion type="multiple" className="w-full">
                    {atolls.map((atoll) => {
                      const atollIslands = islands.filter((i: any) => i.atolls?.name === atoll.name);
                      return (
                        <AccordionItem key={atoll.id} value={atoll.id}>
                          <AccordionTrigger className="text-sm">
                            {atoll.name} ({atollIslands.length} islands)
                          </AccordionTrigger>
                          <AccordionContent>
                            {atollIslands.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-2">No islands added</p>
                            ) : (
                              <div className="space-y-1">
                                {atollIslands.map((island: any) => (
                                  <div key={island.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                    <span className="text-sm">{island.name}</span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-destructive hover:text-destructive"
                                      onClick={() => deleteIsland(island.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
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

          <TabsContent value="rewards">
            <RewardsAdminPanel />
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
            <div>
              <Label>Title (optional)</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="e.g., Founder, Volunteer, etc."
              />
            </div>
            {editForm.title && (
              <div>
                <Label>Title Badge Color</Label>
                <div className="grid grid-cols-6 gap-2 mt-2">
                  {[
                    { name: "Default", value: "", hex: "#6b7280" },
                    { name: "Red", value: "#ef4444", hex: "#ef4444" },
                    { name: "Blue", value: "#3b82f6", hex: "#3b82f6" },
                    { name: "Green", value: "#22c55e", hex: "#22c55e" },
                    { name: "Yellow", value: "#eab308", hex: "#eab308" },
                    { name: "Purple", value: "#a855f7", hex: "#a855f7" },
                    { name: "Pink", value: "#ec4899", hex: "#ec4899" },
                    { name: "Orange", value: "#f97316", hex: "#f97316" },
                    { name: "Teal", value: "#14b8a6", hex: "#14b8a6" },
                    { name: "Indigo", value: "#6366f1", hex: "#6366f1" },
                    { name: "Rose", value: "#f43f5e", hex: "#f43f5e" },
                    { name: "Gold", value: "#ca8a04", hex: "#ca8a04" },
                  ].map((color) => (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, title_color: color.value })}
                      className={`w-8 h-8 rounded-full border-2 ${
                        editForm.title_color === color.value ? "border-foreground ring-2 ring-offset-2 ring-primary" : "border-transparent"
                      } transition-all`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>
                {editForm.title && (
                  <div className="mt-3">
                    <span className="text-sm text-muted-foreground mr-2">Preview:</span>
                    <Badge 
                      className="border-0"
                      style={{ 
                        backgroundColor: editForm.title_color ? `${editForm.title_color}20` : undefined,
                        color: editForm.title_color || undefined 
                      }}
                    >
                      {editForm.title}
                    </Badge>
                  </div>
                )}
              </div>
            )}
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
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className="pointer-events-auto"
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

      {/* Edit Donation Dialog */}
      <Dialog open={editDonationDialogOpen} onOpenChange={setEditDonationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Donation Record</DialogTitle>
            <DialogDescription>
              Update donation details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Donation Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(editDonationForm.donation_date, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={editDonationForm.donation_date}
                    onSelect={(date) =>
                      date && setEditDonationForm({ ...editDonationForm, donation_date: date })
                    }
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Hospital Name</Label>
              <Input
                value={editDonationForm.hospital_name}
                onChange={(e) =>
                  setEditDonationForm({ ...editDonationForm, hospital_name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Units Donated</Label>
              <Input
                type="number"
                min="1"
                value={editDonationForm.units_donated}
                onChange={(e) =>
                  setEditDonationForm({
                    ...editDonationForm,
                    units_donated: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={editDonationForm.notes}
                onChange={(e) =>
                  setEditDonationForm({ ...editDonationForm, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDonationDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditDonationSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Blood Request Dialog */}
      <Dialog open={editRequestDialogOpen} onOpenChange={setEditRequestDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Blood Request</DialogTitle>
            <DialogDescription>
              Update blood request details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Patient Name</Label>
              <Input
                value={editRequestForm.patient_name}
                onChange={(e) =>
                  setEditRequestForm({ ...editRequestForm, patient_name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Blood Group</Label>
              <Select
                value={editRequestForm.blood_group}
                onValueChange={(value) =>
                  setEditRequestForm({ ...editRequestForm, blood_group: value })
                }
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
              <Label>Hospital Name</Label>
              <Input
                value={editRequestForm.hospital_name}
                onChange={(e) =>
                  setEditRequestForm({ ...editRequestForm, hospital_name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Contact Name</Label>
              <Input
                value={editRequestForm.contact_name}
                onChange={(e) =>
                  setEditRequestForm({ ...editRequestForm, contact_name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Contact Phone</Label>
              <Input
                value={editRequestForm.contact_phone}
                onChange={(e) =>
                  setEditRequestForm({ ...editRequestForm, contact_phone: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Units Needed</Label>
              <Input
                type="number"
                min="1"
                value={editRequestForm.units_needed}
                onChange={(e) =>
                  setEditRequestForm({
                    ...editRequestForm,
                    units_needed: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label>Urgency</Label>
              <Select
                value={editRequestForm.urgency}
                onValueChange={(value) =>
                  setEditRequestForm({ ...editRequestForm, urgency: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="routine">Routine</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={editRequestForm.notes}
                onChange={(e) =>
                  setEditRequestForm({ ...editRequestForm, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRequestDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditRequestSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;