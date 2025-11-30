import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar as CalendarIcon, Plus, Trash } from "lucide-react";
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

    // Validate date is not older than last donation date
    if (donor?.last_donation_date && donationDate < new Date(donor.last_donation_date)) {
      toast({
        variant: "destructive",
        title: "Invalid date",
        description: "Cannot add dates older than the last donation date",
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
      // Update last_donation_date in profile
      await supabase
        .from("profiles")
        .update({ last_donation_date: format(donationDate, "yyyy-MM-dd") })
        .eq("id", selectedDonor);

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

  const deleteDonation = async (id: string) => {
    const { error } = await supabase
      .from("donation_history")
      .delete()
      .eq("id", id);

    if (!error) {
      toast({
        title: "Donation deleted",
      });
      fetchDonations();
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
                  disabled={(date) => {
                    // Can't select future dates
                    if (date > new Date()) return true;
                    // Can't select dates older than existing last_donation_date
                    const donor = donors.find(d => d.id === selectedDonor);
                    if (donor?.last_donation_date) {
                      const existingDate = new Date(donor.last_donation_date);
                      if (date < existingDate) return true;
                    }
                    return false;
                  }}
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
          <CardTitle>Recent Donations</CardTitle>
          <CardDescription>All donation records</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Donor</TableHead>
                <TableHead>Blood Group</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {donations.map((donation) => (
                <TableRow key={donation.id}>
                  <TableCell>{donation.profiles?.full_name || "Unknown"}</TableCell>
                  <TableCell>{donation.profiles?.blood_group}</TableCell>
                  <TableCell>{format(new Date(donation.donation_date), "PPP")}</TableCell>
                  <TableCell>{donation.hospital_name}</TableCell>
                  <TableCell>{donation.units_donated}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteDonation(donation.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
