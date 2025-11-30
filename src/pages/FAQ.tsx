import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Droplet, Search, Heart } from "lucide-react";

const FAQ = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const faqCategories = [
    {
      category: "Getting Started",
      icon: Heart,
      questions: [
        {
          q: "What is LeyHadhiya?",
          a: "LeyHadhiya is a blood donation platform designed to connect blood donors with those in urgent need across the Maldives. Our mission is to save lives by making it easier to find compatible blood donors quickly and efficiently."
        },
        {
          q: "How do I register as a donor?",
          a: "Click 'Register' on the home page, enter your phone number to receive an OTP code, verify the code, and complete your profile with your blood group, location (atoll and island), and other details. Once registered, you'll be visible in our donor directory."
        },
        {
          q: "Is the service free?",
          a: "Yes! LeyHadhiya is completely free for both donors and those requesting blood. Our goal is to save lives, not make profits."
        },
        {
          q: "Which areas does LeyHadhiya serve?",
          a: "We currently serve all atolls and islands in the Maldives. You can select your specific atoll and island during registration to help us match you with nearby requests."
        }
      ]
    },
    {
      category: "For Blood Donors",
      icon: Droplet,
      questions: [
        {
          q: "What blood groups are needed?",
          a: "All blood groups are needed! A+, A-, B+, B-, AB+, AB-, O+, and O- donors are all valuable. O- donors are universal donors, while AB+ recipients can receive from any blood group."
        },
        {
          q: "How often can I donate blood?",
          a: "For your safety, you must wait at least 90 days (3 months) between blood donations. Our system automatically tracks this and will mark you as 'unavailable' for 90 days after you log a donation."
        },
        {
          q: "How do I update my availability status?",
          a: "Go to your Profile, scroll to 'Availability Status', and choose: Available (ready to donate), Unavailable (not able to donate right now), or Reserved (committed to a specific request). You can only set yourself as 'Available' if 90+ days have passed since your last donation."
        },
        {
          q: "What if I recently donated but didn't record it?",
          a: "You can set your last donation date in your Profile. This ensures you won't receive requests during your 90-day recovery period. The system will automatically calculate when you can donate again."
        },
        {
          q: "Can I change my blood group after registration?",
          a: "No, blood group cannot be changed once set for safety reasons. If you made a mistake, please contact an administrator through the platform."
        },
        {
          q: "How will I be notified about blood requests?",
          a: "When someone requests your blood type in your area, you'll receive an SMS notification with patient details, hospital information, and contact details. You can then respond directly through the platform or contact the requester."
        },
        {
          q: "Can I hide my profile from the donor directory?",
          a: "Yes! Change your Profile Type to 'Receiver Only' if you don't want to be visible as a donor. You can switch back to 'Donor Only' or 'Both Donor & Receiver' anytime."
        },
        {
          q: "What information is visible to others?",
          a: "Your name, blood group, location (atoll-island), and availability status are visible in the donor directory. Your phone number is only shared with requesters when you respond to a blood request."
        }
      ]
    },
    {
      category: "Requesting Blood",
      icon: Search,
      questions: [
        {
          q: "How do I request blood for a patient?",
          a: "Click 'Request Blood' from the home page or menu. Fill in the patient's details, blood group needed, hospital information, urgency level, and your contact details. Our system will automatically notify all available matching donors in the area via SMS."
        },
        {
          q: "What happens after I submit a blood request?",
          a: "The system immediately sends SMS notifications to all available donors matching the blood group and location. You can view responses from donors in the 'My Requests' section and contact them directly."
        },
        {
          q: "How do I track responses to my request?",
          a: "Go to the 'Blood Requests' page to see all active requests. Click 'View Responses' on your request to see which donors have offered to help. You can accept or contact donors from there."
        },
        {
          q: "Can I cancel or edit a blood request?",
          a: "Yes! You can delete your request if blood has been found or if it's no longer needed. Click 'Delete Request' on your request card. Once fulfilled, you can also mark the request as 'Fulfilled'."
        },
        {
          q: "What should I include in the request details?",
          a: "Include the patient's name, exact hospital name and address, number of blood units needed, urgency (Critical, Urgent, or Normal), and any special notes. The more details you provide, the better donors can respond."
        },
        {
          q: "How quickly will donors see my request?",
          a: "SMS notifications are sent immediately to all matching available donors. Most donors receive the SMS within seconds of your request submission."
        },
        {
          q: "What if no donors respond?",
          a: "You can try expanding your search by contacting nearby hospitals or blood banks. Admins can also help broadcast urgent requests. Contact information is available in your request details."
        }
      ]
    },
    {
      category: "Profile & Settings",
      icon: Heart,
      questions: [
        {
          q: "How do I update my location?",
          a: "Go to your Profile, find the 'Update Location' section, select your atoll and island from the dropdowns, and click 'Save Location'. This ensures you receive requests from your area."
        },
        {
          q: "Can I upload a profile photo?",
          a: "Yes! Click on the avatar circle in your profile to upload a photo. You can crop and adjust the image before saving. Your photo helps create a more personal connection with requesters."
        },
        {
          q: "How do I view my donation history?",
          a: "Your donation history is displayed at the bottom of your Profile page. It shows the date, hospital, and number of units for each donation. Only administrators can add or remove donation history records."
        },
        {
          q: "What is the difference between 'Donor', 'Receiver', and 'Both'?",
          a: "Donor Only: You appear in the donor directory and can donate. Receiver Only: You're hidden from the directory but can request blood. Both: You can both donate and request blood as needed."
        },
        {
          q: "Can I clear my last donation date?",
          a: "You can only clear your last donation date if you have zero recorded donations in your history. Once you have donation records, you can only update to a newer date (not backdate or clear). This prevents accidental eligibility issues."
        },
        {
          q: "How do I change my phone number?",
          a: "Phone numbers cannot be changed after registration for security reasons. If you need to update your number, please contact an administrator."
        }
      ]
    },
    {
      category: "Safety & Privacy",
      icon: Heart,
      questions: [
        {
          q: "Is my personal information secure?",
          a: "Yes! We use industry-standard encryption and security measures. Your phone number is only visible to requesters when you actively respond to a blood request. All data is stored securely in our cloud database."
        },
        {
          q: "Who can see my donation history?",
          a: "Only you and platform administrators can see your complete donation history. Other users only see your current availability status."
        },
        {
          q: "Can I delete my account?",
          a: "Yes, you can delete your account and all associated data by contacting an administrator. Your donation history will be permanently removed from our system."
        },
        {
          q: "How do I report suspicious activity?",
          a: "If you encounter any suspicious requests or inappropriate behavior, please contact an administrator immediately through the platform."
        }
      ]
    },
    {
      category: "Technical & Troubleshooting",
      icon: Search,
      questions: [
        {
          q: "I didn't receive the OTP code. What should I do?",
          a: "Check that you entered the correct phone number with country code (+960 for Maldives). Wait a few minutes and try again. If problems persist, contact support."
        },
        {
          q: "Why can't I set myself as 'Available'?",
          a: "You must wait 90 days from your last donation date before you can set yourself as available. The system enforces this safety rule automatically. Check your profile for the exact date when you'll be eligible again."
        },
        {
          q: "I can't see any blood requests. Why?",
          a: "Make sure you're logged in and have completed your profile. Requests are filtered by urgency and location. If there are no active requests in your area, the page may be empty."
        },
        {
          q: "How do I respond to a blood request?",
          a: "Click on any active blood request card, then click 'Respond'. Write a message (optional) and submit. The requester will be notified and can contact you directly."
        },
        {
          q: "Can I use LeyHadhiya on my mobile phone?",
          a: "Yes! LeyHadhiya is fully mobile-responsive and works on all smartphones, tablets, and computers. We recommend using the latest version of Chrome, Safari, or Firefox."
        },
        {
          q: "What should I do if I find a bug?",
          a: "Please report any bugs or issues to the administrators. Include details about what you were doing when the issue occurred and, if possible, screenshots."
        }
      ]
    },
    {
      category: "For Administrators",
      icon: Heart,
      questions: [
        {
          q: "How do I access the admin panel?",
          a: "If you have admin privileges, you'll see an 'Admin Panel' button at the bottom of your Profile page. Click it to access donor management, SMS settings, and system configuration."
        },
        {
          q: "Can I import multiple donors at once?",
          a: "Yes! The admin panel includes a CSV import feature. Upload a CSV file with donor information (name, phone, blood group, location) to add multiple donors in bulk."
        },
        {
          q: "How do I manage SMS notifications?",
          a: "Administrators can view SMS logs, track delivery status, and customize the SMS template in the admin panel under 'SMS Settings'. All SMS activity is logged for monitoring."
        },
        {
          q: "Can I add or remove donation history for donors?",
          a: "Yes, only administrators can add, edit, or delete donation history records. This ensures data integrity and prevents unauthorized changes."
        },
        {
          q: "How do I manage locations (atolls and islands)?",
          a: "In the admin panel, go to the 'Locations' tab to add new atolls, add islands to atolls, or remove locations. These appear in dropdowns during registration and profile updates."
        }
      ]
    },
    {
      category: "Blood Donation Facts",
      icon: Droplet,
      questions: [
        {
          q: "Who can donate blood?",
          a: "Generally, healthy individuals aged 18-65, weighing at least 50kg, can donate blood. You should be well-rested, hydrated, and not on certain medications. Always consult medical staff before donating."
        },
        {
          q: "How long does blood donation take?",
          a: "The actual donation takes about 10-15 minutes, but the entire process including registration, health check, donation, and rest takes about 45-60 minutes."
        },
        {
          q: "What should I do before donating blood?",
          a: "Eat a healthy meal, drink plenty of water, avoid fatty foods, get good sleep, and bring a valid ID. Don't donate on an empty stomach."
        },
        {
          q: "What should I do after donating blood?",
          a: "Rest for 10-15 minutes, drink plenty of fluids, avoid heavy lifting or strenuous exercise for 24 hours, and eat iron-rich foods to help your body recover."
        },
        {
          q: "Are there any side effects?",
          a: "Minor side effects like dizziness, fatigue, or bruising at the needle site are normal and temporary. Serious complications are extremely rare. Always follow the medical team's post-donation instructions."
        },
        {
          q: "Why is blood donation important?",
          a: "Blood cannot be manufactured - it can only come from generous donors. Every donation can save up to three lives. Regular donations ensure hospitals always have life-saving blood available for emergencies, surgeries, and patients with chronic conditions."
        }
      ]
    }
  ];

  const allQuestions = faqCategories.flatMap(cat => 
    cat.questions.map(q => ({ ...q, category: cat.category }))
  );

  const filteredCategories = searchQuery
    ? [{
        category: "Search Results",
        icon: Search,
        questions: allQuestions.filter(q => 
          q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
      }]
    : faqCategories;

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Heart className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-3">Frequently Asked Questions</h1>
          <p className="text-muted-foreground text-lg">
            Everything you need to know about LeyHadhiya
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search for answers..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {filteredCategories.map((category, idx) => (
          <Card key={idx} className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <category.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>{category.category}</CardTitle>
                  <CardDescription>{category.questions.length} questions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {category.questions.map((item, qIdx) => (
                  <AccordionItem key={qIdx} value={`item-${idx}-${qIdx}`}>
                    <AccordionTrigger className="text-left">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}

        {searchQuery && filteredCategories[0].questions.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No results found for "{searchQuery}"</p>
              <Button variant="outline" onClick={() => setSearchQuery("")}>
                Clear Search
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="mt-8 bg-primary/5 border-primary/20">
          <CardContent className="py-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Still have questions?</h3>
            <p className="text-muted-foreground mb-4">
              Can't find the answer you're looking for? Contact our support team.
            </p>
            <Button onClick={() => navigate("/")}>
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default FAQ;
