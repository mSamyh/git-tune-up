import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Pencil, Trash2, Search } from "lucide-react";
import { logger } from "@/lib/logger";

interface HospitalName {
  id: string;
  name: string;
  atoll: string | null;
  island: string | null;
  is_active: boolean;
  sort_order: number;
}

const empty = { name: "", atoll: "", island: "", is_active: true, sort_order: 0 };

export const HospitalNamesPanel = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<HospitalName[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; editing: HospitalName | null }>({
    open: false,
    editing: null,
  });
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("hospital_names")
      .select("*")
      .order("sort_order")
      .order("name");
    if (error) {
      logger.error("Failed to load hospital_names", error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm(empty);
    setDialog({ open: true, editing: null });
  };

  const openEdit = (h: HospitalName) => {
    setForm({
      name: h.name,
      atoll: h.atoll || "",
      island: h.island || "",
      is_active: h.is_active,
      sort_order: h.sort_order,
    });
    setDialog({ open: true, editing: h });
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Name required" });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      atoll: form.atoll.trim() || null,
      island: form.island.trim() || null,
      is_active: form.is_active,
      sort_order: form.sort_order,
    };
    const res = dialog.editing
      ? await supabase.from("hospital_names").update(payload).eq("id", dialog.editing.id)
      : await supabase.from("hospital_names").insert(payload);
    setSaving(false);
    if (res.error) {
      toast({ variant: "destructive", title: "Error", description: res.error.message });
      return;
    }
    toast({ title: dialog.editing ? "Updated" : "Added", description: payload.name });
    setDialog({ open: false, editing: null });
    load();
  };

  const remove = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("hospital_names").delete().eq("id", deleteId);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Removed" });
      load();
    }
    setDeleteId(null);
  };

  const filtered = items.filter((h) =>
    [h.name, h.atoll, h.island].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Hospital List
          </h3>
          <p className="text-xs text-muted-foreground">
            Names shown in the dropdown when posting blood requests or adding donations.
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="h-10 rounded-xl">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search hospitals..."
          className="pl-9 h-11 rounded-xl"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hospitals found. Add one to populate the dropdown.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((h) => (
            <Card key={h.id} className={!h.is_active ? "opacity-60" : ""}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{h.name}</p>
                  {(h.atoll || h.island) && (
                    <p className="text-xs text-muted-foreground truncate">
                      {[h.atoll, h.island].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                {!h.is_active && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Hidden
                  </span>
                )}
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(h)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(h.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialog.open} onOpenChange={(o) => !o && setDialog({ open: false, editing: null })}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog.editing ? "Edit hospital" : "Add hospital"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. IGMH"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Atoll</Label>
                <Input
                  value={form.atoll}
                  onChange={(e) => setForm({ ...form, atoll: e.target.value })}
                  className="h-11 rounded-xl"
                />
              </div>
              <div>
                <Label>Island</Label>
                <Input
                  value={form.island}
                  onChange={(e) => setForm({ ...form, island: e.target.value })}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
            <div>
              <Label>Sort order</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium">Visible in dropdown</p>
                <p className="text-xs text-muted-foreground">Turn off to hide without deleting</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog({ open: false, editing: null })}
              className="h-12 rounded-xl"
            >
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} className="h-12 rounded-xl btn-press">
              {saving ? "Saving..." : dialog.editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove hospital?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from the dropdown list. Existing donation/request records keep the typed name.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
