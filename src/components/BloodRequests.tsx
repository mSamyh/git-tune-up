import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Droplet, MapPin, Phone, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface BloodRequest {
  id: string;
  patient_name: string;
  blood_group: string;
  units_needed: number;
  hospital_name: string;
  hospital_address: string;
  contact_name: string;
  contact_phone: string;
  urgency: string;
  notes: string | null;
  status: string;
  created_at: string;
}

const BloodRequests = () => {
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('blood_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blood_requests'
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from("blood_requests")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRequests(data);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center py-8">Loading requests...</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {requests.map((request) => (
        <Card key={request.id} className={`hover:shadow-lg transition-shadow ${request.urgency === 'urgent' ? 'border-destructive' : ''}`}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">{request.patient_name}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Clock className="h-4 w-4" />
                  {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge className="bg-primary text-primary-foreground">
                  <Droplet className="h-3 w-3 mr-1" />
                  {request.blood_group}
                </Badge>
                {request.urgency === 'urgent' && (
                  <Badge variant="destructive">URGENT</Badge>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{request.hospital_name}</p>
                  <p className="text-muted-foreground">{request.hospital_address}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{request.contact_name}</span>
              </div>

              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{request.contact_phone}</span>
              </div>

              <div className="pt-2">
                <span className="font-medium">Units needed: </span>
                <span className="text-primary">{request.units_needed}</span>
              </div>

              {request.notes && (
                <p className="text-muted-foreground pt-2 italic">{request.notes}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {requests.length === 0 && (
        <div className="col-span-full text-center py-12 text-muted-foreground">
          No active blood requests at the moment
        </div>
      )}
    </div>
  );
};

export default BloodRequests;