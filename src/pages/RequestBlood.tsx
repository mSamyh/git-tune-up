import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Heart, ArrowLeft, Clock, User, Building2, Phone, AlertTriangle,
  FileText, Droplet, Sparkles, ShieldCheck, ChevronRight, Activity
} from "lucide-react";
import { LocationSelector } from "@/components/LocationSelector";
import { HospitalCombobox } from "@/components/HospitalCombobox";
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

  // Auth guard
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

  // Live progress for submit-readiness bar
  const completion = useMemo(() => {
    const required = [
      formData.patientName,
      formData.bloodGroup,
      formData.unitsNeeded,
      formData.hospitalName,
      formData.contactName,
      formData.contactPhone,
      formData.emergencyType,
      selectedAtoll,
      selectedIsland,
    ];
    const filled = required.filter(Boolean).length;
    return Math.round((filled / required.length) * 100);
  }, [formData, selectedAtoll, selectedIsland]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to create a request");
      if (!selectedAtoll || !selectedIsland) throw new Error("Please select both atoll and island");

      const emergencyTypeValue = formData.emergencyType === "custom"
        ? formData.customEmergency
        : formData.emergencyType;

      const district = `${selectedAtoll} - ${selectedIsland}`;

      let neededBefore: string | null = null;
      if (neededBeforeOption && neededBeforeOption !== "custom") {
        neededBefore = addHours(new Date(), parseInt(neededBeforeOption)).toISOString();
      } else if (neededBeforeOption === "custom" && customDateTime) {
        neededBefore = new Date(customDateTime).toISOString();
      }

      const { error: requestError } = await supabase
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
      if (smsError) console.error("SMS notification error:", smsError);

      toast({
        title: "Request created",
        description: "Matching donors have been notified.",
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

  const SectionHeader = ({
    icon: Icon,
    label,
    accent = "primary",
  }: { icon: any; label: string; accent?: "primary" | "amber" | "muted" }) => {
    const accentClass =
      accent === "amber"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : accent === "muted"
          ? "bg-muted text-muted-foreground"
          : "bg-primary/12 text-primary";
    return (
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", accentClass)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground">{label}</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-border/70 to-transparent" />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40 pb-32">
      <AppHeader />

      <main className="container mx-auto px-4 py-4 max-w-2xl animate-fade-in">
        <div className="bg-card rounded-3xl border border-border/60 shadow-xl overflow-hidden">
          {/* HERO */}
          <div
            className="relative px-5 pt-5 pb-7 text-white overflow-hidden"
            style={{
              background:
                "radial-gradient(circle at 20% 10%, hsl(0 75% 32%) 0%, hsl(0 80% 18%) 55%, hsl(348 60% 10%) 100%)",
            }}
          >
            <div
              className="absolute inset-0 opacity-[0.07] pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(hsl(0 0% 100%) 1px, transparent 1px)",
                backgroundSize: "14px 14px",
              }}
            />
            <div className="absolute -top-16 -right-10 w-44 h-44 rounded-full bg-rose-500/30 blur-3xl" />
            <div className="absolute -bottom-12 -left-10 w-40 h-40 rounded-full bg-primary/20 blur-3xl" />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="absolute left-3 top-3 h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 backdrop-blur-md"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="relative pt-8 flex items-start gap-3.5">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-rose-500 to-primary flex items-center justify-center shadow-2xl border border-white/25 shrink-0">
                <Heart className="h-7 w-7 text-white fill-white/30 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/60 text-[10px] uppercase tracking-[0.28em] font-bold mb-1">
                  Blood Request
                </p>
                <h1 className="text-white text-[22px] font-black leading-tight">
                  Call for a Hero
                </h1>
                <p className="text-white/70 text-xs mt-1 leading-relaxed">
                  We'll instantly notify matching donors closest to the hospital.
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative mt-5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Activity className="h-3 w-3" />
                  Form readiness
                </span>
                <span className="tabular-nums text-white">{completion}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-300 via-rose-200 to-white rounded-full transition-all duration-500"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
          </div>

          {/* FORM */}
          <div className="p-5 space-y-7">
            <form onSubmit={handleSubmit} className="space-y-7">
              {/* Patient */}
              <section>
                <SectionHeader icon={User} label="Patient" />
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="patientName" className="text-xs font-semibold text-muted-foreground">
                      Patient name
                    </Label>
                    <Input
                      id="patientName"
                      placeholder="e.g. Ahmed Hassan"
                      value={formData.patientName}
                      onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>

                  {/* Blood group as visual chips */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Droplet className="h-3 w-3 text-rose-500 fill-rose-500/30" /> Blood group
                    </Label>
                    <div className="grid grid-cols-4 gap-2">
                      {bloodGroups.map((bg) => {
                        const active = formData.bloodGroup === bg;
                        return (
                          <button
                            type="button"
                            key={bg}
                            onClick={() => setFormData({ ...formData, bloodGroup: bg })}
                            className={cn(
                              "relative h-12 rounded-xl border-2 font-black text-sm transition-all active:scale-95 overflow-hidden",
                              active
                                ? "border-primary bg-gradient-to-br from-primary to-rose-600 text-white shadow-lg shadow-primary/25"
                                : "border-border/60 bg-card text-foreground hover:border-primary/40"
                            )}
                          >
                            {active && (
                              <span className="absolute inset-0 opacity-20" style={{
                                backgroundImage: "radial-gradient(white 1px, transparent 1px)",
                                backgroundSize: "8px 8px"
                              }} />
                            )}
                            <span className="relative">{bg}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="unitsNeeded" className="text-xs font-semibold text-muted-foreground">
                      Units needed
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 rounded-xl shrink-0"
                        onClick={() => {
                          const n = Math.max(1, parseInt(formData.unitsNeeded || "1") - 1);
                          setFormData({ ...formData, unitsNeeded: String(n) });
                        }}
                      >−</Button>
                      <Input
                        id="unitsNeeded"
                        type="number"
                        min="1"
                        placeholder="1"
                        value={formData.unitsNeeded}
                        onChange={(e) => setFormData({ ...formData, unitsNeeded: e.target.value })}
                        required
                        className="h-11 rounded-xl text-center text-lg font-black tabular-nums"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 rounded-xl shrink-0"
                        onClick={() => {
                          const n = Math.max(1, parseInt(formData.unitsNeeded || "0") + 1);
                          setFormData({ ...formData, unitsNeeded: String(n) });
                        }}
                      >+</Button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Hospital */}
              <section>
                <SectionHeader icon={Building2} label="Hospital & Location" />
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Atoll & island</Label>
                    <LocationSelector
                      selectedAtoll={selectedAtoll}
                      selectedIsland={selectedIsland}
                      onAtollChange={setSelectedAtoll}
                      onIslandChange={setSelectedIsland}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hospitalName" className="text-xs font-semibold text-muted-foreground">
                      Hospital
                    </Label>
                    <HospitalCombobox
                      value={formData.hospitalName}
                      onChange={(val) => setFormData({ ...formData, hospitalName: val })}
                      placeholder="Select or search hospital"
                    />
                  </div>
                </div>
              </section>

              {/* Contact */}
              <section>
                <SectionHeader icon={Phone} label="Contact Person" />
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="contactName" className="text-xs font-semibold text-muted-foreground">
                      Name
                    </Label>
                    <Input
                      id="contactName"
                      placeholder="Your name"
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contactPhone" className="text-xs font-semibold text-muted-foreground">
                      Phone
                    </Label>
                    <Input
                      id="contactPhone"
                      placeholder="7xxxxxx"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
              </section>

              {/* Urgency */}
              <section>
                <SectionHeader icon={AlertTriangle} label="Urgency & Timing" accent="amber" />
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Emergency type</Label>
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
                    <div className="space-y-1.5 animate-fade-in">
                      <Label htmlFor="customEmergency" className="text-xs font-semibold text-muted-foreground">
                        Specify emergency
                      </Label>
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
                    <Label className="text-xs font-semibold text-muted-foreground">Urgency level</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "normal", label: "Normal", desc: "Within 24h+", icon: Clock },
                        { value: "urgent", label: "Urgent", desc: "ASAP", icon: AlertTriangle },
                      ].map((opt) => {
                        const active = formData.urgency === opt.value;
                        const Icon = opt.icon;
                        return (
                          <button
                            type="button"
                            key={opt.value}
                            onClick={() => setFormData({ ...formData, urgency: opt.value })}
                            className={cn(
                              "rounded-xl border-2 p-3 text-left transition-all active:scale-[0.98] flex items-start gap-2.5",
                              active
                                ? opt.value === "urgent"
                                  ? "border-amber-500 bg-gradient-to-br from-amber-500/15 to-rose-500/10 shadow-md shadow-amber-500/10"
                                  : "border-primary bg-primary/8 shadow-md shadow-primary/10"
                                : "border-border/60 bg-card hover:border-primary/30"
                            )}
                          >
                            <Icon className={cn(
                              "h-4 w-4 mt-0.5",
                              active
                                ? opt.value === "urgent" ? "text-amber-600" : "text-primary"
                                : "text-muted-foreground"
                            )} />
                            <div>
                              <p className="text-sm font-bold leading-none">{opt.label}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">{opt.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3 w-3" /> Needed within
                    </Label>
                    <Select value={neededBeforeOption} onValueChange={setNeededBeforeOption}>
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
                      A clear deadline helps donors prioritize urgent cases.
                    </p>
                  </div>
                </div>
              </section>

              {/* Notes */}
              <section>
                <SectionHeader icon={FileText} label="Additional Notes" accent="muted" />
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Any extra context for donors (optional)"
                  className="rounded-xl resize-none"
                />
              </section>

              {/* Trust callout */}
              <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.07] via-emerald-500/[0.04] to-transparent p-3.5 flex items-start gap-3">
                <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-foreground leading-snug">
                    Smart matching is on
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                    Compatible donors near {selectedIsland || "the hospital"} get notified the moment you submit.
                  </p>
                </div>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* STICKY SUBMIT BAR */}
      <div className="fixed bottom-0 inset-x-0 z-40 px-4 pb-4 pt-3 bg-gradient-to-t from-background via-background/95 to-background/0 backdrop-blur-md">
        <div className="container mx-auto max-w-2xl">
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || completion < 100}
            className="w-full h-13 rounded-2xl font-black text-base btn-press shadow-xl shadow-primary/25 bg-gradient-to-r from-primary to-rose-600 hover:from-primary hover:to-rose-700 disabled:opacity-60 disabled:cursor-not-allowed group"
            style={{ height: "52px" }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 animate-pulse" />
                Sending alerts…
              </span>
            ) : completion < 100 ? (
              <span className="flex items-center gap-2 text-white/90">
                Complete the form ({completion}%)
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Heart className="h-4 w-4 fill-white/30" />
                Send Request to Donors
                <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RequestBlood;
