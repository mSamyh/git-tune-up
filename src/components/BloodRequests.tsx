import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Droplet, MapPin, Phone, User, MessageSquare, Edit, Trash, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface BloodRequest {
  id: string;
  patient_name: string;
  blood_group: string;
  units_needed: number;
  hospital_name: string;
  contact_name: string;
  contact_phone: string;
  urgency: string;
  emergency_type: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  requested_by: string | null;
}

interface Response {
  id: string;
  donor_id: string;
  status: string;
  message: string;
  created_at: string;
  profiles: {
    full_name: string;
    phone: string;
    blood_group: string;
  };
}

interface BloodRequestsProps {
  status?: string;
}

const BloodRequests = ({ status = "active" }: BloodRequestsProps) => {
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<BloodRequest | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    getCurrentUser();
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
  }, [status]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user?.id || null);
  };

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from("blood_requests")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRequests(data);
    }
    setLoading(false);
  };

  const fetchResponses = async (requestId: string) => {
    const { data } = await supabase
      .from("request_responses")
      .select("*, profiles(full_name, phone, blood_group)")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });

    setResponses(data || []);
  };

  const handleRespond = async (request: BloodRequest) => {
    setSelectedRequest(request);
    setShowResponseDialog(true);
  };

  const submitResponse = async () => {
    if (!selectedRequest || !currentUser) return;

    const { error } = await supabase
      .from("request_responses")
      .insert({
        request_id: selectedRequest.id,
        donor_id: currentUser,
        message: responseMessage,
        status: "pending"
      });

    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to send response",
        description: error.message,
      });
    } else {
      // Create notification for requestor if they exist
      if (selectedRequest.requested_by) {
        await supabase
          .from("notifications")
          .insert({
            user_id: selectedRequest.requested_by,
            type: "response_update",
            title: "New Response to Your Blood Request",
            message: `A donor has responded to your request for ${selectedRequest.blood_group}`,
            related_request_id: selectedRequest.id,
          });
      }

      // Send Telegram notification for donor response
      const { data: donorProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", currentUser)
        .single();

      if (donorProfile) {
        const { notifyDonorResponse } = await import("@/lib/telegramNotifications");
        await notifyDonorResponse({
          donor_name: donorProfile.full_name,
          patient_name: selectedRequest.patient_name,
          blood_group: selectedRequest.blood_group,
          status: "pending",
          message: responseMessage
        });
      }

      toast({
        title: "Response sent",
        description: "The requestor will see your response",
      });
      setShowResponseDialog(false);
      setResponseMessage("");
    }
  };

  const viewResponses = async (request: BloodRequest) => {
    setSelectedRequest(request);
    await fetchResponses(request.id);
    setShowResponseDialog(true);
  };

  const updateResponseStatus = async (responseId: string, status: string) => {
    const { error } = await supabase
      .from("request_responses")
      .update({ status })
      .eq("id", responseId);

    if (!error) {
      toast({
        title: "Response updated",
        description: `Response ${status}`,
      });
      if (selectedRequest) {
        fetchResponses(selectedRequest.id);
      }
    }
  };

  const deleteRequest = async (requestId: string) => {
    const request = requests.find(r => r.id === requestId);
    
    const { error } = await supabase
      .from("blood_requests")
      .delete()
      .eq("id", requestId);

    if (!error) {
      // Send Telegram notification for deletion
      if (request) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user?.id || "")
          .single();

        const { notifyBloodRequestDeleted } = await import("@/lib/telegramNotifications");
        await notifyBloodRequestDeleted({
          patient_name: request.patient_name,
          blood_group: request.blood_group,
          hospital_name: request.hospital_name,
          deleted_by: profile?.full_name || "Unknown"
        });
      }

      toast({
        title: "Request deleted",
      });
      fetchRequests();
    }
  };

  const markAsFulfilled = async (requestId: string) => {
    const request = requests.find(r => r.id === requestId);
    
    const { error } = await supabase
      .from("blood_requests")
      .update({ status: "fulfilled" })
      .eq("id", requestId);

    if (!error) {
      // Send Telegram notification for fulfilled request
      if (request) {
        const { notifyBloodRequestFulfilled } = await import("@/lib/telegramNotifications");
        await notifyBloodRequestFulfilled({
          patient_name: request.patient_name,
          blood_group: request.blood_group,
          hospital_name: request.hospital_name,
          units_needed: request.units_needed
        });
      }

      toast({
        title: "Request marked as fulfilled",
      });
      fetchRequests();
    }
  };

  const isRequestor = (request: BloodRequest) => {
    return request.requested_by === currentUser;
  };

  if (loading) {
    return <div className="text-center py-8">Loading requests...</div>;
  }

  return (
    <>
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
                  {request.emergency_type && (
                    <Badge variant="outline">{request.emergency_type}</Badge>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">{request.hospital_name}</p>
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

              <div className="mt-4 flex gap-2 flex-wrap">
                {isRequestor(request) ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => viewResponses(request)}>
                      <MessageSquare className="h-4 w-4 mr-1" />
                      View Responses
                    </Button>
                    {status === "active" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => markAsFulfilled(request.id)}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Mark Fulfilled
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteRequest(request.id)}>
                          <Trash className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </>
                    )}
                  </>
                ) : status === "active" && (
                  <Button size="sm" onClick={() => handleRespond(request)}>
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Respond
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {requests.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No {status} blood requests at the moment
          </div>
        )}
      </div>

      <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRequest
                ? isRequestor(selectedRequest)
                  ? "Responses"
                  : "Respond to Request"
                : "Blood Request"}
            </DialogTitle>
          </DialogHeader>
          
          {selectedRequest && isRequestor(selectedRequest) ? (
            <div className="space-y-4">
              {responses.map((response) => (
                <Card key={response.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold">{response.profiles.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {response.profiles.blood_group} • {response.profiles.phone}
                        </p>
                      </div>
                      <Badge variant={
                        response.status === "accepted" ? "default" : 
                        response.status === "rejected" ? "destructive" : 
                        "outline"
                      }>
                        {response.status}
                      </Badge>
                    </div>
                    {response.message && (
                      <p className="text-sm text-muted-foreground mb-3">{response.message}</p>
                    )}
                    {response.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateResponseStatus(response.id, "accepted")}>
                          Accept
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateResponseStatus(response.id, "rejected")}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {responses.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">No responses yet</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Your Message (Optional)</Label>
                <Textarea
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  placeholder="Add a message for the requestor..."
                  rows={4}
                />
              </div>
              <Button onClick={submitResponse} className="w-full" disabled={!selectedRequest}>
                Send Response
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BloodRequests;
