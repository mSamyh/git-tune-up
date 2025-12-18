import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { ContactAdminForm } from "@/components/ContactAdminForm";
import { BloodCompatibilityChecker } from "@/components/BloodCompatibilityChecker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Droplet, Users } from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Droplet className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold">About LeyHadhiya</h1>
            <p className="text-xl text-muted-foreground">
              Connecting blood donors with those in need across the Maldives
            </p>
          </div>

          {/* What is LeyHadhiya */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                What is LeyHadhiya?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                LeyHadhiya is a community-driven blood donation network designed to save lives by 
                connecting voluntary blood donors with patients and hospitals in need. Our platform 
                makes it easy to find available donors by blood type and location, post urgent blood 
                requests, and coordinate donations efficiently.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Through our system, donors can register, track their donation history, earn rewards 
                for their life-saving contributions, and respond quickly to emergency blood requests 
                via SMS notifications.
              </p>
            </CardContent>
          </Card>

          {/* Why Blood Donation Matters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Why Blood Donation Matters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Every two seconds, someone around the world needs blood. Blood cannot be manufactured 
                — it can only come from generous donors like you. A single donation can save up to 
                three lives.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Blood is needed for emergency situations, surgeries, cancer treatment, chronic illnesses, 
                and traumatic injuries. By becoming a blood donor, you become a hero in someone's story 
                — often without even knowing whose life you've touched.
              </p>
              <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                <p className="text-sm font-medium text-foreground">
                  Your single act of kindness can make the difference between life and death.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Blood Compatibility Checker */}
          <BloodCompatibilityChecker />

          {/* Contact Admin */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Admin</CardTitle>
              <CardDescription>
                Have questions or need assistance? Send us a message and we'll get back to you soon.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContactAdminForm />
            </CardContent>
          </Card>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default About;
