import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Heart } from "lucide-react";
import { LocationSelector } from "@/components/LocationSelector";
import { AppHeader } from "@/components/AppHeader";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const RequestBlood = () => {
  const [loading, setLoading] = useState(false);
  const [selectedAtoll, setSelectedAtoll] = useState("");
  const [selectedIsland, setSelectedIsland] = useState("");
  const [formData, setFormData] = useState({
    patientName: "",
    bloodGroup: "",
    unitsNeeded: "",
    hospitalName: "",
    contactName: "",
    contactPhone: "",
    urgency: "normal",
    emergencyType: "",
    customEmergency: "",
    notes: "",
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("You must be logged in to create a request");
      }

      if (!selectedAtoll || !selectedIsland) {
        throw new Error("Please select both atoll and island");
      }

      const emergencyTypeValue = formData.emergencyType === "custom" 
        ? formData.customEmergency 
        : formData.emergencyType;

      const district = `${selectedAtoll} - ${selectedIsland}`;

      const { data: request, error: requestError } = await supabase
        .from("blood_requests")
        .insert({
          patient_name: formData.patientName,
          blood_group: formData.bloodGroup,
          units_needed: parseInt(formData.unitsNeeded),
          hospital_name: formData.hospitalName,
          contact_name: formData.contactName,
          contact_phone: formData.contactPhone,
          urgency: formData.urgency,
          emergency_type: emergencyTypeValue,
          notes: formData.notes || null,
          requested_by: user.id,
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Send SMS notifications to matching donors
      // Note: Telegram notification with donor list is now sent automatically by the SMS function
      const { error: smsError } = await supabase.functions.invoke("send-blood-request-sms", {
        body: {
          bloodGroup: formData.bloodGroup,
          district: district,
          requestDetails: {
            patientName: formData.patientName,
            hospitalName: formData.hospitalName,
            contactName: formData.contactName,
            contactPhone: formData.contactPhone,
          },
        },
      });

      if (smsError) {
        console.error("SMS notification error:", smsError);
        // Don't fail the request if SMS fails
      }

      toast({
        title: "Request created successfully",
        description: "Matching donors have been notified",
      });

      navigate("/");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to create request",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
                <Heart className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-2xl">Request Blood</CardTitle>
                <CardDescription>Create a blood donation request</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="patientName">Patient Name</Label>
                  <Input
                    id="patientName"
                    value={formData.patientName}
                    onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bloodGroup">Blood Group</Label>
                  <Select
                    value={formData.bloodGroup}
                    onValueChange={(value) => setFormData({ ...formData, bloodGroup: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOOD_GROUPS.map((group) => (
                        <SelectItem key={group} value={group}>
                          {group}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitsNeeded">Units Needed</Label>
                <Input
                  id="unitsNeeded"
                  type="number"
                  min="1"
                  value={formData.unitsNeeded}
                  onChange={(e) => setFormData({ ...formData, unitsNeeded: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Location (Atoll & Island)</Label>
                <LocationSelector
                  selectedAtoll={selectedAtoll}
                  selectedIsland={selectedIsland}
                  onAtollChange={setSelectedAtoll}
                  onIslandChange={setSelectedIsland}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hospitalName">Hospital Name</Label>
                <Input
                  id="hospitalName"
                  value={formData.hospitalName}
                  onChange={(e) => setFormData({ ...formData, hospitalName: e.target.value })}
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name</Label>
                  <Input
                    id="contactName"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Emergency Type</Label>
                <Select
                  value={formData.emergencyType}
                  onValueChange={(value) => setFormData({ ...formData, emergencyType: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select emergency type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thalassaemia">Thalassaemia</SelectItem>
                    <SelectItem value="pregnancy">Pregnancy</SelectItem>
                    <SelectItem value="surgery">Surgery</SelectItem>
                    <SelectItem value="emergency_surgery">Emergency Surgery</SelectItem>
                    <SelectItem value="custom">Custom (Specify)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.emergencyType === "custom" && (
                <div className="space-y-2">
                  <Label htmlFor="customEmergency">Specify Emergency Type</Label>
                  <Input
                    id="customEmergency"
                    value={formData.customEmergency}
                    onChange={(e) => setFormData({ ...formData, customEmergency: e.target.value })}
                    placeholder="Enter custom emergency type"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Urgency Level</Label>
                <RadioGroup
                  value={formData.urgency}
                  onValueChange={(value) => setFormData({ ...formData, urgency: value })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="normal" id="normal" />
                    <Label htmlFor="normal" className="font-normal">Normal</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="urgent" id="urgent" />
                    <Label htmlFor="urgent" className="font-normal">Urgent</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating request..." : "Create Request"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default RequestBlood;