import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";

export const CSVImporter = () => {
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);

    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());

      const donors = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(',').map(v => v.trim());
        const donor: any = {};

        headers.forEach((header, index) => {
          const value = values[index] || '';
          
          // Map CSV headers to database columns
          switch (header.toLowerCase()) {
            case 'name':
            case 'full_name':
              donor.full_name = value;
              break;
            case 'phone':
            case 'mobile':
            case 'contact':
              donor.phone = value;
              break;
            case 'blood_group':
            case 'blood group':
            case 'bloodgroup':
              donor.blood_group = value;
              break;
            case 'district':
            case 'location':
              donor.district = value;
              break;
            case 'address':
              donor.address = value;
              break;
            case 'atoll':
              donor.atoll = value;
              break;
            case 'island':
              donor.island = value;
              break;
          }
        });

        if (donor.full_name && donor.phone && donor.blood_group) {
          donors.push({
            ...donor,
            district: donor.district || null,
            is_available: true,
            is_registered: false,
            availability_status: null,
          });
        }
      }

      if (donors.length === 0) {
        toast({
          variant: "destructive",
          title: "No valid donors found",
          description: "Make sure your CSV has: name, phone, blood_group columns",
        });
        return;
      }

      // Insert donors in batches
      const batchSize = 100;
      let imported = 0;

      for (let i = 0; i < donors.length; i += batchSize) {
        const batch = donors.slice(i, i + batchSize);
        const { error } = await supabase
          .from("donor_directory")
          .insert(batch);

        if (error) {
          console.error("Batch import error:", error);
        } else {
          imported += batch.length;
        }
      }

      toast({
        title: "Import successful",
        description: `Imported ${imported} donors from CSV`,
      });

      // Refresh the page to show new donors
      window.location.reload();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import Donors from CSV
        </CardTitle>
        <CardDescription>
          Upload a CSV file with columns: name, phone, blood_group (optional: district, address, atoll, island)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={importing}
        />
        {importing && (
          <p className="text-sm text-muted-foreground mt-2">
            Importing donors...
          </p>
        )}
      </CardContent>
    </Card>
  );
};
