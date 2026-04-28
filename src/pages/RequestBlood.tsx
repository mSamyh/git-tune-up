import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Heart, X, Clock, User, Building2, Phone, AlertTriangle, FileText, Droplet } from "lucide-react";
import { LocationSelector } from "@/components/LocationSelector";
import { AppHeader } from "@/components/AppHeader";
import { format, addHours } from "date-fns";
import { useReferenceData, FALLBACK_BLOOD_GROUPS, FALLBACK_URGENCY_OPTIONS, FALLBACK_EMERGENCY_TYPES } from "@/contexts/ReferenceDataContext";
import { cn } from "@/lib/utils";

const RequestBlood = () => {
  const { bloodGroupCodes, urgencyOptions, emergencyTypes } = useReferenceData();
  const bloodGroups = bloodGroupCodes.length > 0 ? bloodGroupCodes : FALLBACK_BLOOD_GROUPS;
  const neededBeforeOptions = urgencyOptions.length > 0 
    ? urgencyOptions.map(opt => ({ value: opt.value, label: opt.label }))
    : FALLBACK_URGENCY_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }));
  const emergencyTypesList = emergencyTypes.length > 0 
    ? emergencyTypes 
    : FALLBACK_EMERGENCY_TYPES;
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAtoll, setSelectedAtoll] = useState("");
  const [selectedIsland, setSelectedIsland] = useState("");
  const [neededBeforeOption, setNeededBeforeOption] = useState("");
  const [customDateTime, setCustomDateTime] = useState("");
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

  // Auth guard - redirect if not logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          variant: "destructive",
          title: "Authentication required",
          description: "Please log in to create a blood request.",
        });
        navigate("/auth");
      }
    };
    checkAuth();
  }, [navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double-submit
    if (isSubmitting) return;
    setIsSubmitting(true);
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

      // Calculate needed_before timestamp
      let neededBefore: string | null = null;
      if (neededBeforeOption && neededBeforeOption !== "custom") {
        neededBefore = addHours(new Date(), parseInt(neededBeforeOption)).toISOString();
      } else if (neededBeforeOption === "custom" && customDateTime) {
        neededBefore = new Date(customDateTime).toISOString();
      }

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
          needed_before: neededBefore,
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
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 pb-20">
      <AppHeader />

      <main className="container mx-auto px-4 py-5 max-w-2xl animate-fade-in">
        <div className="bg-card rounded-3xl border border-border/60 shadow-xl overflow-hidden">
          {/* Hero header — matches donation entry card aesthetic */}
          <div
            className="relative px-5 pt-6 pb-5 text-white overflow-hidden"
            style={{
              background:
                "radial-gradient(circle at 30% 20%, hsl(0 70% 28%) 0%, hsl(0 80% 16%) 55%, hsl(348 60% 11%) 100%)",
            }}
          >
            <div
              className="absolute inset-0 opacity-[0.08] pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(hsl(0 0% 100%) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            />
            <div className="absolute -top-12 -right-8 w-40 h-40 rounded-full bg-rose-500/30 blur-3xl" />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="absolute right-3 top-3 h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md"
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="relative flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-rose-500 to-primary flex items-center justify-center shadow-2xl border border-white/20">
                <Heart className="h-7 w-7 text-white fill-white/30" />
              </div>
              <div>
                <p className="text-white/60 text-[10px] uppercase tracking-[0.25em] font-bold mb-0.5">
                  New Request
                </p>
                <h1 className="text-white text-xl font-black leading-tight">Request Blood</h1>
                <p className="text-white/70 text-xs mt-0.5">Notify nearby matched donors instantly</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="p-5">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Section: Patient */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-foreground">Patient</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="patientName" className="text-xs font-semibold text-muted-foreground">Patient Name</Label>
                    <Input
                      id="patientName"
                      value={formData.patientName}
                      onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bloodGroup" className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Droplet className="h-3 w-3 text-rose-500" /> Blood Group
                    </Label>
                    <Select
                      value={formData.bloodGroup}
                      onValueChange={(value) => setFormData({ ...formData, bloodGroup: value })}
                      required
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Select blood group" />
                      </SelectTrigger>
                      <SelectContent>
                        {bloodGroups.map((group) => (
                          <SelectItem key={group} value={group}>
                            {group}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unitsNeeded" className="text-xs font-semibold text-muted-foreground">Units Needed</Label>
                  <Input
                    id="unitsNeeded"
                    type="number"
                    min="1"
                    value={formData.unitsNeeded}
                    onChange={(e) => setFormData({ ...formData, unitsNeeded: e.target.value })}
                    required
                    className="h-11 rounded-xl"
                  />
                </div>
              </section>

              {/* Section: Hospital */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-foreground">Hospital & Location</h2>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Location (Atoll & Island)</Label>
                  <LocationSelector
                    selectedAtoll={selectedAtoll}
                    selectedIsland={selectedIsland}
                    onAtollChange={setSelectedAtoll}
                    onIslandChange={setSelectedIsland}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hospitalName" className="text-xs font-semibold text-muted-foreground">Hospital Name</Label>
                  <Input
                    id="hospitalName"
                    value={formData.hospitalName}
                    onChange={(e) => setFormData({ ...formData, hospitalName: e.target.value })}
                    required
                    className="h-11 rounded-xl"
                  />
                </div>
              </section>

              {/* Section: Contact */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-foreground">Contact</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="contactName" className="text-xs font-semibold text-muted-foreground">Contact Name</Label>
                    <Input
                      id="contactName"
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contactPhone" className="text-xs font-semibold text-muted-foreground">Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
              </section>

              {/* Section: Urgency */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-foreground">Urgency & Timing</h2>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Emergency Type</Label>
                  <Select
                    value={formData.emergencyType}
                    onValueChange={(value) => setFormData({ ...formData, emergencyType: value })}
                    required
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select emergency type" />
                    </SelectTrigger>
                    <SelectContent>
                      {emergencyTypesList.map((type) => (
                        <SelectItem key={type.code} value={type.code}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.emergencyType === "custom" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="customEmergency" className="text-xs font-semibold text-muted-foreground">Specify Emergency Type</Label>
                    <Input
                      id="customEmergency"
                      value={formData.customEmergency}
                      onChange={(e) => setFormData({ ...formData, customEmergency: e.target.value })}
                      placeholder="Enter custom emergency type"
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Urgency Level</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "normal", label: "Normal", desc: "Within 24h+" },
                      { value: "urgent", label: "Urgent", desc: "ASAP" },
                    ].map((opt) => {
                      const active = formData.urgency === opt.value;
                      return (
                        <button
                          type="button"
                          key={opt.value}
                          onClick={() => setFormData({ ...formData, urgency: opt.value })}
                          className={cn(
                            "rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.98]",
                            active
                              ? opt.value === "urgent"
                                ? "border-amber-500/60 bg-gradient-to-br from-amber-500/15 to-rose-500/10 shadow-sm"
                                : "border-primary/50 bg-primary/5 shadow-sm"
                              : "border-border/60 bg-card hover:border-primary/30"
                          )}
                        >
                          <p className="text-sm font-bold leading-none">{opt.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Needed Within
                  </Label>
                  <Select
                    value={neededBeforeOption}
                    onValueChange={setNeededBeforeOption}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select timeframe (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {neededBeforeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {neededBeforeOption === "custom" && (
                    <Input
                      type="datetime-local"
                      value={customDateTime}
                      onChange={(e) => setCustomDateTime(e.target.value)}
                      min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                      className="mt-2 h-11 rounded-xl"
                    />
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Setting a deadline helps donors prioritize urgent requests
                  </p>
                </div>
              </section>

              {/* Section: Notes */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-foreground">Additional Notes</h2>
                </div>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Any extra context for donors (optional)"
                  className="rounded-xl resize-none"
                />
              </section>

              {/* Submit callout */}
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.07] via-rose-500/[0.05] to-transparent p-3 flex items-center gap-2.5">
                <Heart className="h-4 w-4 text-primary fill-primary/30 shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Matching donors nearby will be auto-notified the moment you submit.
                </p>
              </div>

              <Button type="submit" className="w-full h-12 rounded-xl font-bold btn-press text-base" disabled={loading}>
                {loading ? "Creating request..." : "Create Request"}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RequestBlood;