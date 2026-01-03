import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Droplet, ArrowRight, ArrowLeft, Heart, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
type BloodType = typeof bloodTypes[number];

// Who can this blood type DONATE to
const canDonateTo: Record<BloodType, BloodType[]> = {
  "O-": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  "O+": ["A+", "B+", "AB+", "O+"],
  "A-": ["A+", "A-", "AB+", "AB-"],
  "A+": ["A+", "AB+"],
  "B-": ["B+", "B-", "AB+", "AB-"],
  "B+": ["B+", "AB+"],
  "AB-": ["AB+", "AB-"],
  "AB+": ["AB+"],
};

// Who can this blood type RECEIVE from
const canReceiveFrom: Record<BloodType, BloodType[]> = {
  "O-": ["O-"],
  "O+": ["O-", "O+"],
  "A-": ["O-", "A-"],
  "A+": ["O-", "O+", "A-", "A+"],
  "B-": ["O-", "B-"],
  "B+": ["O-", "O+", "B-", "B+"],
  "AB-": ["O-", "A-", "B-", "AB-"],
  "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
};

const bloodTypeInfo: Record<BloodType, { title: string; rarity: string }> = {
  "O-": { title: "Universal Donor", rarity: "~7%" },
  "O+": { title: "Most Common", rarity: "~37%" },
  "A-": { title: "Rare Type", rarity: "~6%" },
  "A+": { title: "Common Type", rarity: "~30%" },
  "B-": { title: "Rare Type", rarity: "~2%" },
  "B+": { title: "Fairly Common", rarity: "~8%" },
  "AB-": { title: "Rarest Type", rarity: "~1%" },
  "AB+": { title: "Universal Recipient", rarity: "~4%" },
};

export const BloodCompatibilityChecker = () => {
  const [selectedType, setSelectedType] = useState<BloodType | null>(null);
  const [mode, setMode] = useState<"donate" | "receive">("donate");

  const compatibleTypes = selectedType
    ? mode === "donate"
      ? canDonateTo[selectedType]
      : canReceiveFrom[selectedType]
    : [];

  return (
    <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
      <CardHeader className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent pb-3 px-3 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Heart className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Blood Compatibility
        </CardTitle>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Tap a blood type to check compatibility
        </p>
      </CardHeader>

      <CardContent className="space-y-4 pt-3 px-3 sm:px-6 sm:space-y-6 sm:pt-4">
        {/* Blood Type Selector - Optimized for mobile */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {bloodTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={cn(
                "relative p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-0.5 sm:gap-1 active:scale-95",
                selectedType === type
                  ? "border-primary bg-primary/10 shadow-md"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <Droplet
                className={cn(
                  "h-4 w-4 sm:h-6 sm:w-6 transition-colors",
                  selectedType === type ? "text-primary fill-primary/20" : "text-muted-foreground"
                )}
              />
              <span className={cn(
                "font-bold text-xs sm:text-sm",
                selectedType === type ? "text-primary" : "text-foreground"
              )}>
                {type}
              </span>
            </button>
          ))}
        </div>

        {/* Mode Toggle - More compact on mobile */}
        {selectedType && (
          <div className="flex gap-1 p-0.5 sm:p-1 bg-muted rounded-lg sm:rounded-xl animate-fade-in">
            <button
              onClick={() => setMode("donate")}
              className={cn(
                "flex-1 py-1.5 sm:py-2 px-2 sm:px-4 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1 sm:gap-2",
                mode === "donate"
                  ? "bg-background shadow-sm text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Can</span> Donate To
            </button>
            <button
              onClick={() => setMode("receive")}
              className={cn(
                "flex-1 py-1.5 sm:py-2 px-2 sm:px-4 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1 sm:gap-2",
                mode === "receive"
                  ? "bg-background shadow-sm text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Can</span> Receive
            </button>
          </div>
        )}

        {/* Selected Type Info - Compact on mobile */}
        {selectedType && (
          <div className="p-3 sm:p-4 bg-primary/5 rounded-lg sm:rounded-xl border border-primary/20 animate-scale-in">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-base sm:text-xl font-bold text-primary">{selectedType}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm sm:text-base truncate">{bloodTypeInfo[selectedType].title}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Population: {bloodTypeInfo[selectedType].rarity}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-primary border-primary text-[10px] sm:text-xs flex-shrink-0">
                {compatibleTypes.length} match
              </Badge>
            </div>
          </div>
        )}

        {/* Compatibility Results - Optimized grid for mobile */}
        {selectedType && (
          <div className="space-y-2 sm:space-y-3 animate-fade-in">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">
              {mode === "donate" 
                ? `${selectedType} can donate to:`
                : `${selectedType} can receive from:`
              }
            </p>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {bloodTypes.map((type) => {
                const isCompatible = compatibleTypes.includes(type);
                return (
                  <div
                    key={type}
                    className={cn(
                      "p-2 sm:p-3 rounded-lg sm:rounded-xl text-center transition-all duration-300 relative",
                      isCompatible
                        ? "bg-green-500/10 border-2 border-green-500/30 text-green-700 dark:text-green-400"
                        : "bg-muted/30 border-2 border-transparent text-muted-foreground/50"
                    )}
                  >
                    {isCompatible && (
                      <div className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" />
                      </div>
                    )}
                    <Droplet
                      className={cn(
                        "h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-0.5 sm:mb-1",
                        isCompatible ? "fill-green-500/20" : ""
                      )}
                    />
                    <span className="text-xs sm:text-sm font-medium">{type}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State - Compact */}
        {!selectedType && (
          <div className="text-center py-6 sm:py-8 text-muted-foreground">
            <Droplet className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-30" />
            <p className="text-xs sm:text-sm">Tap a blood type above to check compatibility</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
