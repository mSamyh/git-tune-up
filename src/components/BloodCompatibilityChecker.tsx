import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Droplet, ArrowRight, ArrowLeft, Heart, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReferenceData, FALLBACK_BLOOD_GROUPS } from "@/contexts/ReferenceDataContext";

const BloodCompatibilityChecker = () => {
  const { bloodGroupCodes, bloodCompatibility, isLoading } = useReferenceData();
  const bloodTypes = bloodGroupCodes.length > 0 ? bloodGroupCodes : FALLBACK_BLOOD_GROUPS;
  
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [mode, setMode] = useState<"donate" | "receive">("donate");
  
  // Use compatibility data from context, with fallback
  const canDonateTo = bloodCompatibility.canDonateTo;
  const canReceiveFrom = bloodCompatibility.canReceiveFrom;
  const bloodTypeInfo = bloodCompatibility.bloodTypeInfo;

  const getCompatibleTypes = () => {
    if (!selectedType) return [];
    if (mode === "donate") {
      return canDonateTo[selectedType] || [];
    }
    return canReceiveFrom[selectedType] || [];
  };

  const compatibleTypes = getCompatibleTypes();
  const info = selectedType ? bloodTypeInfo[selectedType] : null;

  return (
    <Card className="bg-gradient-to-br from-card to-muted/30 border-border/50 overflow-hidden">
      <CardHeader className="pb-3 space-y-1">
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Heart className="h-4 w-4 text-primary" />
          </div>
          Blood Compatibility
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Select a blood type to see compatibility
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pb-5">
        {/* Blood Type Selection Grid - Compact for Mobile */}
        <div className="grid grid-cols-4 gap-1.5">
          {bloodTypes.map((type) => (
            <Button
              key={type}
              variant={selectedType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType(type)}
              className={cn(
                "h-9 text-xs font-semibold transition-all",
                selectedType === type && "ring-2 ring-primary/30 scale-105"
              )}
            >
              <Droplet className={cn(
                "h-3 w-3 mr-1",
                selectedType === type ? "fill-current" : ""
              )} />
              {type}
            </Button>
          ))}
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2">
          <Button
            variant={mode === "donate" ? "default" : "outline"}
            size="sm"
            className="flex-1 h-9 text-xs"
            onClick={() => setMode("donate")}
          >
            <ArrowRight className="h-3 w-3 mr-1" />
            Can Donate To
          </Button>
          <Button
            variant={mode === "receive" ? "default" : "outline"}
            size="sm"
            className="flex-1 h-9 text-xs"
            onClick={() => setMode("receive")}
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Can Receive From
          </Button>
        </div>

        {/* Results */}
        {selectedType ? (
          <div className="space-y-3">
            {/* Selected Type Info */}
            {info && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-primary text-primary-foreground text-xs px-2">
                    <Droplet className="h-3 w-3 mr-1 fill-current" />
                    {selectedType}
                  </Badge>
                  <span className="text-xs font-medium">{info.title}</span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {info.rarity}
                </p>
              </div>
            )}

            {/* Compatible Types Grid */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                {mode === "donate" 
                  ? `${selectedType} can donate to:` 
                  : `${selectedType} can receive from:`}
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {bloodTypes.map((type) => {
                  const isCompatible = compatibleTypes.includes(type);
                  return (
                    <div
                      key={type}
                      className={cn(
                        "h-9 flex items-center justify-center rounded-lg text-xs font-medium transition-all",
                        isCompatible
                          ? "bg-green-500/15 text-green-600 border border-green-500/30"
                          : "bg-muted/50 text-muted-foreground/50 border border-transparent"
                      )}
                    >
                      <Droplet className={cn(
                        "h-3 w-3 mr-1",
                        isCompatible && "fill-current"
                      )} />
                      {type}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-center text-muted-foreground mt-2">
                {compatibleTypes.length} compatible type{compatibleTypes.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center">
            <Droplet className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">
              Select a blood type above to check compatibility
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BloodCompatibilityChecker;
