import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Droplet, CheckCircle, XCircle, Clock, Calendar, Phone, MapPin, ArrowLeft, Shield } from "lucide-react";
import { format } from "date-fns";

interface DonorProfile {
  id: string;
  full_name: string;
  blood_group: string;
  avatar_url: string | null;
  phone: string;
  last_donation_date: string | null;
  availability_status: string;
  district: string | null;
  atoll: string | null;
  island: string | null;
  title: string | null;
  title_color: string | null;
}

const VerifyDonor = () => {
  const { donorId } = useParams();
  const navigate = useNavigate();
  const [donor, setDonor] = useState<DonorProfile | null>(null);
  const [donationCount, setDonationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (donorId) {
      fetchDonor();
    }
  }, [donorId]);

  const fetchDonor = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", donorId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profileData) {
        setError("Donor not found");
        setLoading(false);
        return;
      }

      setDonor(profileData);

      // Fetch donation count
      const { data: countData } = await supabase.rpc("get_donation_count", {
        donor_uuid: donorId,
      });
      setDonationCount(countData || 0);
    } catch (err: any) {
      setError(err.message || "Failed to load donor");
    } finally {
      setLoading(false);
    }
  };

  const getEligibility = () => {
    if (!donor?.last_donation_date) {
      return { 
        eligible: true, 
        status: "eligible", 
        text: "Eligible to Donate",
        subtext: "No previous donations recorded"
      };
    }

    const lastDonation = new Date(donor.last_donation_date);
    const daysSince = Math.floor(
      (new Date().getTime() - lastDonation.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince >= 90) {
      return { 
        eligible: true, 
        status: "eligible", 
        text: "Eligible to Donate",
        subtext: `${daysSince} days since last donation`
      };
    }

    const daysRemaining = 90 - daysSince;
    return { 
      eligible: false, 
      status: "waiting", 
      text: `Wait ${daysRemaining} Days`,
      subtext: `Last donated ${daysSince} days ago`
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-pulse">
              <div className="h-20 w-20 bg-gray-200 rounded-full mx-auto mb-4" />
              <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
            </div>
            <p className="text-muted-foreground mt-4">Verifying donor...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !donor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold text-destructive mb-2">Verification Failed</h2>
            <p className="text-muted-foreground mb-6">{error || "Donor not found"}</p>
            <Button onClick={() => navigate("/")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const eligibility = getEligibility();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white py-6 px-4">
        <div className="container mx-auto max-w-md">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/20 p-2 rounded-full">
              <Droplet className="h-6 w-6 fill-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">LeyHadhiya</h1>
              <p className="text-red-200 text-sm">Donor Verification</p>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto max-w-md px-4 py-6 -mt-4">
        {/* Verification Status Card */}
        <Card className={`mb-4 border-2 ${
          eligibility.eligible 
            ? "border-green-200 bg-green-50/50" 
            : "border-amber-200 bg-amber-50/50"
        }`}>
          <CardContent className="p-6 text-center">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
              eligibility.eligible ? "bg-green-100" : "bg-amber-100"
            }`}>
              {eligibility.eligible ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <Clock className="h-8 w-8 text-amber-600" />
              )}
            </div>
            <h2 className={`text-2xl font-bold mb-1 ${
              eligibility.eligible ? "text-green-700" : "text-amber-700"
            }`}>
              {eligibility.text}
            </h2>
            <p className="text-muted-foreground text-sm">{eligibility.subtext}</p>
          </CardContent>
        </Card>

        {/* Donor Info Card */}
        <Card className="shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border-4 border-red-100">
                <AvatarImage src={donor.avatar_url || undefined} />
                <AvatarFallback className="bg-red-100 text-red-600 text-2xl font-bold">
                  {donor.full_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-xl">{donor.full_name}</CardTitle>
                {donor.title && (
                  <Badge className={`mt-1 ${donor.title_color || "bg-secondary"}`}>
                    {donor.title}
                  </Badge>
                )}
                <p className="text-muted-foreground text-sm mt-1">
                  ID: {donor.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Blood Group */}
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Droplet className="h-6 w-6 text-red-600 fill-red-600" />
                <span className="text-muted-foreground">Blood Type</span>
              </div>
              <span className="text-3xl font-black text-red-600">{donor.blood_group}</span>
            </div>

            {/* Last Donation */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <span className="text-muted-foreground">Last Donation</span>
              </div>
              <span className="font-semibold">
                {donor.last_donation_date 
                  ? format(new Date(donor.last_donation_date), "MMM d, yyyy")
                  : "No record"}
              </span>
            </div>

            {/* Total Donations */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <span className="text-muted-foreground">Total Donations</span>
              </div>
              <span className="font-bold text-xl text-primary">{donationCount}</span>
            </div>

            {/* Location */}
            {(donor.atoll || donor.island || donor.district) && (
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <span className="text-muted-foreground">Location</span>
                </div>
                <span className="font-semibold text-right">
                  {donor.atoll && donor.island 
                    ? `${donor.atoll} - ${donor.island}`
                    : donor.district || "Not specified"}
                </span>
              </div>
            )}

            {/* Contact */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <span className="text-muted-foreground">Contact</span>
              </div>
              <a href={`tel:${donor.phone}`} className="font-semibold text-primary hover:underline">
                {donor.phone}
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Verified Badge */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm text-muted-foreground">Verified by LeyHadhiya</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center pb-6">
          <div className="flex items-center justify-center gap-2 text-red-600 mb-2">
            <Droplet className="h-5 w-5 fill-red-600" />
            <span className="font-bold">LeyHadhiya</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Blood Donor Network • Maldives
          </p>
        </div>
      </main>
    </div>
  );
};

export default VerifyDonor;
