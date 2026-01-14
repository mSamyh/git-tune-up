import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar as CalendarIcon, Plus, Trash, User, Pencil, Users, ListPlus, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DonationEntry {
  id: string;
  date: Date | undefined;
  hospital: string;
  units: string;
  notes: string;
}

export const DonationHistoryManager = () => {
  const [donors, setDonors] = useState<any[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [entryMode, setEntryMode] = useState<"single" | "multi-donor" | "multi-entry">("single");
  
  // Single entry state
  const [selectedDonor, setSelectedDonor] = useState("");
  const [donationDate, setDonationDate] = useState<Date>();
  const [hospitalName, setHospitalName] = useState("");
  const [notes, setNotes] = useState("");
  const [units, setUnits] = useState("1");
  
  // Multi-donor state
  const [selectedDonors, setSelectedDonors] = useState<string[]>([]);
  
  // Multi-entry state (for single donor)
  const [multiEntryDonor, setMultiEntryDonor] = useState("");
  const [donationEntries, setDonationEntries] = useState<DonationEntry[]>([
    { id: crypto.randomUUID(), date: undefined, hospital: "", units: "1", notes: "" }
  ]);
  
  // Edit state
  const [editingDonation, setEditingDonation] = useState<any>(null);
  const [editDate, setEditDate] = useState<Date>();
  const [editHospital, setEditHospital] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editUnits, setEditUnits] = useState("1");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [pointsPerDonation, setPointsPerDonation] = useState(100);

  useEffect(() => {
    fetchDonors();
    fetchDonations();
    fetchPointsSettings();
  }, []);

  const fetchPointsSettings = async () => {
    const { data } = await supabase
      .from("reward_settings")
      .select("setting_value")
      .eq("setting_key", "points_per_donation")
      .single();

    if (data) setPointsPerDonation(parseInt(data.setting_value));
  };

  const fetchDonors = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, blood_group, last_donation_date")
      .order("full_name");

    if (data) setDonors(data);
  };

  const fetchDonations = async () => {
    const { data } = await supabase
      .from("donation_history")
      .select("*, profiles(full_name, blood_group)")
      .order("donation_date", { ascending: false });

    if (data) setDonations(data);
  };

  const awardPoints = async (donorId: string, donationId: string, hospitalName: string) => {
    const { data: existingTransaction } = await supabase
      .from("points_transactions")
      .select("id")
      .eq("related_donation_id", donationId)
      .maybeSingle();

    if (existingTransaction) {
      console.log(`Points already awarded for donation ${donationId}, skipping`);
      return;
    }

    const { error: txError } = await supabase
      .from("points_transactions")
      .insert({
        donor_id: donorId,
        points: pointsPerDonation,
        transaction_type: "earned",
        description: `Points earned from blood donation at ${hospitalName}`,
        related_donation_id: donationId,
      });

    if (txError) {
      console.error("Failed to create points transaction:", txError);
      return;
    }

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
  };

  const deductPoints = async (donorId: string, donationId: string, hospitalName: string) => {
    const { data: existingDeduction } = await supabase
      .from("points_transactions")
      .select("id")
      .eq("donor_id", donorId)
      .eq("related_donation_id", donationId)
      .eq("transaction_type", "adjusted")
      .lt("points", 0)
      .maybeSingle();

    if (existingDeduction) {
      console.log("Deduction already exists for donation:", donationId, "- skipping duplicate");
      return;
    }

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
          related_donation_id: donationId,
        });
    }
  };

  const syncLastDonationDate = async (donorId: string) => {
    const { data: mostRecentDonation } = await supabase
      .from("donation_history")
      .select("donation_date")
      .eq("donor_id", donorId)
      .order("donation_date", { ascending: false })
      .limit(1)
      .single();
    
    if (mostRecentDonation) {
      await supabase
        .from("profiles")
        .update({ last_donation_date: mostRecentDonation.donation_date })
        .eq("id", donorId);
    }
  };

  // Single donation entry
  const addDonation = async () => {
    if (!selectedDonor || !donationDate || !hospitalName) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please provide donor, date, and hospital name",
      });
      return;
    }

    const donor = donors.find(d => d.id === selectedDonor);
    
    if (donationDate > new Date()) {
      toast({
        variant: "destructive",
        title: "Invalid date",
        description: "Cannot set future dates as donation date",
      });
      return;
    }

    setIsSubmitting(true);

    const { data: newDonation, error } = await supabase
      .from("donation_history")
      .insert({
        donor_id: selectedDonor,
        donation_date: format(donationDate, "yyyy-MM-dd"),
        hospital_name: hospitalName,
        notes: notes || null,
        units_donated: parseInt(units),
      })
      .select()
      .single();

    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to add donation",
        description: error.message,
      });
    } else {
      if (newDonation) {
        await awardPoints(selectedDonor, newDonation.id, hospitalName);
      }
      
      await syncLastDonationDate(selectedDonor);

      if (donor) {
        const { notifyNewDonation } = await import("@/lib/telegramNotifications");
        await notifyNewDonation({
          donor_name: donor.full_name,
          hospital_name: hospitalName,
          donation_date: format(donationDate, "yyyy-MM-dd"),
          units_donated: parseInt(units)
        });
      }

      toast({
        title: "Donation added",
        description: "Donation history updated successfully",
      });

      setSelectedDonor("");
      setDonationDate(undefined);
      setHospitalName("");
      setNotes("");
      setUnits("1");
      fetchDonations();
      fetchDonors();
    }
    
    setIsSubmitting(false);
  };

  // Multi-donor bulk add
  const addBulkDonations = async () => {
    if (selectedDonors.length === 0 || !donationDate || !hospitalName) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select donors, date, and hospital name",
      });
      return;
    }

    if (donationDate > new Date()) {
      toast({
        variant: "destructive",
        title: "Invalid date",
        description: "Cannot set future dates",
      });
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;

    for (const donorId of selectedDonors) {
      const donor = donors.find(d => d.id === donorId);
      
      const { data: newDonation, error } = await supabase
        .from("donation_history")
        .insert({
          donor_id: donorId,
          donation_date: format(donationDate, "yyyy-MM-dd"),
          hospital_name: hospitalName,
          notes: notes || null,
          units_donated: parseInt(units),
        })
        .select()
        .single();

      if (!error && newDonation) {
        await awardPoints(donorId, newDonation.id, hospitalName);
        await syncLastDonationDate(donorId);
        
        if (donor) {
          const { notifyNewDonation } = await import("@/lib/telegramNotifications");
          await notifyNewDonation({
            donor_name: donor.full_name,
            hospital_name: hospitalName,
            donation_date: format(donationDate, "yyyy-MM-dd"),
            units_donated: parseInt(units)
          });
        }
        successCount++;
      }
    }

    toast({
      title: "Bulk donations added",
      description: `Added ${successCount} donation records`,
    });

    setSelectedDonors([]);
    setDonationDate(undefined);
    setHospitalName("");
    setNotes("");
    setUnits("1");
    fetchDonations();
    fetchDonors();
    setIsSubmitting(false);
  };

  // Multi-entry for single donor
  const addMultipleEntriesForDonor = async () => {
    if (!multiEntryDonor) {
      toast({
        variant: "destructive",
        title: "Missing donor",
        description: "Please select a donor",
      });
      return;
    }

    const validEntries = donationEntries.filter(e => e.date && e.hospital);
    if (validEntries.length === 0) {
      toast({
        variant: "destructive",
        title: "No valid entries",
        description: "Please add at least one entry with date and hospital",
      });
      return;
    }

    // Check for future dates
    const hasFutureDate = validEntries.some(e => e.date && e.date > new Date());
    if (hasFutureDate) {
      toast({
        variant: "destructive",
        title: "Invalid date",
        description: "Cannot set future dates",
      });
      return;
    }

    setIsSubmitting(true);
    const donor = donors.find(d => d.id === multiEntryDonor);
    let successCount = 0;

    for (const entry of validEntries) {
      const { data: newDonation, error } = await supabase
        .from("donation_history")
        .insert({
          donor_id: multiEntryDonor,
          donation_date: format(entry.date!, "yyyy-MM-dd"),
          hospital_name: entry.hospital,
          notes: entry.notes || null,
          units_donated: parseInt(entry.units),
        })
        .select()
        .single();

      if (!error && newDonation) {
        await awardPoints(multiEntryDonor, newDonation.id, entry.hospital);
        successCount++;
      }
    }

    await syncLastDonationDate(multiEntryDonor);

    if (donor && successCount > 0) {
      const { notifyNewDonation } = await import("@/lib/telegramNotifications");
      await notifyNewDonation({
        donor_name: donor.full_name,
        hospital_name: `${successCount} donations`,
        donation_date: format(new Date(), "yyyy-MM-dd"),
        units_donated: validEntries.reduce((sum, e) => sum + parseInt(e.units), 0)
      });
    }

    toast({
      title: "Donations added",
      description: `Added ${successCount} entries for ${donor?.full_name}`,
    });

    setMultiEntryDonor("");
    setDonationEntries([{ id: crypto.randomUUID(), date: undefined, hospital: "", units: "1", notes: "" }]);
    fetchDonations();
    fetchDonors();
    setIsSubmitting(false);
  };

  const addEntryRow = () => {
    setDonationEntries([...donationEntries, { id: crypto.randomUUID(), date: undefined, hospital: "", units: "1", notes: "" }]);
  };

  const removeEntryRow = (id: string) => {
    if (donationEntries.length > 1) {
      setDonationEntries(donationEntries.filter(e => e.id !== id));
    }
  };

  const updateEntryField = (id: string, field: keyof DonationEntry, value: any) => {
    setDonationEntries(donationEntries.map(e => 
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  const deleteDonation = async (donation: any) => {
    await deductPoints(donation.donor_id, donation.id, donation.hospital_name);

    const { error } = await supabase
      .from("donation_history")
      .delete()
      .eq("id", donation.id);

    if (!error) {
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

      toast({ title: "Donation deleted" });
      await fetchDonations();
      await fetchDonors();
    }
  };

  const openEditDialog = (donation: any) => {
    setEditingDonation(donation);
    setEditDate(new Date(donation.donation_date));
    setEditHospital(donation.hospital_name);
    setEditNotes(donation.notes || "");
    setEditUnits(donation.units_donated.toString());
  };

  const closeEditDialog = () => {
    setEditingDonation(null);
    setEditDate(undefined);
    setEditHospital("");
    setEditNotes("");
    setEditUnits("1");
  };

  const updateDonation = async () => {
    if (!editDate || !editHospital.trim()) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please provide date and hospital name",
      });
      return;
    }

    if (editDate > new Date()) {
      toast({
        variant: "destructive",
        title: "Invalid date",
        description: "Cannot set future dates as donation date",
      });
      return;
    }

    const { error } = await supabase
      .from("donation_history")
      .update({
        donation_date: format(editDate, "yyyy-MM-dd"),
        hospital_name: editHospital.trim(),
        notes: editNotes.trim() || null,
        units_donated: parseInt(editUnits),
      })
      .eq("id", editingDonation.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to update donation",
        description: error.message,
      });
    } else {
      await syncLastDonationDate(editingDonation.donor_id);

      toast({
        title: "Donation updated",
        description: "Donation history updated successfully",
      });

      closeEditDialog();
      fetchDonations();
      fetchDonors();
    }
  };

  const toggleDonorSelection = (donorId: string) => {
    setSelectedDonors(prev => 
      prev.includes(donorId) 
        ? prev.filter(id => id !== donorId) 
        : [...prev, donorId]
    );
  };

  const selectAllDonors = () => setSelectedDonors(donors.map(d => d.id));
  const deselectAllDonors = () => setSelectedDonors([]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Donation Record
          </CardTitle>
          <CardDescription>Add donation records - single, multiple donors, or bulk entries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Entry Mode Tabs */}
          <Tabs value={entryMode} onValueChange={(v) => setEntryMode(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="single" className="text-xs">
                <User className="h-3 w-3 mr-1" />
                Single
              </TabsTrigger>
              <TabsTrigger value="multi-donor" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                Multi-Donor
              </TabsTrigger>
              <TabsTrigger value="multi-entry" className="text-xs">
                <ListPlus className="h-3 w-3 mr-1" />
                Multi-Entry
              </TabsTrigger>
            </TabsList>

            {/* Single Entry Mode */}
            <TabsContent value="single" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Select Donor</Label>
                <Select value={selectedDonor} onValueChange={setSelectedDonor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select donor" />
                  </SelectTrigger>
                  <SelectContent>
                    {donors.map((donor) => (
                      <SelectItem key={donor.id} value={donor.id}>
                        {donor.full_name} ({donor.blood_group})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Donation Date</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={donationDate ? format(donationDate, "yyyy-MM-dd") : ""}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value + "T00:00:00") : undefined;
                        if (date && date <= new Date()) setDonationDate(date);
                      }}
                      max={format(new Date(), "yyyy-MM-dd")}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Units</Label>
                  <Input
                    type="number"
                    min="1"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Hospital Name</Label>
                <Input
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder="Enter hospital name"
                />
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes"
                />
              </div>

              <Button onClick={addDonation} className="w-full" disabled={isSubmitting}>
                <Plus className="h-4 w-4 mr-2" />
                Add Donation
              </Button>
            </TabsContent>

            {/* Multi-Donor Mode */}
            <TabsContent value="multi-donor" className="space-y-4 mt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select Donors ({selectedDonors.length} selected)</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllDonors}>Select All</Button>
                    <Button variant="outline" size="sm" onClick={deselectAllDonors}>Clear</Button>
                  </div>
                </div>
                <ScrollArea className="h-48 border rounded-lg p-2">
                  {donors.map((donor) => (
                    <label 
                      key={donor.id} 
                      className="flex items-center gap-3 p-2 hover:bg-muted rounded cursor-pointer"
                    >
                      <Checkbox 
                        checked={selectedDonors.includes(donor.id)}
                        onCheckedChange={() => toggleDonorSelection(donor.id)}
                      />
                      <span className="flex-1">{donor.full_name}</span>
                      <span className="text-muted-foreground text-sm">{donor.blood_group}</span>
                    </label>
                  ))}
                </ScrollArea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Donation Date</Label>
                  <Input
                    type="date"
                    value={donationDate ? format(donationDate, "yyyy-MM-dd") : ""}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value + "T00:00:00") : undefined;
                      if (date && date <= new Date()) setDonationDate(date);
                    }}
                    max={format(new Date(), "yyyy-MM-dd")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Units</Label>
                  <Input
                    type="number"
                    min="1"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Hospital Name</Label>
                <Input
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder="Enter hospital name"
                />
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes (applies to all)"
                />
              </div>

              <Button onClick={addBulkDonations} className="w-full" disabled={isSubmitting || selectedDonors.length === 0}>
                <Users className="h-4 w-4 mr-2" />
                Add {selectedDonors.length} Donations
              </Button>
            </TabsContent>

            {/* Multi-Entry Mode (for single donor) */}
            <TabsContent value="multi-entry" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Select Donor</Label>
                <Select value={multiEntryDonor} onValueChange={setMultiEntryDonor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select donor" />
                  </SelectTrigger>
                  <SelectContent>
                    {donors.map((donor) => (
                      <SelectItem key={donor.id} value={donor.id}>
                        {donor.full_name} ({donor.blood_group})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Donation Entries ({donationEntries.length})</Label>
                  <Button variant="outline" size="sm" onClick={addEntryRow}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Row
                  </Button>
                </div>
                
                <ScrollArea className="max-h-64">
                  <div className="space-y-3">
                    {donationEntries.map((entry, index) => (
                      <div key={entry.id} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Entry #{index + 1}</span>
                          {donationEntries.length > 1 && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => removeEntryRow(entry.id)}
                              className="h-6 w-6 p-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="date"
                            value={entry.date ? format(entry.date, "yyyy-MM-dd") : ""}
                            onChange={(e) => {
                              const date = e.target.value ? new Date(e.target.value + "T00:00:00") : undefined;
                              if (!date || date <= new Date()) {
                                updateEntryField(entry.id, "date", date);
                              }
                            }}
                            max={format(new Date(), "yyyy-MM-dd")}
                            placeholder="Date"
                          />
                          <Input
                            type="number"
                            min="1"
                            value={entry.units}
                            onChange={(e) => updateEntryField(entry.id, "units", e.target.value)}
                            placeholder="Units"
                          />
                        </div>
                        
                        <Input
                          value={entry.hospital}
                          onChange={(e) => updateEntryField(entry.id, "hospital", e.target.value)}
                          placeholder="Hospital name"
                        />
                        
                        <Input
                          value={entry.notes}
                          onChange={(e) => updateEntryField(entry.id, "notes", e.target.value)}
                          placeholder="Notes (optional)"
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <Button 
                onClick={addMultipleEntriesForDonor} 
                className="w-full" 
                disabled={isSubmitting || !multiEntryDonor || donationEntries.filter(e => e.date && e.hospital).length === 0}
              >
                <ListPlus className="h-4 w-4 mr-2" />
                Add {donationEntries.filter(e => e.date && e.hospital).length} Entries
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Donation History by Donor</CardTitle>
          <CardDescription>View and manage donation records for each donor</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {donors.map((donor) => {
              const donorDonations = donations
                .filter(d => d.donor_id === donor.id)
                .sort((a, b) => new Date(b.donation_date).getTime() - new Date(a.donation_date).getTime());
              if (donorDonations.length === 0) return null;
              
              return (
                <AccordionItem key={donor.id} value={donor.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{donor.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {donor.blood_group} • {donorDonations.length} donation{donorDonations.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Hospital</TableHead>
                          <TableHead>Units</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {donorDonations.map((donation) => (
                          <TableRow key={donation.id}>
                            <TableCell>{format(new Date(donation.donation_date), "PPP")}</TableCell>
                            <TableCell>{donation.hospital_name}</TableCell>
                            <TableCell>{donation.units_donated}</TableCell>
                            <TableCell className="text-muted-foreground">{donation.notes || "—"}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditDialog(donation)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteDonation(donation)}
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
          
          {donations.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No donation records yet</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingDonation} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Donation Record</DialogTitle>
            <DialogDescription>
              Update the donation details for {editingDonation?.profiles?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Donation Date</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={editDate ? format(editDate, "yyyy-MM-dd") : ""}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value + "T00:00:00") : undefined;
                    if (date && date <= new Date()) {
                      setEditDate(date);
                    }
                  }}
                  max={format(new Date(), "yyyy-MM-dd")}
                  className="flex-1"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon">
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={editDate}
                      onSelect={setEditDate}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      captionLayout="dropdown-buttons"
                      fromYear={2000}
                      toYear={new Date().getFullYear()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Hospital Name</Label>
              <Input
                value={editHospital}
                onChange={(e) => setEditHospital(e.target.value)}
                placeholder="Enter hospital name"
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label>Units Donated</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={editUnits}
                onChange={(e) => setEditUnits(e.target.value)}
                placeholder="1"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Additional notes"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancel
            </Button>
            <Button onClick={updateDonation}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
