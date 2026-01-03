import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Heart, History, Edit, Trash2, Plus, ChevronDown, Gift, Settings as SettingsIcon, Shield, Droplet, TrendingUp, Store, FileText, Activity, Clock, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { UserRoleManager } from "@/components/UserRoleManager";
import { TelegramConfigManager } from "@/components/TelegramConfigManager";

import { RewardsAdminPanel } from "@/components/RewardsAdminPanel";
import { AchievementsAdminPanel } from "@/components/AchievementsAdminPanel";
import { MerchantAdminPanel } from "@/components/MerchantAdminPanel";
import { RedemptionAuditPanel } from "@/components/RedemptionAuditPanel";
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
  const [pointsPerDonation, setPointsPerDonation] = useState(100);
  const [activeTab, setActiveTab] = useState("donors");
  
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
      if (newDonation) {
        await awardPoints(selectedDonor.id, newDonation.id, historyForm.hospital_name);
      }

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

    const { data: donation } = await supabase
      .from("donation_history")
      .select("donor_id, hospital_name")
      .eq("id", donationId)
      .single();

    if (donation) {
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
      if (donation) {
        const { data: remaining } = await supabase
          .from("donation_history")
          .select("donation_date")
          .eq("donor_id", donation.donor_id)
          .order("donation_date", { ascending: false })
          .limit(1);

        if (!remaining || remaining.length === 0) {
          await supabase
            .from("profiles")
            .update({ 
              last_donation_date: null,
              availability_status: 'available'
            })
            .eq("id", donation.donor_id);
        } else {
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const stats = [
    { 
      label: "Total Donors", 
      value: donors.length, 
      icon: Users, 
      color: "text-primary",
      bgColor: "bg-primary/10",
      trend: `${donors.filter(d => d.availability_status === 'available').length} available`
    },
    { 
      label: "Active Requests", 
      value: requests.filter((r) => r.status === "active").length, 
      icon: Activity, 
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      trend: `${requests.filter((r) => r.urgency === "critical").length} critical`
    },
    { 
      label: "Total Donations", 
      value: donations.length, 
      icon: Droplet, 
      color: "text-green-600",
      bgColor: "bg-green-500/10",
      trend: "All time"
    },
    { 
      label: "Fulfilled", 
      value: requests.filter((r) => r.status === "fulfilled").length, 
      icon: CheckCircle2, 
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
      trend: `${Math.round((requests.filter((r) => r.status === "fulfilled").length / (requests.length || 1)) * 100)}% rate`
    },
  ];

  const navItems = [
    { value: "donors", label: "Donors", icon: Users },
    { value: "requests", label: "Requests", icon: Heart },
    { value: "donations", label: "Donations", icon: Droplet },
    { value: "rewards", label: "Rewards", icon: Gift },
    { value: "merchants", label: "Merchants", icon: Store },
    { value: "audit", label: "Audit", icon: FileText },
    { value: "settings", label: "Settings", icon: SettingsIcon },
    { value: "admins", label: "Admins", icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Hero Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/25">
              <Shield className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Admin Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage your blood donation platform
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
          {stats.map((stat, i) => (
            <Card key={i} className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden group">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-2xl sm:text-3xl font-bold tracking-tight">{stat.value}</p>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">{stat.label}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground/70">{stat.trend}</p>
                  </div>
                  <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl ${stat.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                    <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-4 -mx-4 px-4">
            <ScrollArea className="w-full">
              <TabsList className="w-max sm:w-full bg-muted/50 p-1.5 rounded-2xl h-auto inline-flex sm:grid sm:grid-cols-8 gap-1">
                {navItems.map((item) => (
                  <TabsTrigger 
                    key={item.value}
                    value={item.value} 
                    className="min-w-[80px] sm:min-w-0 rounded-xl text-xs sm:text-sm gap-2 py-2.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                    <span className="sm:hidden">{item.label.slice(0, 4)}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>
          </div>

          {/* Donors Tab */}
          <TabsContent value="donors" className="space-y-4 mt-0">
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Donor Management
                    </CardTitle>
                    <CardDescription>Manage all registered blood donors</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="space-y-2">
                  {(() => {
                    const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
                    const donorsByBloodGroup = bloodGroups.reduce((acc, group) => {
                      acc[group] = donors.filter(d => d.blood_group === group);
                      return acc;
                    }, {} as Record<string, DonorProfile[]>);
                    const groupsWithDonors = bloodGroups.filter(g => donorsByBloodGroup[g].length > 0);

                    return (
                      <Accordion type="multiple" defaultValue={['A+', 'B+', 'O+', 'AB+']} className="w-full space-y-2">
                        {groupsWithDonors.map(group => (
                          <AccordionItem key={group} value={group} className="border rounded-xl bg-muted/30 overflow-hidden">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <Badge className="bg-primary text-primary-foreground font-bold px-3 py-1">{group}</Badge>
                                <span className="text-sm text-muted-foreground">
                                  {donorsByBloodGroup[group].length} donors
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-2 pb-2">
                              {/* Mobile card view */}
                              <div className="sm:hidden space-y-2">
                                {donorsByBloodGroup[group].map((donor) => (
                                  <div key={donor.id} className="bg-card border rounded-xl p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="font-semibold truncate">{donor.full_name}</p>
                                        <p className="text-sm text-muted-foreground">{donor.phone}</p>
                                        {donor.district && (
                                          <p className="text-xs text-muted-foreground mt-0.5">{donor.district}</p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="text-xs">
                                          {donor.user_type === 'both' ? 'Both' : donor.user_type === 'receiver' ? 'Receiver' : 'Donor'}
                                        </Badge>
                                        <div className={`h-3 w-3 rounded-full ${
                                          donor.availability_status === 'available' ? 'bg-green-500' :
                                          donor.availability_status === 'reserved' ? 'bg-orange-500' : 'bg-red-500'
                                        } ring-2 ring-offset-2 ring-offset-card ${
                                          donor.availability_status === 'available' ? 'ring-green-500/30' :
                                          donor.availability_status === 'reserved' ? 'ring-orange-500/30' : 'ring-red-500/30'
                                        }`} />
                                      </div>
                                    </div>
                                    <div className="flex gap-2 pt-2 border-t">
                                      <Button size="sm" variant="outline" className="flex-1 h-9" onClick={() => openEditDialog(donor)}>
                                        <Edit className="h-4 w-4 mr-1.5" /> Edit
                                      </Button>
                                      <Button size="sm" variant="outline" className="flex-1 h-9" onClick={() => openHistoryDialog(donor)}>
                                        <Plus className="h-4 w-4 mr-1.5" /> Donation
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteDonor(donor)}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              
                              {/* Desktop table view */}
                              <div className="hidden sm:block">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                      <TableHead className="font-semibold">Name</TableHead>
                                      <TableHead className="font-semibold">Phone</TableHead>
                                      <TableHead className="font-semibold hidden md:table-cell">Location</TableHead>
                                      <TableHead className="font-semibold">Type</TableHead>
                                      <TableHead className="font-semibold">Status</TableHead>
                                      <TableHead className="font-semibold text-right">Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {donorsByBloodGroup[group].map((donor) => (
                                      <TableRow key={donor.id} className="group">
                                        <TableCell className="py-3 font-medium">{donor.full_name}</TableCell>
                                        <TableCell>{donor.phone}</TableCell>
                                        <TableCell className="hidden md:table-cell text-muted-foreground">{donor.district || donor.atoll || '-'}</TableCell>
                                        <TableCell>
                                          <Badge variant="secondary" className="font-normal">
                                            {donor.user_type === 'both' ? 'Both' : donor.user_type === 'receiver' ? 'Receiver' : 'Donor'}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex items-center gap-2">
                                            <div className={`h-2.5 w-2.5 rounded-full ${
                                              donor.availability_status === 'available' ? 'bg-green-500' :
                                              donor.availability_status === 'reserved' ? 'bg-orange-500' : 'bg-red-500'
                                            }`} />
                                            <span className="text-sm capitalize">{donor.availability_status}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditDialog(donor)}>
                                              <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openHistoryDialog(donor)}>
                                              <Plus className="h-4 w-4" />
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteDonor(donor)}>
                                              <Trash2 className="h-4 w-4" />
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests" className="space-y-4 mt-0">
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heart className="h-5 w-5 text-destructive" />
                  Blood Requests
                </CardTitle>
                <CardDescription>Manage blood donation requests</CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="space-y-3">
                  {/* Mobile card view */}
                  <div className="sm:hidden space-y-3">
                    {requests.map((request) => (
                      <div key={request.id} className="bg-muted/30 border rounded-xl p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{request.patient_name}</p>
                            <p className="text-sm text-muted-foreground">{request.hospital_name}</p>
                          </div>
                          <Badge className="bg-primary text-primary-foreground font-bold">{request.blood_group}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant={
                            request.status === "active" ? "default" :
                            request.status === "fulfilled" ? "secondary" : "outline"
                          } className={
                            request.status === "active" ? "bg-green-500 text-white" :
                            request.status === "fulfilled" ? "bg-blue-500 text-white" : ""
                          }>
                            {request.status}
                          </Badge>
                          <Badge variant="outline" className={
                            request.urgency === "critical" ? "border-red-500 text-red-500" :
                            request.urgency === "urgent" ? "border-orange-500 text-orange-500" : ""
                          }>
                            {request.urgency}
                          </Badge>
                        </div>
                        <div className="flex gap-2 pt-2 border-t">
                          <Button size="sm" variant="outline" className="flex-1 h-9" onClick={() => openEditRequestDialog(request)}>
                            <Edit className="h-4 w-4 mr-1.5" /> Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteRequest(request)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Desktop table view */}
                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="font-semibold">Patient</TableHead>
                          <TableHead className="font-semibold">Blood</TableHead>
                          <TableHead className="font-semibold hidden md:table-cell">Hospital</TableHead>
                          <TableHead className="font-semibold hidden lg:table-cell">Contact</TableHead>
                          <TableHead className="font-semibold hidden lg:table-cell">Requester</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {requests.map((request) => (
                          <TableRow key={request.id} className="group">
                            <TableCell className="font-medium py-3">{request.patient_name}</TableCell>
                            <TableCell>
                              <Badge className="bg-primary/10 text-primary border-0 font-bold">{request.blood_group}</Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">{request.hospital_name}</TableCell>
                            <TableCell className="hidden lg:table-cell text-muted-foreground">{request.contact_phone}</TableCell>
                            <TableCell className="hidden lg:table-cell text-muted-foreground">{request.requester_name}</TableCell>
                            <TableCell>
                              <Badge className={
                                request.status === "active" ? "bg-green-500/10 text-green-600 border-0" :
                                request.status === "fulfilled" ? "bg-blue-500/10 text-blue-600 border-0" :
                                "bg-red-500/10 text-red-600 border-0"
                              }>{request.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditRequestDialog(request)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteRequest(request)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Donations Tab */}
          <TabsContent value="donations" className="space-y-4 mt-0">
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Droplet className="h-5 w-5 text-green-600" />
                  Donation History
                </CardTitle>
                <CardDescription>View all completed donations grouped by donor</CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="space-y-2">
                  {Object.keys(donationsByDonor).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Droplet className="h-12 w-12 text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">No donation records found</p>
                    </div>
                  ) : (
                    <Accordion type="single" collapsible className="w-full space-y-2">
                      {Object.entries(donationsByDonor).map(([donorId, data]: [string, any]) => (
                        <AccordionItem key={donorId} value={donorId} className="border rounded-xl bg-muted/30 overflow-hidden">
                          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <span className="font-medium">{data.donor?.full_name || 'Unknown Donor'}</span>
                              <Badge className="bg-green-500/10 text-green-600 border-0">
                                {data.donations.length} donations
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-2 pb-2">
                            {/* Mobile card view */}
                            <div className="sm:hidden space-y-2">
                              {data.donations.map((donation: any) => (
                                <div key={donation.id} className="bg-card border rounded-xl p-4 space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="font-medium">
                                        {new Date(donation.donation_date).toLocaleDateString('en-US', {
                                          year: 'numeric', month: 'short', day: 'numeric',
                                        })}
                                      </p>
                                      <p className="text-sm text-muted-foreground">{donation.hospital_name}</p>
                                    </div>
                                    <Badge variant="secondary">{donation.units_donated || 1} unit</Badge>
                                  </div>
                                  {donation.notes && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">{donation.notes}</p>
                                  )}
                                  <div className="flex gap-2 pt-2 border-t">
                                    <Button size="sm" variant="outline" className="flex-1 h-9" onClick={() => openEditDonationDialog(donation)}>
                                      <Edit className="h-4 w-4 mr-1.5" /> Edit
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteDonation(donation.id, data.donor?.full_name || 'Unknown')}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* Desktop table view */}
                            <div className="hidden sm:block">
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead className="font-semibold">Date</TableHead>
                                    <TableHead className="font-semibold">Hospital</TableHead>
                                    <TableHead className="font-semibold">Units</TableHead>
                                    <TableHead className="font-semibold hidden md:table-cell">Notes</TableHead>
                                    <TableHead className="font-semibold text-right">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {data.donations.map((donation: any) => (
                                    <TableRow key={donation.id} className="group">
                                      <TableCell className="py-3">
                                        {new Date(donation.donation_date).toLocaleDateString('en-US', {
                                          year: 'numeric', month: 'short', day: 'numeric',
                                        })}
                                      </TableCell>
                                      <TableCell>{donation.hospital_name}</TableCell>
                                      <TableCell>{donation.units_donated || 1}</TableCell>
                                      <TableCell className="hidden md:table-cell text-muted-foreground max-w-xs truncate">{donation.notes || '-'}</TableCell>
                                      <TableCell>
                                        <div className="flex justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditDonationDialog(donation)}>
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteDonation(donation.id, data.donor?.full_name || 'Unknown')}>
                                            <Trash2 className="h-4 w-4" />
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-0">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <SettingsIcon className="h-5 w-5 text-muted-foreground" />
                    Locations
                  </CardTitle>
                  <CardDescription>Manage atolls and islands</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label className="font-medium">Add New Atoll</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Atoll name"
                        value={newAtoll}
                        onChange={(e) => setNewAtoll(e.target.value)}
                        className="flex-1"
                      />
                      <Button onClick={addAtoll} className="shrink-0">
                        <Plus className="h-4 w-4 mr-1.5" /> Add
                      </Button>
                    </div>
                    <ScrollArea className="h-32 border rounded-xl p-2">
                      <div className="space-y-1">
                        {atolls.map((atoll) => (
                          <div key={atoll.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors">
                            <span className="text-sm">{atoll.name}</span>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteAtoll(atoll.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="space-y-3">
                    <Label className="font-medium">Add New Island</Label>
                    <div className="flex gap-2">
                      <Select value={selectedAtollForIsland} onValueChange={setSelectedAtollForIsland}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Atoll" />
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
                        className="flex-1"
                      />
                      <Button onClick={addIsland} className="shrink-0">
                        <Plus className="h-4 w-4 mr-1.5" /> Add
                      </Button>
                    </div>
                    <Accordion type="multiple" className="w-full">
                      {atolls.map((atoll) => {
                        const atollIslands = islands.filter((i: any) => i.atolls?.name === atoll.name);
                        return (
                          <AccordionItem key={atoll.id} value={atoll.id} className="border-b-0">
                            <AccordionTrigger className="text-sm py-2 hover:no-underline">
                              <span className="flex items-center gap-2">
                                {atoll.name}
                                <Badge variant="secondary" className="text-xs">{atollIslands.length}</Badge>
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-0 pb-2">
                              {atollIslands.length === 0 ? (
                                <p className="text-sm text-muted-foreground pl-2">No islands</p>
                              ) : (
                                <div className="space-y-1 pl-2">
                                  {atollIslands.map((island: any) => (
                                    <div key={island.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                                      <span className="text-sm">{island.name}</span>
                                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => deleteIsland(island.id)}>
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

              <div className="space-y-4">
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">SMS Template</CardTitle>
                    <CardDescription>Customize blood request SMS notification</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={smsTemplate}
                      onChange={(e) => setSmsTemplate(e.target.value)}
                      rows={6}
                      className="font-mono text-sm"
                    />
                    <Button onClick={updateSmsTemplate} className="w-full sm:w-auto">
                      Update Template
                    </Button>
                  </CardContent>
                </Card>

                <TelegramConfigManager />
              </div>
            </div>
          </TabsContent>

          {/* Rewards Tab */}
          <TabsContent value="rewards" className="space-y-4 mt-0">
            <RewardsAdminPanel />
            <AchievementsAdminPanel />
          </TabsContent>

          {/* Merchants Tab */}
          <TabsContent value="merchants" className="mt-0">
            <MerchantAdminPanel />
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit" className="mt-0">
            <RedemptionAuditPanel />
          </TabsContent>

          {/* Admins Tab */}
          <TabsContent value="admins" className="mt-0">
            <UserRoleManager />
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Donor Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Donor</DialogTitle>
            <DialogDescription>Update donor information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Blood Group</Label>
                <Select
                  value={editForm.blood_group}
                  onValueChange={(value) => setEditForm({ ...editForm, blood_group: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>District</Label>
                <Input
                  value={editForm.district}
                  onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Title (optional)</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="e.g., Founder, Volunteer"
              />
            </div>
            {editForm.title && (
              <div className="space-y-2">
                <Label>Title Badge Color</Label>
                <div className="grid grid-cols-6 gap-2">
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
                      className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                        editForm.title_color === color.value ? "border-foreground ring-2 ring-offset-2 ring-primary" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>
                {editForm.title && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Preview:</span>
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
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Donation History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Donation History</DialogTitle>
            <DialogDescription>
              Record a new donation for {selectedDonor?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Donation Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(historyForm.donation_date, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={historyForm.donation_date}
                    onSelect={(date) => date && setHistoryForm({ ...historyForm, donation_date: date })}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Hospital Name</Label>
              <Input
                value={historyForm.hospital_name}
                onChange={(e) => setHistoryForm({ ...historyForm, hospital_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Units Donated</Label>
              <Input
                type="number"
                min="1"
                value={historyForm.units_donated}
                onChange={(e) => setHistoryForm({ ...historyForm, units_donated: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={historyForm.notes}
                onChange={(e) => setHistoryForm({ ...historyForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleHistoryAdd}>Add Donation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Donation Dialog */}
      <Dialog open={editDonationDialogOpen} onOpenChange={setEditDonationDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Donation Record</DialogTitle>
            <DialogDescription>Update donation details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Donation Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(editDonationForm.donation_date, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editDonationForm.donation_date}
                    onSelect={(date) => date && setEditDonationForm({ ...editDonationForm, donation_date: date })}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Hospital Name</Label>
              <Input
                value={editDonationForm.hospital_name}
                onChange={(e) => setEditDonationForm({ ...editDonationForm, hospital_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Units Donated</Label>
              <Input
                type="number"
                min="1"
                value={editDonationForm.units_donated}
                onChange={(e) => setEditDonationForm({ ...editDonationForm, units_donated: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editDonationForm.notes}
                onChange={(e) => setEditDonationForm({ ...editDonationForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditDonationDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditDonationSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Blood Request Dialog */}
      <Dialog open={editRequestDialogOpen} onOpenChange={setEditRequestDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Blood Request</DialogTitle>
            <DialogDescription>Update blood request details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Patient Name</Label>
                <Input
                  value={editRequestForm.patient_name}
                  onChange={(e) => setEditRequestForm({ ...editRequestForm, patient_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Blood Group</Label>
                <Select
                  value={editRequestForm.blood_group}
                  onValueChange={(value) => setEditRequestForm({ ...editRequestForm, blood_group: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Hospital Name</Label>
              <Input
                value={editRequestForm.hospital_name}
                onChange={(e) => setEditRequestForm({ ...editRequestForm, hospital_name: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input
                  value={editRequestForm.contact_name}
                  onChange={(e) => setEditRequestForm({ ...editRequestForm, contact_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input
                  value={editRequestForm.contact_phone}
                  onChange={(e) => setEditRequestForm({ ...editRequestForm, contact_phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Units Needed</Label>
                <Input
                  type="number"
                  min="1"
                  value={editRequestForm.units_needed}
                  onChange={(e) => setEditRequestForm({ ...editRequestForm, units_needed: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Urgency</Label>
                <Select
                  value={editRequestForm.urgency}
                  onValueChange={(value) => setEditRequestForm({ ...editRequestForm, urgency: value })}
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
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editRequestForm.notes}
                onChange={(e) => setEditRequestForm({ ...editRequestForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditRequestDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditRequestSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
