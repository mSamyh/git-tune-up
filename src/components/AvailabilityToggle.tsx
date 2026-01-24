import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, Clock, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReferenceData } from "@/contexts/ReferenceDataContext";
import { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

interface AvailabilityToggleProps {
  value: string;
  onChange: (status: string, metadata?: { reservedUntil?: string; statusNote?: string }) => void;
  canSetAvailable: boolean;
  daysUntilAvailable?: number;
  reservedUntil?: string | null;
  statusNote?: string | null;
}

// Icon mapping for dynamic icons from database
const iconMap: Record<string, LucideIcon> = {
  Check: Check,
  Ban: Ban,
  Clock: Clock,
};

// Fallback statuses if database data not available
const FALLBACK_STATUSES = [
  {
    code: "available",
    label: "Available",
    icon_name: "Check",
    color: "text-green-600",
    bg_color: "bg-green-50",
  },
  {
    code: "unavailable",
    label: "Unavailable",
    icon_name: "Ban",
    color: "text-red-600",
    bg_color: "bg-red-50",
  },
  {
    code: "reserved",
    label: "Reserved",
    icon_name: "Clock",
    color: "text-orange-600",
    bg_color: "bg-orange-50",
  },
];

// Color mapping for active states
const activeClassMap: Record<string, string> = {
  available: "bg-green-500 hover:bg-green-600 text-white border-green-500",
  unavailable: "bg-red-500 hover:bg-red-600 text-white border-red-500",
  reserved: "bg-orange-500 hover:bg-orange-600 text-white border-orange-500",
};

const pulseClassMap: Record<string, string> = {
  available: "ring-4 ring-green-400/50",
  unavailable: "ring-4 ring-red-400/50",
  reserved: "ring-4 ring-orange-400/50",
};

// Quick suggestion chips for unavailable status
const QUICK_NOTES = [
  "Out of town",
  "Medical leave",
  "Personal",
  "Busy period",
];

// Generate months for selector
const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

// Generate years (current year + next 2)
const getYears = () => {
  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear + 1, currentYear + 2].map(y => ({
    value: y.toString(),
    label: y.toString(),
  }));
};

export const AvailabilityToggle = ({
  value,
  onChange,
  canSetAvailable,
  daysUntilAvailable = 0,
  reservedUntil,
  statusNote,
}: AvailabilityToggleProps) => {
  const { availabilityStatuses } = useReferenceData();
  const [animatingStatus, setAnimatingStatus] = useState<string | null>(null);
  
  // Dialog states
  const [showReservedDialog, setShowReservedDialog] = useState(false);
  const [showUnavailableDialog, setShowUnavailableDialog] = useState(false);
  
  // Reserved dialog state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    if (reservedUntil) {
      return (new Date(reservedUntil).getMonth() + 1).toString().padStart(2, "0");
    }
    return (new Date().getMonth() + 2).toString().padStart(2, "0"); // Default to next month
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    if (reservedUntil) {
      return new Date(reservedUntil).getFullYear().toString();
    }
    return new Date().getFullYear().toString();
  });
  
  // Unavailable dialog state
  const [noteInput, setNoteInput] = useState(statusNote || "");
  const MAX_NOTE_LENGTH = 60;

  // Use database statuses if available, otherwise fallback
  const statuses = availabilityStatuses.length > 0 
    ? availabilityStatuses.map(s => ({
        code: s.code,
        label: s.label,
        icon_name: s.icon_name,
        color: s.color,
        bg_color: s.bg_color,
      }))
    : FALLBACK_STATUSES;

  const handleClick = (status: string) => {
    if (status === value) return;
    
    if (status === "reserved") {
      // Reset to existing or default values
      if (reservedUntil) {
        const date = new Date(reservedUntil);
        setSelectedMonth((date.getMonth() + 1).toString().padStart(2, "0"));
        setSelectedYear(date.getFullYear().toString());
      }
      setShowReservedDialog(true);
      return;
    }
    
    if (status === "unavailable") {
      setNoteInput(statusNote || "");
      setShowUnavailableDialog(true);
      return;
    }
    
    // For "available", just set immediately
    setAnimatingStatus(status);
    onChange(status);
  };
  
  const handleSaveReserved = () => {
    // Calculate last day of selected month
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    const lastDay = new Date(year, month, 0).getDate();
    const reservedUntilDate = `${selectedYear}-${selectedMonth}-${lastDay.toString().padStart(2, "0")}`;
    
    setAnimatingStatus("reserved");
    onChange("reserved", { reservedUntil: reservedUntilDate });
    setShowReservedDialog(false);
  };
  
  const handleSaveUnavailable = () => {
    setAnimatingStatus("unavailable");
    onChange("unavailable", { statusNote: noteInput.trim() || undefined });
    setShowUnavailableDialog(false);
  };
  
  const handleQuickNote = (note: string) => {
    if (noteInput === note) {
      setNoteInput("");
    } else {
      setNoteInput(note);
    }
  };

  useEffect(() => {
    if (animatingStatus) {
      const timer = setTimeout(() => setAnimatingStatus(null), 400);
      return () => clearTimeout(timer);
    }
  }, [animatingStatus]);

  const years = getYears();

  return (
    <>
      <div className="space-y-2">
        <div className="flex gap-2">
          {statuses.map((status) => {
            const Icon = iconMap[status.icon_name] || Check;
            const isActive = value === status.code;
            const isAnimating = animatingStatus === status.code;
            const isDisabled = status.code === "available" && !canSetAvailable;
            
            return (
              <Button
                key={status.code}
                variant="outline"
                size="sm"
                disabled={isDisabled}
                onClick={() => handleClick(status.code)}
                className={cn(
                  "flex-1 gap-1.5 transition-all duration-200",
                  isActive && activeClassMap[status.code],
                  isAnimating && pulseClassMap[status.code],
                  isAnimating && "animate-scale-in",
                  isDisabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <Icon className={cn(
                  "h-4 w-4 transition-transform",
                  isAnimating && "animate-[spin_0.3s_ease-out]"
                )} />
                <span className="hidden sm:inline">{status.label}</span>
              </Button>
            );
          })}
        </div>
        {!canSetAvailable && daysUntilAvailable > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {daysUntilAvailable} days until you can set available
          </p>
        )}
      </div>
      
      {/* Reserved Period Dialog */}
      <Dialog open={showReservedDialog} onOpenChange={setShowReservedDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Set Reservation Period
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Reserved until</Label>
              <div className="flex gap-2">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year.value} value={year.value}>
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              This will be visible to others looking for donors.
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReservedDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveReserved} className="bg-orange-500 hover:bg-orange-600">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Unavailable Note Dialog */}
      <Dialog open={showUnavailableDialog} onOpenChange={setShowUnavailableDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-500" />
              Add a note (optional)
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="relative">
                <Input
                  placeholder="What's happening?"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value.slice(0, MAX_NOTE_LENGTH))}
                  maxLength={MAX_NOTE_LENGTH}
                  className="pr-14"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {noteInput.length}/{MAX_NOTE_LENGTH}
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quick options</Label>
              <div className="flex flex-wrap gap-2">
                {QUICK_NOTES.map((note) => (
                  <Badge
                    key={note}
                    variant={noteInput === note ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      noteInput === note 
                        ? "bg-primary hover:bg-primary/90" 
                        : "hover:bg-muted"
                    )}
                    onClick={() => handleQuickNote(note)}
                  >
                    {note}
                  </Badge>
                ))}
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              This note will be visible to others looking for donors.
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnavailableDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUnavailable} className="bg-red-500 hover:bg-red-600">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
