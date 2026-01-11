import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Droplet, MapPin, Phone, User, MessageSquare, Edit, Trash, CheckCircle, Share2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CountdownTimer } from "@/components/CountdownTimer";
import { BloodRequestShareCard } from "@/components/BloodRequestShareCard";

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
  needed_before: string | null;
  poster_name?: string;
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
  highlightId?: string | null;
}

const BloodRequests = ({ status = "active", highlightId }: BloodRequestsProps) => {
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<BloodRequest | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");
  const [shareRequest, setShareRequest] = useState<BloodRequest | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Scroll to highlighted request
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [highlightId, requests]);

  useEffect(() => {
    getCurrentUser();
    fetchRequests();
    checkAndExpireRequests();

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

    // Check for expired requests every minute
    const expiryInterval = setInterval(checkAndExpireRequests, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(expiryInterval);
    };
  }, [status]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user?.id || null);
    
    if (user) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();
      setIsAdmin(!!roleData);
    }
  };

  // Auto-expire check - runs and triggers refresh
  const checkAndExpireRequests = async () => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("blood_requests")
      .update({ status: "expired" })
      .eq("status", "active")
      .lt("needed_before", now)
      .not("needed_before", "is", null)
      .select();

    if (error) {
      console.error("Auto-expire check failed:", error);
    } else if (data && data.length > 0) {
      console.log(`Auto-expired ${data.length} requests`);
      fetchRequests();
    }
  };

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from("blood_requests")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Fetch poster names for requests with requested_by
      const requestsWithPosters = await Promise.all(
        data.map(async (request) => {
          if (request.requested_by) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", request.requested_by)
              .single();
            return { ...request, poster_name: profile?.full_name };
          }
          return request;
        })
      );
      setRequests(requestsWithPosters);
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

    if (error) {
      console.error("Failed to mark as fulfilled:", error);
      toast({
        variant: "destructive",
        title: "Failed to mark as fulfilled",
        description: error.message,
      });
    } else {
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

  const markAsExpired = async (requestId: string) => {
    const { error } = await supabase
      .from("blood_requests")
      .update({ status: "expired" })
      .eq("id", requestId);

    if (error) {
      console.error("Failed to expire request:", error);
      toast({
        variant: "destructive",
        title: "Failed to expire request",
        description: error.message,
      });
    } else {
      toast({
        title: "Request marked as expired",
      });
      fetchRequests();
    }
  };

  const isRequestor = (request: BloodRequest) => {
    return request.requested_by === currentUser;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Group requests by blood group
  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const requestsByBloodGroup = bloodGroups.reduce((acc, group) => {
    acc[group] = requests.filter(r => r.blood_group === group);
    return acc;
  }, {} as Record<string, BloodRequest[]>);

  const renderRequestCard = (request: BloodRequest) => {
    const isHighlighted = highlightId === request.id;
    const canManage = isRequestor(request) || isAdmin;
    
    return (
    <div 
      key={request.id}
      ref={isHighlighted ? highlightRef : null}
      className={`p-4 rounded-xl border transition-all hover:shadow-md ${
        isHighlighted
          ? 'border-primary bg-primary/10 ring-2 ring-primary/50 animate-pulse'
          : request.urgency === 'urgent' 
            ? 'border-destructive/50 bg-destructive/5' 
            : 'border-border bg-muted/30'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{request.patient_name}</h3>
          {/* Countdown Timer */}
          {request.needed_before && status === "active" && (
            <CountdownTimer neededBefore={request.needed_before} compact className="mt-1" />
          )}
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <Badge className="bg-primary/10 text-primary border-0 text-xs px-2 py-0.5">
            <Droplet className="h-3 w-3 mr-1" />
            {request.blood_group}
          </Badge>
          {request.urgency === 'urgent' && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">URGENT</Badge>
          )}
        </div>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{request.hospital_name}</span>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="h-3 w-3 shrink-0" />
          <span>{request.contact_name}</span>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0" />
          <span>{request.contact_phone}</span>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <span className="text-muted-foreground">Units:</span>
          <span className="font-medium text-primary">{request.units_needed}</span>
          {request.emergency_type && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{request.emergency_type}</Badge>
          )}
        </div>

        {request.notes && (
          <p className="text-muted-foreground pt-1 italic line-clamp-2">{request.notes}</p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {/* Share button - available to all */}
          <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => setShareRequest(request)}>
            <Share2 className="h-3 w-3 mr-1" />
            Share
          </Button>
          
          {canManage ? (
            <>
              {isRequestor(request) && (
                <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => viewResponses(request)}>
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Responses
                </Button>
              )}
                  {status === "active" && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg text-green-600 border-green-600/30 hover:bg-green-50" onClick={() => markAsFulfilled(request.id)}>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Done
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg text-orange-600 border-orange-600/30 hover:bg-orange-50" onClick={() => markAsExpired(request.id)}>
                        <XCircle className="h-3 w-3 mr-1" />
                        Expire
                      </Button>
                  <Button size="sm" variant="destructive" className="h-7 text-xs rounded-lg" onClick={() => deleteRequest(request.id)}>
                    <Trash className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </>
              )}
            </>
          ) : status === "active" && (
            <Button size="sm" className="h-7 text-xs rounded-lg" onClick={() => handleRespond(request)}>
              <MessageSquare className="h-3 w-3 mr-1" />
              Respond
            </Button>
          )}
        </div>
        
        {/* Posted by and timestamp - bottom right */}
        <div className="text-[10px] text-muted-foreground text-right ml-auto">
          <div className="flex items-center gap-1 justify-end">
            <span>by {request.poster_name || 'Anonymous'}</span>
          </div>
          <div className="flex items-center gap-1 justify-end">
            <Clock className="h-2.5 w-2.5" />
            <span>{formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</span>
          </div>
        </div>
      </div>
    </div>
    );
  };

  const groupsWithRequests = bloodGroups.filter(group => requestsByBloodGroup[group].length > 0);

  return (
    <>
      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Droplet className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">
            No {status} blood requests at the moment
          </p>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={groupsWithRequests} className="w-full space-y-2">
          {groupsWithRequests.map(group => (
            <AccordionItem key={group} value={group} className="border border-border rounded-xl px-3 bg-background">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/10 text-primary border-0 text-xs">
                    <Droplet className="h-3 w-3 mr-1" />
                    {group}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {requestsByBloodGroup[group].length} {requestsByBloodGroup[group].length === 1 ? 'request' : 'requests'}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pb-2">
                  {requestsByBloodGroup[group].map(renderRequestCard)}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {selectedRequest
                ? isRequestor(selectedRequest)
                  ? "Responses"
                  : "Respond to Request"
                : "Blood Request"}
            </DialogTitle>
          </DialogHeader>
          
          {selectedRequest && isRequestor(selectedRequest) ? (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {responses.map((response) => (
                <div key={response.id} className="p-3 rounded-xl border border-border bg-muted/30">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{response.profiles.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {response.profiles.blood_group} • {response.profiles.phone}
                      </p>
                    </div>
                    <Badge 
                      variant={
                        response.status === "accepted" ? "default" : 
                        response.status === "rejected" ? "destructive" : 
                        "outline"
                      }
                      className="text-xs"
                    >
                      {response.status}
                    </Badge>
                  </div>
                  {response.message && (
                    <p className="text-xs text-muted-foreground mb-3">{response.message}</p>
                  )}
                  {response.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs rounded-lg" onClick={() => updateResponseStatus(response.id, "accepted")}>
                        Accept
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => updateResponseStatus(response.id, "rejected")}>
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {responses.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8">
                  <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No responses yet</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Your Message (Optional)</Label>
                <Textarea
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  placeholder="Add a message for the requestor..."
                  rows={4}
                  className="rounded-xl resize-none"
                />
              </div>
              <Button onClick={submitResponse} className="w-full rounded-xl" disabled={!selectedRequest}>
                Send Response
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Share Card Dialog */}
      {shareRequest && (
        <BloodRequestShareCard
          request={shareRequest}
          open={!!shareRequest}
          onOpenChange={(open) => !open && setShareRequest(null)}
        />
      )}
    </>
  );
};

export default BloodRequests;
