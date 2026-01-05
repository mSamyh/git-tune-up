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

      <main className="container mx-auto px-4 py-6 max-w-2xl animate-fade-in">
        <div className="space-y-6">
          {/* Hero Section */}
          <section className="text-center py-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 mb-5">
              <Droplet className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-bold mb-2">About LeyHadhiya</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Connecting blood donors with those in need across the Maldives
            </p>
          </section>

          {/* What is LeyHadhiya */}
          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2.5 font-display text-lg">
                <div className="h-9 w-9 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Heart className="h-4 w-4 text-primary" />
                </div>
                What is LeyHadhiya?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                LeyHadhiya is a community-driven blood donation network designed to save lives by 
                connecting voluntary blood donors with patients and hospitals in need.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Through our system, donors can register, track their donation history, earn rewards 
                for their life-saving contributions, and respond quickly to emergency blood requests 
                via SMS notifications.
              </p>
            </CardContent>
          </Card>

          {/* Why Blood Donation Matters */}
          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2.5 font-display text-lg">
                <div className="h-9 w-9 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                Why Blood Donation Matters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every two seconds, someone around the world needs blood. Blood cannot be manufactured 
                — it can only come from generous donors like you. A single donation can save up to 
                three lives.
              </p>
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                <p className="text-sm font-medium">
                  Your single act of kindness can make the difference between life and death.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Blood Compatibility Checker */}
          <BloodCompatibilityChecker />

          {/* Contact Admin */}
          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg">Contact Admin</CardTitle>
              <CardDescription className="text-sm">
                Have questions? Send us a message.
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