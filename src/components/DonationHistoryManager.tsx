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
import { Calendar as CalendarIcon, Plus, Trash, User, Pencil } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const DonationHistoryManager = () => {
  const [donors, setDonors] = useState<any[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [selectedDonor, setSelectedDonor] = useState("");
  const [donationDate, setDonationDate] = useState<Date>();
  const [hospitalName, setHospitalName] = useState("");
  const [notes, setNotes] = useState("");
  const [units, setUnits] = useState("1");
  const [editingDonation, setEditingDonation] = useState<any>(null);
  const [editDate, setEditDate] = useState<Date>();
  const [editHospital, setEditHospital] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editUnits, setEditUnits] = useState("1");
  const { toast } = useToast();

  useEffect(() => {
    fetchDonors();
    fetchDonations();
  }, []);

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
    
    // Validate date is not in the future
    if (donationDate > new Date()) {
      toast({
        variant: "destructive",
        title: "Invalid date",
        description: "Cannot set future dates as donation date",
      });
      return;
    }


    const { error } = await supabase
      .from("donation_history")
      .insert({
        donor_id: selectedDonor,
        donation_date: format(donationDate, "yyyy-MM-dd"),
        hospital_name: hospitalName,
        notes: notes || null,
        units_donated: parseInt(units),
      });

    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to add donation",
        description: error.message,
      });
    } else {
      // Update last_donation_date in profile only if the new date is more recent
      const donor = donors.find(d => d.id === selectedDonor);
      if (!donor?.last_donation_date || donationDate > new Date(donor.last_donation_date)) {
        await supabase
          .from("profiles")
          .update({ last_donation_date: format(donationDate, "yyyy-MM-dd") })
          .eq("id", selectedDonor);
      }

      // Send Telegram notification for new donation
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
  };

  const deleteDonation = async (donation: any) => {
    const { error } = await supabase
      .from("donation_history")
      .delete()
      .eq("id", donation.id);

    if (!error) {
      // After deletion, recalculate last_donation_date for this donor
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

      toast({
        title: "Donation deleted",
      });
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

    // Validate date is not in the future
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
      // Update last_donation_date in profile if this was the most recent donation
      const donorDonations = donations.filter(d => d.donor_id === editingDonation.donor_id);
      const isNewest = !donorDonations.some(d => 
        d.id !== editingDonation.id && new Date(d.donation_date) > editDate
      );

      if (isNewest) {
        await supabase
          .from("profiles")
          .update({ last_donation_date: format(editDate, "yyyy-MM-dd") })
          .eq("id", editingDonation.donor_id);
      }

      toast({
        title: "Donation updated",
        description: "Donation history updated successfully",
      });

      closeEditDialog();
      fetchDonations();
      fetchDonors();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Donation Record
          </CardTitle>
          <CardDescription>Add a donation record for any donor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="space-y-2">
            <Label>Donation Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !donationDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {donationDate ? format(donationDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={donationDate}
                  onSelect={setDonationDate}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
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
            <Label>Units Donated</Label>
            <Input
              type="number"
              min="1"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              placeholder="1"
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

          <Button onClick={addDonation} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Donation
          </Button>
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
              const donorDonations = donations.filter(d => d.donor_id === donor.id);
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editDate ? format(editDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={editDate}
                    onSelect={setEditDate}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
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
