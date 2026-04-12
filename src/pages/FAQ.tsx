import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Droplet, Search, Heart, HelpCircle, Shield, Settings, Users, Info, BookOpen, X, ChevronRight, Sparkles, Gift, Activity, QrCode, Share2 } from "lucide-react";

const FAQ = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const navigate = useNavigate();
  const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const faqCategories = [
    {
      category: "Getting Started",
      icon: Heart,
      color: "from-rose-500 to-pink-500",
      questions: [
        {
          q: "What is LeyHadhiya?",
          a: "LeyHadhiya is a blood donation platform designed to connect blood donors with those in urgent need across the Maldives. It features a donor directory, blood request system with SMS alerts, rewards program, blood stock tracking, and more — all completely free."
        },
        {
          q: "How do I register as a donor?",
          a: "Click 'Get Started' on the home page, enter your phone number to receive an OTP code, verify the code, and complete your profile with your blood group, location (atoll and island), and other details. Once registered, you'll appear in the donor directory."
        },
        {
          q: "Is the service free?",
          a: "Yes! LeyHadhiya is completely free for donors, recipients, and hospitals. Our mission is to save lives, not make profits."
        },
        {
          q: "Which areas does LeyHadhiya serve?",
          a: "We serve all atolls and islands across the Maldives. Select your specific atoll and island during registration so we can match you with nearby requests."
        }
      ]
    },
    {
      category: "For Blood Donors",
      icon: Droplet,
      color: "from-red-500 to-rose-500",
      questions: [
        {
          q: "What blood groups are needed?",
          a: "All blood groups are needed — A+, A-, B+, B-, AB+, AB-, O+, and O-. O- donors are universal donors, while AB+ recipients can receive from any group."
        },
        {
          q: "How often can I donate blood?",
          a: "You must wait at least 90 days (3 months) between donations. The system automatically tracks this and marks you as unavailable during the recovery period. You'll see a countdown to your next eligible date on your profile."
        },
        {
          q: "How do I update my availability status?",
          a: "Go to your Profile and choose from: Available (ready to donate), Unavailable (not able right now), or Reserved (committed to a specific request). You can only set 'Available' after 90+ days since your last donation."
        },
        {
          q: "What happens during the 90-day waiting period?",
          a: "After donating, you're automatically marked unavailable for 90 days. During this time, you won't receive blood request SMS notifications. The system tracks your recovery and will not send wellness check messages during this period."
        },
        {
          q: "What are wellness check SMS messages?",
          a: "If you've been manually set to 'Unavailable' for more than 7 days (not due to the 90-day post-donation period), you'll receive a friendly SMS checking in on you. Follow-up checks are sent monthly. These are only for donors who set themselves as unavailable — not for the automatic post-donation cooldown."
        },
        {
          q: "How will I be notified about blood requests?",
          a: "When someone requests your blood type in your area, you'll receive an SMS with patient details, hospital information, urgency level, and contact details. You can respond directly through the platform."
        },
        {
          q: "Can I hide my profile from the donor directory?",
          a: "Yes! Change your Profile Type to 'Receiver Only' to be hidden from the directory. Switch back to 'Donor Only' or 'Both Donor & Receiver' anytime."
        },
        {
          q: "What information is visible to others?",
          a: "Your name, blood group, atoll/island, availability status, and donation count are visible in the directory. Your phone number is only shared when you respond to a blood request."
        }
      ]
    },
    {
      category: "Requesting Blood",
      icon: Search,
      color: "from-blue-500 to-cyan-500",
      questions: [
        {
          q: "How do I request blood for a patient?",
          a: "Tap 'Request Blood' from the menu. Fill in the patient's name, blood group, hospital, units needed, urgency level (Critical/Urgent/Normal), and your contact details. The system immediately sends SMS notifications to all matching available donors."
        },
        {
          q: "What happens after I submit a blood request?",
          a: "SMS notifications are sent instantly to matching donors. Your request appears in the Blood Requests page with a live countdown timer showing remaining urgency time. Donors can view and respond to your request."
        },
        {
          q: "Can I share my blood request on social media?",
          a: "Yes! Each blood request has a 'Share' button that generates a beautifully designed Instagram-ready card (1080×1080) with all the request details, a QR code for quick response, and urgency information. Download it and share on Instagram, WhatsApp, or any social platform."
        },
        {
          q: "How do I track responses to my request?",
          a: "Go to the Blood Requests page to see all requests organized into Open, Fulfilled, and Expired tabs. Click 'View Responses' to see which donors have offered to help."
        },
        {
          q: "What do the urgency levels mean?",
          a: "Critical: blood needed within hours (red pulsing indicator). Urgent: needed within 24 hours (orange indicator). Normal: needed within a few days (yellow indicator). Each level has a live countdown timer."
        },
        {
          q: "Can I cancel or update a blood request?",
          a: "Yes! You can delete your request if it's no longer needed, or mark it as 'Fulfilled' once blood has been found. Requests also auto-expire based on their urgency deadline."
        }
      ]
    },
    {
      category: "Rewards & Points",
      icon: Gift,
      color: "from-amber-500 to-yellow-500",
      questions: [
        {
          q: "How does the rewards system work?",
          a: "Every verified blood donation earns you points. Accumulate points to redeem rewards from our partner merchants — including discounts, vouchers, and special offers. It's our way of thanking you for saving lives!"
        },
        {
          q: "How do I earn points?",
          a: "Points are automatically awarded when an administrator records a verified donation in your history. The number of points per donation is set by the system and may include bonuses for milestones."
        },
        {
          q: "What are donor tiers?",
          a: "As you accumulate lifetime points, you advance through tiers (e.g., Bronze, Silver, Gold). Higher tiers may unlock exclusive rewards and recognition. Your current tier and progress are shown on the Rewards page."
        },
        {
          q: "How do I redeem rewards?",
          a: "Go to the Rewards page, browse available rewards from partner merchants, and redeem using your points. You'll receive a voucher with a unique QR code that you present at the partner merchant for verification."
        },
        {
          q: "How do vouchers work?",
          a: "When you redeem a reward, you get a digital voucher with a QR code and unique voucher code. Show it to the merchant who scans or enters the code to verify. Vouchers have an expiry date — use them before they expire!"
        },
        {
          q: "Can I see my points history?",
          a: "Yes! The Rewards page shows your current balance, lifetime points, tier progress, and a complete transaction history of points earned and spent."
        }
      ]
    },
    {
      category: "Blood Stock & Hospitals",
      icon: Activity,
      color: "from-teal-500 to-emerald-500",
      questions: [
        {
          q: "What is the Blood Stock feature?",
          a: "The Blood Stock page shows real-time blood availability across hospitals in the Maldives. You can see which blood groups are available, stock levels, and which hospitals have units ready."
        },
        {
          q: "How accurate is the blood stock data?",
          a: "Blood stock is updated by hospital staff through the Hospital Portal. Data accuracy depends on how frequently hospitals update their inventory. Check the 'Last Updated' timestamp for each entry."
        },
        {
          q: "Can I see blood stock by hospital?",
          a: "Yes! The Blood Stock overview shows stock grouped by hospital with color-coded status indicators — green for adequate stock, yellow for low, and red for critical levels."
        }
      ]
    },
    {
      category: "QR Code & Verification",
      icon: QrCode,
      color: "from-violet-500 to-purple-500",
      questions: [
        {
          q: "What is the Donor QR Card?",
          a: "Every registered donor gets a unique QR card on their profile. This digital card contains your donor ID and can be scanned to quickly verify your identity and donation eligibility at hospitals or blood drives."
        },
        {
          q: "How does QR verification work?",
          a: "When someone scans your QR code, they're taken to a verification page showing your donor details, blood group, availability status, and donation history — helping hospitals quickly confirm your eligibility."
        },
        {
          q: "How are reward vouchers verified?",
          a: "Merchants scan the QR code on your voucher or enter the voucher code manually in the Merchant Portal. The system instantly verifies if the voucher is valid, not expired, and hasn't been used."
        }
      ]
    },
    {
      category: "Blood Compatibility",
      icon: Users,
      color: "from-indigo-500 to-blue-500",
      questions: [
        {
          q: "What is the Blood Compatibility Checker?",
          a: "It's a tool on the home page (Match tab) that shows which blood groups are compatible for donation and receiving. Select a blood group to see who can donate to them and who they can donate to."
        },
        {
          q: "What does 'universal donor' mean?",
          a: "O- is the universal donor — their blood can be given to anyone regardless of blood group. This makes O- donors especially valuable in emergencies when there's no time to test."
        },
        {
          q: "What does 'universal recipient' mean?",
          a: "AB+ is the universal recipient — they can receive blood from any blood group. However, AB+ blood can only be given to other AB+ individuals."
        }
      ]
    },
    {
      category: "Profile & Settings",
      icon: Settings,
      color: "from-slate-500 to-gray-500",
      questions: [
        {
          q: "How do I update my location?",
          a: "Go to your Profile, find the location section, select your atoll and island from the dropdowns, and save. This ensures you receive requests from your area."
        },
        {
          q: "Can I upload a profile photo?",
          a: "Yes! Tap the avatar circle in your profile to upload and crop a photo. Your photo appears in the donor directory and helps build trust with requesters."
        },
        {
          q: "How do I view my donation history?",
          a: "Your donation history is shown on your Profile page with dates, hospitals, and units for each donation. You can also view it organized by year on the History page."
        },
        {
          q: "What are the profile types?",
          a: "Donor Only: visible in the directory, can donate. Receiver Only: hidden from directory, can request blood. Both: full access to donate and request. Choose what fits your needs."
        },
        {
          q: "How do I change my phone number?",
          a: "Phone numbers cannot be changed after registration for security. If you need an update, contact an administrator through the platform."
        },
        {
          q: "What are donor milestones and achievements?",
          a: "As you donate more, you unlock milestones (e.g., First Donation, 5 Donations, 10 Donations) and achievements displayed on your profile. These celebrate your contribution and encourage continued donations."
        }
      ]
    },
    {
      category: "Sharing & Social",
      icon: Share2,
      color: "from-pink-500 to-rose-500",
      questions: [
        {
          q: "How do I share a blood request on Instagram?",
          a: "Open any blood request, tap 'Share', and download the generated card. It's a professionally designed 1080×1080 image with the blood group, patient details, hospital, contact info, urgency countdown, and a QR code — ready to post on Instagram or any social media."
        },
        {
          q: "Can I share my donor profile?",
          a: "Yes! Your donor QR card can be shared or screenshotted. Anyone who scans the QR code can see your verified donor profile and donation history."
        },
        {
          q: "How does sharing help?",
          a: "Sharing blood requests on social media dramatically increases visibility. A single share can reach hundreds of potential donors, especially for rare blood types or urgent situations."
        }
      ]
    },
    {
      category: "Safety & Privacy",
      icon: Shield,
      color: "from-emerald-500 to-green-500",
      questions: [
        {
          q: "Is my personal information secure?",
          a: "Yes! We use industry-standard encryption and security. Your phone number is only visible when you actively respond to a request. All data is stored securely with role-based access controls."
        },
        {
          q: "Who can see my donation history?",
          a: "Only you and platform administrators can see your complete donation history. Other users see only your availability status and total donation count."
        },
        {
          q: "Can I delete my account?",
          a: "Yes, contact an administrator to delete your account and all associated data permanently."
        },
        {
          q: "How do I report suspicious activity?",
          a: "Contact an administrator immediately through the platform if you encounter suspicious requests or inappropriate behavior."
        }
      ]
    },
    {
      category: "Technical Help",
      icon: HelpCircle,
      color: "from-orange-500 to-amber-500",
      questions: [
        {
          q: "I didn't receive the OTP code. What should I do?",
          a: "Check that you entered the correct phone number with the +960 country code. Wait a minute and try resending. If problems persist, contact support."
        },
        {
          q: "Why can't I set myself as 'Available'?",
          a: "You must wait 90 days from your last donation. The system enforces this automatically. Check your profile for the exact date when you'll be eligible again."
        },
        {
          q: "Can I use LeyHadhiya on my phone?",
          a: "Yes! LeyHadhiya is fully mobile-responsive and works on all smartphones, tablets, and computers. We recommend Chrome, Safari, or Firefox."
        },
        {
          q: "Why did I receive a wellness check SMS?",
          a: "If you've been unavailable for more than 7 days (not due to the 90-day post-donation cooldown), the system sends a friendly check-in. It's just to make sure you're okay! Monthly follow-ups are sent if you remain unavailable."
        },
        {
          q: "My voucher isn't working at the merchant. What do I do?",
          a: "Check that the voucher hasn't expired (expiry date is shown on the voucher). Make sure the merchant is scanning the correct QR code or entering the voucher code correctly. If issues persist, contact an administrator."
        }
      ]
    },
    {
      category: "Blood Donation Facts",
      icon: BookOpen,
      color: "from-cyan-500 to-blue-500",
      questions: [
        {
          q: "Who can donate blood?",
          a: "Generally, healthy individuals aged 18-65, weighing at least 50kg. You should be well-rested, hydrated, and not on certain medications. Always consult medical staff before donating."
        },
        {
          q: "How long does blood donation take?",
          a: "The actual donation takes 10-15 minutes. The entire process including registration, health check, donation, and rest takes about 45-60 minutes."
        },
        {
          q: "What should I do before donating?",
          a: "Eat a healthy meal, drink plenty of water, avoid fatty foods, get good sleep, and bring a valid ID. Never donate on an empty stomach."
        },
        {
          q: "What should I do after donating?",
          a: "Rest for 10-15 minutes, drink plenty of fluids, avoid heavy lifting for 24 hours, and eat iron-rich foods to help recovery."
        },
        {
          q: "Why is blood donation important?",
          a: "Blood cannot be manufactured — it can only come from donors. Every donation can save up to three lives. Regular donations ensure hospitals have blood available for emergencies, surgeries, and patients with chronic conditions."
        }
      ]
    }
  ];

  const mostAskedQuestions = [
    { q: "What is LeyHadhiya?", category: "Getting Started" },
    { q: "How often can I donate blood?", category: "For Blood Donors" },
    { q: "How do I request blood for a patient?", category: "Requesting Blood" },
    { q: "How does the rewards system work?", category: "Rewards & Points" },
    { q: "Can I share my blood request on social media?", category: "Requesting Blood" },
  ];

  const allQuestions = faqCategories.flatMap(cat => 
    cat.questions.map(q => ({ ...q, category: cat.category }))
  );

  const totalQuestions = allQuestions.length;
  const totalCategories = faqCategories.length;

  const filteredCategories = searchQuery
    ? [{
        category: "Search Results",
        icon: Search,
        color: "from-primary to-primary/80",
        questions: allQuestions.filter(q => 
          q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
      }]
    : faqCategories;

  const scrollToCategory = (categoryName: string) => {
    setActiveCategory(categoryName);
    const ref = categoryRefs.current[categoryName];
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />

      <main className="container mx-auto px-4 py-6 max-w-2xl animate-fade-in">
        {/* Header */}
        <section className="relative text-center mb-6 overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/4 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute top-4 right-1/4 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl" />
          </div>
          
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 mb-4 shadow-lg">
            <HelpCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold mb-2">Frequently Asked Questions</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Everything you need to know about LeyHadhiya
          </p>
          
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full">
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{totalQuestions} Questions</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{totalCategories} Topics</span>
            </div>
          </div>
        </section>

        {/* Search */}
        <Card className="mb-6 rounded-2xl border-border/50 shadow-soft">
          <CardContent className="pt-5 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search for answers..."
                className="pl-10 pr-10 rounded-xl h-11 bg-secondary/50 border-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Found {filteredCategories[0].questions.length} result{filteredCategories[0].questions.length !== 1 ? 's' : ''}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Category Navigation */}
        {!searchQuery && (
          <div className="mb-6 -mx-4 px-4 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 pb-2">
              {faqCategories.map((cat) => (
                <button
                  key={cat.category}
                  onClick={() => scrollToCategory(cat.category)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    activeCategory === cat.category
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <cat.icon className="h-3.5 w-3.5" />
                  {cat.category}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Most Asked */}
        {!searchQuery && (
          <Card className="mb-6 rounded-2xl border-border/50 shadow-soft bg-gradient-to-br from-primary/5 via-background to-rose-500/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="font-display text-sm">Most Asked</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {mostAskedQuestions.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => scrollToCategory(item.category)}
                  className="w-full flex items-center justify-between p-3 bg-background/80 hover:bg-background rounded-xl transition-colors text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.q}</p>
                    <p className="text-xs text-muted-foreground">{item.category}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 ml-2" />
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* FAQ Categories */}
        {filteredCategories.map((category, idx) => (
          <div 
            key={idx} 
            ref={(el) => { categoryRefs.current[category.category] = el; }}
            className="scroll-mt-4"
          >
            <Card className="mb-4 rounded-2xl border-border/50 shadow-soft hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br ${category.color} shadow-sm`}>
                    <category.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="font-display text-base">{category.category}</CardTitle>
                    <CardDescription className="text-xs">{category.questions.length} questions</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Accordion type="single" collapsible className="w-full">
                  {category.questions.map((item, qIdx) => (
                    <AccordionItem key={qIdx} value={`item-${idx}-${qIdx}`} className="border-border/50">
                      <AccordionTrigger className="text-left text-sm py-3 hover:no-underline hover:text-primary transition-colors">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground pb-4 animate-fade-in">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        ))}

        {searchQuery && filteredCategories[0].questions.length === 0 && (
          <Card className="rounded-2xl border-border/50">
            <CardContent className="py-10 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">No results found</p>
              <p className="text-xs text-muted-foreground mb-3">Try different keywords or browse categories</p>
              <Button variant="secondary" size="sm" onClick={() => setSearchQuery("")} className="rounded-xl">
                Clear Search
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Contact Support */}
        <Card className="mt-6 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/10">
          <CardContent className="py-6">
            <div className="text-center mb-4">
              <h3 className="font-display font-semibold mb-1">Still have questions?</h3>
              <p className="text-sm text-muted-foreground">
                Can't find the answer you're looking for?
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button 
                variant="secondary" 
                onClick={() => navigate("/about")} 
                className="rounded-xl"
              >
                <Info className="h-4 w-4 mr-2" />
                About Us
              </Button>
              <Button onClick={() => navigate("/")} className="rounded-xl">
                <Heart className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default FAQ;
