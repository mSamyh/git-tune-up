import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Building2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

interface Hospital {
  id: string;
  name: string;
  atoll: string | null;
  island: string | null;
}

interface HospitalComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Triggering element height; defaults to h-11 to match form fields */
  triggerClassName?: string;
  allowCustom?: boolean;
  /** Called with the full hospital record when a registered hospital is picked (null for custom) */
  onHospitalSelect?: (hospital: Hospital | null) => void;
}

export const HospitalCombobox = ({
  value,
  onChange,
  placeholder = "Select hospital",
  className,
  triggerClassName,
  allowCustom = true,
}: HospitalComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("hospital_names")
        .select("id, name, atoll, island")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name");
      if (mounted && data) setHospitals(data);
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSelect = (name: string) => {
    onChange(name);
    setOpen(false);
    setSearch("");
  };

  const matchesExisting = hospitals.some(
    (h) => h.name.toLowerCase() === search.trim().toLowerCase()
  );

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between h-11 rounded-xl font-normal",
              !value && "text-muted-foreground",
              triggerClassName
            )}
          >
            <span className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 shrink-0 opacity-60" />
              <span className="truncate">{value || placeholder}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 rounded-xl"
          align="start"
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
          <Command shouldFilter={true}>
            <CommandInput
              placeholder="Search hospital..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {loading ? (
                  <span className="text-xs text-muted-foreground">Loading…</span>
                ) : allowCustom && search.trim() ? (
                  <button
                    type="button"
                    onClick={() => handleSelect(search.trim())}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent rounded-md text-left"
                  >
                    <Plus className="h-3.5 w-3.5 text-primary" />
                    Use "<span className="font-semibold">{search.trim()}</span>"
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">No hospitals found</span>
                )}
              </CommandEmpty>
              {hospitals.length > 0 && (
                <CommandGroup heading="Registered hospitals">
                  {hospitals.map((h) => (
                    <CommandItem
                      key={h.id}
                      value={h.name}
                      onSelect={() => handleSelect(h.name)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === h.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{h.name}</p>
                        {(h.atoll || h.island) && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {[h.atoll, h.island].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {allowCustom &&
                search.trim() &&
                !matchesExisting &&
                !loading && (
                  <CommandGroup heading="Custom">
                    <CommandItem
                      value={`__custom__${search}`}
                      onSelect={() => handleSelect(search.trim())}
                      className="cursor-pointer"
                    >
                      <Plus className="mr-2 h-4 w-4 text-primary" />
                      Use "<span className="font-semibold">{search.trim()}</span>"
                    </CommandItem>
                  </CommandGroup>
                )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
