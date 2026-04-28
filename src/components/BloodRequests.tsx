import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Droplet, MapPin, Phone, User, MessageSquare, Edit, Trash, CheckCircle, Share2, XCircle, RotateCcw, ArrowRightLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CountdownTimer } from "@/components/CountdownTimer";
import { BloodRequestShareCard } from "@/components/BloodRequestShareCard";
import { useReferenceData, FALLBACK_BLOOD_GROUPS } from "@/contexts/ReferenceDataContext";
import { MatchStats } from "@/components/MatchStats";
import { auditLog } from "@/lib/auditLog";

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
  notified_donor_count?: number | null;
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
  onStatusChange?: (newStatus: string) => void;
}

const BloodRequests = ({ status = "active", highlightId, onStatusChange }: BloodRequestsProps) => {
  const { bloodGroupCodes } = useReferenceData();
  const bloodGroups = bloodGroupCodes.length > 0 ? bloodGroupCodes : FALLBACK_BLOOD_GROUPS;
  
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<BloodRequest | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");
  const [shareRequest, setShareRequest] = useState<BloodRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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

  // Auto-expire check - now uses database function for server-side expiration
  const checkAndExpireRequests = async () => {
    try {
      const { data, error } = await supabase.rpc('auto_expire_blood_requests');
      
      if (error) {
        console.error("Auto-expire check failed:", error);
        return;
      }
      
      const expiredCount = data as number;
      if (expiredCount > 0) {
        toast({
          title: `${expiredCount} request${expiredCount > 1 ? 's' : ''} expired`,
          description: "Moved to Expired tab",
        });
        await fetchRequests();
        // If we're on active tab and requests expired, notify parent
        if (status === "active") {
          onStatusChange?.("expired");
        }
      }
    } catch (err) {
      console.error("Auto-expire RPC error:", err);
    }
  };

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("blood_requests")
        .select("*")
        .eq("status", status)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data) {
        setRequests([]);
        return;
      }

      // Collect unique requested_by IDs and batch fetch profiles
      const uniqueRequestedByIds = [...new Set(data.filter(r => r.requested_by).map(r => r.requested_by as string))];
      
      let profilesMap = new Map<string, string>();
      if (uniqueRequestedByIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", uniqueRequestedByIds);
        
        if (profiles) {
          profilesMap = new Map(profiles.map(p => [p.id, p.full_name]));
        }
      }

      // Map poster names using the batch-fetched data
      const requestsWithPosters = data.map(request => ({
        ...request,
        poster_name: request.requested_by ? profilesMap.get(request.requested_by) : undefined
      }));

      setRequests(requestsWithPosters);
    } catch (error) {
      console.error("Error fetching blood requests:", error);
    } finally {
      setLoading(false);
    }
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
    if (actionLoading) return;
    setActionLoading(requestId);
    
    const request = requests.find(r => r.id === requestId);
    
    // Soft-delete: set deleted_at instead of hard delete (preserves analytics)
    const { error } = await supabase
      .from("blood_requests")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", requestId);

    if (error) {
      console.error("Failed to delete request:", error);
      toast({
        variant: "destructive",
        title: "Failed to delete request",
        description: error.message,
      });
    } else {
      // Audit log (admin actions only)
      if (isAdmin && request) {
        await auditLog({
          action: "request_delete",
          entityType: "blood_request",
          entityId: requestId,
          before: request as unknown as Record<string, unknown>,
        });
      }

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
    setActionLoading(null);
  };

  const markAsFulfilled = async (requestId: string) => {
    if (actionLoading) return;
    setActionLoading(requestId);
    
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
        title: "Request fulfilled",
        description: "Moved to Fulfilled tab",
      });
      await fetchRequests();
      onStatusChange?.("fulfilled");
    }
    setActionLoading(null);
  };

  const markAsExpired = async (requestId: string) => {
    if (actionLoading) return;
    setActionLoading(requestId);
    
    const { data, error } = await supabase
      .from("blood_requests")
      .update({ status: "expired" })
      .eq("id", requestId)
      .select();

    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to expire request",
        description: error.message,
      });
    } else if (!data || data.length === 0) {
      toast({
        variant: "destructive",
        title: "Failed to expire request",
        description: "Unable to update request. You may not have permission.",
      });
    } else {
      toast({
        title: "Request expired",
        description: "Moved to Expired tab",
      });
      await fetchRequests();
      onStatusChange?.("expired");
    }
    setActionLoading(null);
  };

  // Admin: change status to any value
  const changeRequestStatus = async (requestId: string, newStatus: string) => {
    if (actionLoading) return;
    setActionLoading(requestId);

    const previousRequest = requests.find(r => r.id === requestId);

    const { data, error } = await supabase
      .from("blood_requests")
      .update({ status: newStatus })
      .eq("id", requestId)
      .select();

    if (error || !data?.length) {
      toast({
        variant: "destructive",
        title: "Failed to update status",
        description: error?.message || "You may not have permission.",
      });
    } else {
      // Audit log
      if (isAdmin && previousRequest) {
        await auditLog({
          action: "request_status_change",
          entityType: "blood_request",
          entityId: requestId,
          before: { status: previousRequest.status },
          after: { status: newStatus },
        });
      }

      const labels: Record<string, string> = { active: "Active", fulfilled: "Fulfilled", expired: "Expired" };
      toast({
        title: `Request moved to ${labels[newStatus] || newStatus}`,
      });
      await fetchRequests();
      onStatusChange?.(newStatus);
    }
    setActionLoading(null);
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

  // Group requests by blood group (using context data)
  const requestsByBloodGroup = bloodGroups.reduce((acc, group) => {
    acc[group] = requests.filter(r => r.blood_group === group);
    return acc;
  }, {} as Record<string, BloodRequest[]>);

  const renderRequestCard = (request: BloodRequest) => {
    const isHighlighted = highlightId === request.id;
    const canManage = isRequestor(request) || isAdmin;
    const isUrgent = request.urgency === 'urgent' || request.urgency === 'Emergency';

    return (
    <div
      key={request.id}
      ref={isHighlighted ? highlightRef : null}
      className={cn(
        "relative rounded-2xl overflow-hidden border bg-card shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5",
        isHighlighted && "ring-2 ring-primary/40 border-primary/40",
        isUrgent && status === 'active' && !isHighlighted && "border-destructive/40 urgency-pulse",
        !isUrgent && !isHighlighted && "border-border/60"
      )}
    >
      {/* Top accent strip */}
      <div className={cn(
        "h-1 w-full",
        isUrgent && status === 'active' ? "bg-gradient-to-r from-destructive via-rose-500 to-amber-500" :
        status === 'fulfilled' ? "bg-gradient-to-r from-emerald-500 to-teal-500" :
        status === 'expired' ? "bg-muted-foreground/30" :
        "bg-gradient-to-r from-primary via-rose-500 to-primary"
      )} />

      <div className="p-4">
        {/* ===== HEADER: Patient + Blood Type Hero ===== */}
        <div className="flex items-start gap-3 mb-3">
          {/* Big blood drop badge */}
          <div className="relative shrink-0">
            <div className={cn(
              "h-14 w-14 rounded-2xl flex flex-col items-center justify-center shadow-md",
              isUrgent && status === 'active'
                ? "bg-gradient-to-br from-destructive to-rose-700 text-white"
                : "bg-gradient-to-br from-primary to-rose-600 text-white"
            )}>
              <Droplet className="h-3.5 w-3.5 fill-white/40 mb-0.5" />
              <span className="text-sm font-black tabular-nums leading-none">{request.blood_group}</span>
            </div>
            {isUrgent && status === 'active' && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-400 border-2 border-background flex items-center justify-center shadow animate-pulse">
                <span className="text-[8px] font-black text-rose-950">!</span>
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">
                  Patient
                </p>
                <h3 className="font-black text-base text-foreground truncate leading-tight">
                  {request.patient_name}
                </h3>
              </div>
              {isUrgent && status === 'active' && (
                <Badge variant="destructive" className="text-[9px] px-2 py-0.5 font-black uppercase tracking-wider shrink-0 animate-pulse">
                  Urgent
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {request.units_needed} unit{request.units_needed !== 1 ? 's' : ''}
              </span>
              {request.emergency_type && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5 font-semibold">
                  {request.emergency_type}
                </Badge>
              )}
            </div>

            {request.needed_before && status === "active" && (
              <CountdownTimer neededBefore={request.needed_before} compact className="mt-2" />
            )}
            {status === "active" && (
              <MatchStats requestId={request.id} notifiedCount={request.notified_donor_count} />
            )}
          </div>
        </div>

        {/* ===== INFO ROWS ===== */}
        <div className="grid grid-cols-1 gap-1.5 mb-3 p-3 rounded-xl bg-muted/40 border border-border/40">
          <button
            className="flex items-center gap-2 text-xs text-foreground hover:text-primary transition-colors w-full text-left group"
            onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(request.hospital_name)}`, '_blank')}
          >
            <div className="h-6 w-6 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0">
              <MapPin className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="truncate font-semibold group-hover:underline">{request.hospital_name}</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-6 w-6 rounded-md bg-blue-500/15 flex items-center justify-center shrink-0">
              <User className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="truncate font-medium">{request.contact_name}</span>
          </div>

          <a
            href={`tel:${request.contact_phone}`}
            className="flex items-center gap-2 text-xs text-primary hover:underline"
          >
            <div className="h-6 w-6 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
              <Phone className="h-3 w-3 text-primary" />
            </div>
            <span className="font-bold tabular-nums">{request.contact_phone}</span>
          </a>
        </div>

        {request.notes && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-amber-500/[0.06] border-l-2 border-amber-500/40">
            <p className="text-[11px] text-foreground/80 italic line-clamp-2 leading-relaxed">
              "{request.notes}"
            </p>
          </div>
        )}

        {/* ===== ACTIONS ===== */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
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
                    <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" onClick={() => markAsFulfilled(request.id)} disabled={actionLoading === request.id}>
                      {actionLoading === request.id ? <div className="h-3 w-3 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                      Done
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg text-amber-600 border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-500/10" onClick={() => markAsExpired(request.id)} disabled={actionLoading === request.id}>
                      {actionLoading === request.id ? <div className="h-3 w-3 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                      Expire
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 text-xs rounded-lg" onClick={() => deleteRequest(request.id)} disabled={actionLoading === request.id}>
                      {actionLoading === request.id ? <div className="h-3 w-3 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Trash className="h-3 w-3 mr-1" />}
                      Delete
                    </Button>
                  </>
                )}

                {status === "fulfilled" && isAdmin && (
                  <>
                    <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg text-blue-600 border-blue-500/30" onClick={() => changeRequestStatus(request.id, "active")} disabled={actionLoading === request.id}>
                      <RotateCcw className="h-3 w-3 mr-1" />Reactivate
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg text-amber-600 border-amber-500/30" onClick={() => changeRequestStatus(request.id, "expired")} disabled={actionLoading === request.id}>
                      <XCircle className="h-3 w-3 mr-1" />Expire
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 text-xs rounded-lg" onClick={() => deleteRequest(request.id)}>
                      <Trash className="h-3 w-3 mr-1" />Delete
                    </Button>
                  </>
                )}

                {status === "expired" && isAdmin && (
                  <>
                    <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg text-blue-600 border-blue-500/30" onClick={() => changeRequestStatus(request.id, "active")} disabled={actionLoading === request.id}>
                      <RotateCcw className="h-3 w-3 mr-1" />Reactivate
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg text-emerald-600 border-emerald-500/30" onClick={() => changeRequestStatus(request.id, "fulfilled")} disabled={actionLoading === request.id}>
                      <CheckCircle className="h-3 w-3 mr-1" />Fulfill
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 text-xs rounded-lg" onClick={() => deleteRequest(request.id)}>
                      <Trash className="h-3 w-3 mr-1" />Delete
                    </Button>
                  </>
                )}
              </>
            ) : status === "active" && (
              <Button size="sm" className="h-7 text-xs rounded-lg bg-gradient-to-r from-primary to-rose-600 shadow-md" onClick={() => handleRespond(request)}>
                <Heart className="h-3 w-3 mr-1 fill-white" />
                Respond
              </Button>
            )}
          </div>

          <div className="text-[10px] text-muted-foreground text-right ml-auto leading-tight">
            <div className="font-semibold">by {request.poster_name || 'Anonymous'}</div>
            <div className="flex items-center gap-1 justify-end opacity-70">
              <Clock className="h-2.5 w-2.5" />
              <span>{formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</span>
            </div>
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
