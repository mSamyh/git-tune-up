import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Droplet, ArrowRight, ArrowLeft, Heart } from "lucide-react";
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
      <CardHeader className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Heart className="h-5 w-5 text-primary" />
          Blood Compatibility Checker
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Select a blood type to see compatibility
        </p>
      </CardHeader>

      <CardContent className="space-y-6 pt-4">
        {/* Blood Type Selector */}
        <div className="grid grid-cols-4 gap-2">
          {bloodTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={cn(
                "relative p-3 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-1",
                selectedType === type
                  ? "border-primary bg-primary/10 scale-105 shadow-md"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <Droplet
                className={cn(
                  "h-6 w-6 transition-colors",
                  selectedType === type ? "text-primary fill-primary/20" : "text-muted-foreground"
                )}
              />
              <span className={cn(
                "font-bold text-sm",
                selectedType === type ? "text-primary" : "text-foreground"
              )}>
                {type}
              </span>
            </button>
          ))}
        </div>

        {/* Mode Toggle */}
        {selectedType && (
          <div className="flex gap-2 p-1 bg-muted rounded-xl animate-fade-in">
            <button
              onClick={() => setMode("donate")}
              className={cn(
                "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                mode === "donate"
                  ? "bg-background shadow-sm text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowRight className="h-4 w-4" />
              Can Donate To
            </button>
            <button
              onClick={() => setMode("receive")}
              className={cn(
                "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                mode === "receive"
                  ? "bg-background shadow-sm text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              Can Receive From
            </button>
          </div>
        )}

        {/* Selected Type Info */}
        {selectedType && (
          <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 animate-scale-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xl font-bold text-primary">{selectedType}</span>
                </div>
                <div>
                  <p className="font-semibold">{bloodTypeInfo[selectedType].title}</p>
                  <p className="text-sm text-muted-foreground">
                    Population: {bloodTypeInfo[selectedType].rarity}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-primary border-primary">
                {compatibleTypes.length} compatible
              </Badge>
            </div>
          </div>
        )}

        {/* Compatibility Results */}
        {selectedType && (
          <div className="space-y-3 animate-fade-in">
            <p className="text-sm font-medium text-muted-foreground">
              {mode === "donate" 
                ? `${selectedType} can donate to:`
                : `${selectedType} can receive from:`
              }
            </p>
            <div className="grid grid-cols-4 gap-2">
              {bloodTypes.map((type) => {
                const isCompatible = compatibleTypes.includes(type);
                return (
                  <div
                    key={type}
                    className={cn(
                      "p-3 rounded-xl text-center transition-all duration-300",
                      isCompatible
                        ? "bg-green-500/10 border-2 border-green-500/30 text-green-700 dark:text-green-400"
                        : "bg-muted/30 border-2 border-transparent text-muted-foreground/50"
                    )}
                  >
                    <Droplet
                      className={cn(
                        "h-5 w-5 mx-auto mb-1",
                        isCompatible ? "fill-green-500/20" : ""
                      )}
                    />
                    <span className="text-sm font-medium">{type}</span>
                    {isCompatible && (
                      <p className="text-[10px] mt-0.5">✓ Compatible</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!selectedType && (
          <div className="text-center py-8 text-muted-foreground">
            <Droplet className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Tap a blood type above to check compatibility</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
