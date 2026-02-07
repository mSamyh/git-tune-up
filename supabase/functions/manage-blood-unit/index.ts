import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ManageBloodUnitRequest {
  action: "add" | "update" | "reserve" | "transfuse" | "discard" | "unreserve" | "delete";
  hospital_id: string;
  unit_id?: string;
  
  // For adding/updating
  blood_group?: string;
  collection_date?: string;
  expiry_date?: string;
  donor_id?: string;
  donor_name?: string;
  bag_number?: string;
  volume_ml?: number;
  batch_number?: string;
  component_type?: string;
  remarks?: string;
  
  // For reserve/transfuse
  patient_name?: string;
  notes?: string;
}

async function logHistory(
  supabase: any,
  unitId: string | null | undefined,
  hospitalId: string,
  bloodGroup: string,
  action: string,
  previousStatus: string | null | undefined,
  newStatus: string | null | undefined,
  patientName?: string | null,
  notes?: string | null,
  userId?: string
) {
  await supabase.from("blood_unit_history").insert({
    blood_unit_id: unitId || null,
    hospital_id: hospitalId,
    blood_group: bloodGroup,
    action,
    previous_status: previousStatus || null,
    new_status: newStatus || null,
    patient_name: patientName || null,
    notes: notes || null,
    performed_by: userId || null,
  });
}

// Sync blood_stock table after unit changes using upsert
async function syncBloodStock(supabase: any, hospitalId: string, bloodGroup: string) {
  try {
    // Count available units for this hospital/blood group
    const { count } = await supabase
      .from("blood_units")
      .select("*", { count: "exact", head: true })
      .eq("hospital_id", hospitalId)
      .eq("blood_group", bloodGroup)
      .eq("status", "available");

    const availableCount = count || 0;

    // Use upsert with the unique constraint (hospital_id, blood_group)
    const { error } = await supabase
      .from("blood_stock")
      .upsert(
        {
          hospital_id: hospitalId,
          blood_group: bloodGroup,
          units_available: availableCount,
          last_updated: new Date().toISOString(),
        },
        { onConflict: "hospital_id,blood_group" }
      );

    if (error) {
      console.error("Error syncing blood_stock:", error);
    } else {
      console.log(`Synced blood_stock: ${hospitalId}/${bloodGroup} = ${availableCount} units`);
    }
  } catch (error) {
    console.error("Error syncing blood_stock:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get authorization header for user context
    const authHeader = req.headers.get("Authorization");
    let userId: string | undefined;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabase.auth.getUser(token);
      userId = data?.user?.id;
    }

    const body: ManageBloodUnitRequest = await req.json();
    const { action, hospital_id, unit_id } = body;

    if (!hospital_id) {
      return new Response(
        JSON.stringify({ error: "Hospital ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify hospital exists
    const { data: hospital, error: hospitalError } = await supabase
      .from("hospitals")
      .select("id, name")
      .eq("id", hospital_id)
      .single();

    if (hospitalError || !hospital) {
      return new Response(
        JSON.stringify({ error: "Hospital not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (action) {
      case "add": {
        const { blood_group, collection_date, expiry_date, donor_id, donor_name, bag_number, volume_ml, batch_number, component_type, remarks } = body;

        if (!blood_group || !collection_date || !expiry_date) {
          return new Response(
            JSON.stringify({ error: "Blood group, collection date, and expiry date are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: unit, error } = await supabase
          .from("blood_units")
          .insert({
            hospital_id,
            blood_group,
            collection_date,
            expiry_date,
            donor_id: donor_id || null,
            donor_name: donor_name || null,
            bag_number: bag_number || null,
            volume_ml: volume_ml || 450,
            batch_number: batch_number || null,
            component_type: component_type || "whole_blood",
            remarks: remarks || null,
            status: "available",
            created_by: userId,
          })
          .select()
          .single();

        if (error) {
          console.error("Error adding blood unit:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await logHistory(supabase, unit.id, hospital_id, blood_group, "created", null, "available", null, remarks, userId);
        await syncBloodStock(supabase, hospital_id, blood_group);

        return new Response(
          JSON.stringify({ success: true, unit }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update": {
        if (!unit_id) {
          return new Response(
            JSON.stringify({ error: "Unit ID is required for update" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const updateData: any = {};
        if (body.blood_group) updateData.blood_group = body.blood_group;
        if (body.collection_date) updateData.collection_date = body.collection_date;
        if (body.expiry_date) updateData.expiry_date = body.expiry_date;
        if (body.donor_id !== undefined) updateData.donor_id = body.donor_id;
        if (body.donor_name !== undefined) updateData.donor_name = body.donor_name;
        if (body.bag_number !== undefined) updateData.bag_number = body.bag_number;
        if (body.volume_ml !== undefined) updateData.volume_ml = body.volume_ml;
        if (body.batch_number !== undefined) updateData.batch_number = body.batch_number;
        if (body.component_type !== undefined) updateData.component_type = body.component_type;
        if (body.remarks !== undefined) updateData.remarks = body.remarks;

        const { data: unit, error } = await supabase
          .from("blood_units")
          .update(updateData)
          .eq("id", unit_id)
          .eq("hospital_id", hospital_id)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await logHistory(supabase, unit_id, hospital_id, unit.blood_group, "updated", null, null, null, "Unit details updated", userId);

        return new Response(
          JSON.stringify({ success: true, unit }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "reserve": {
        if (!unit_id) {
          return new Response(
            JSON.stringify({ error: "Unit ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: existingUnit } = await supabase
          .from("blood_units")
          .select("status, blood_group")
          .eq("id", unit_id)
          .single();

        const { data: unit, error } = await supabase
          .from("blood_units")
          .update({
            status: "reserved",
            reserved_for: body.patient_name || null,
            reserved_at: new Date().toISOString(),
          })
          .eq("id", unit_id)
          .eq("hospital_id", hospital_id)
          .eq("status", "available")
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: "Unit not available for reservation" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await logHistory(supabase, unit_id, hospital_id, unit.blood_group, "reserved", existingUnit?.status, "reserved", body.patient_name, body.notes, userId);
        await syncBloodStock(supabase, hospital_id, unit.blood_group);

        return new Response(
          JSON.stringify({ success: true, unit }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "unreserve": {
        if (!unit_id) {
          return new Response(
            JSON.stringify({ error: "Unit ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: existingUnit } = await supabase
          .from("blood_units")
          .select("status, blood_group")
          .eq("id", unit_id)
          .single();

        const { data: unit, error } = await supabase
          .from("blood_units")
          .update({
            status: "available",
            reserved_for: null,
            reserved_at: null,
          })
          .eq("id", unit_id)
          .eq("hospital_id", hospital_id)
          .eq("status", "reserved")
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: "Unit is not reserved" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await logHistory(supabase, unit_id, hospital_id, unit.blood_group, "unreserved", existingUnit?.status, "available", null, body.notes, userId);
        await syncBloodStock(supabase, hospital_id, unit.blood_group);

        return new Response(
          JSON.stringify({ success: true, unit }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "transfuse": {
        if (!unit_id) {
          return new Response(
            JSON.stringify({ error: "Unit ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: existingUnit } = await supabase
          .from("blood_units")
          .select("status, blood_group")
          .eq("id", unit_id)
          .single();

        const { data: unit, error } = await supabase
          .from("blood_units")
          .update({
            status: "transfused",
            used_at: new Date().toISOString(),
          })
          .eq("id", unit_id)
          .eq("hospital_id", hospital_id)
          .in("status", ["available", "reserved"])
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: "Unit cannot be transfused" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await logHistory(supabase, unit_id, hospital_id, unit.blood_group, "transfused", existingUnit?.status, "transfused", body.patient_name || unit.reserved_for, body.notes, userId);
        await syncBloodStock(supabase, hospital_id, unit.blood_group);

        return new Response(
          JSON.stringify({ success: true, unit }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "discard": {
        if (!unit_id) {
          return new Response(
            JSON.stringify({ error: "Unit ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: existingUnit } = await supabase
          .from("blood_units")
          .select("status, blood_group")
          .eq("id", unit_id)
          .single();

        const { data: unit, error } = await supabase
          .from("blood_units")
          .update({
            status: "discarded",
            used_at: new Date().toISOString(),
          })
          .eq("id", unit_id)
          .eq("hospital_id", hospital_id)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await logHistory(supabase, unit_id, hospital_id, unit.blood_group, "discarded", existingUnit?.status, "discarded", null, body.notes || body.remarks, userId);
        await syncBloodStock(supabase, hospital_id, unit.blood_group);

        return new Response(
          JSON.stringify({ success: true, unit }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        if (!unit_id) {
          return new Response(
            JSON.stringify({ error: "Unit ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: existingUnit } = await supabase
          .from("blood_units")
          .select("blood_group, status")
          .eq("id", unit_id)
          .single();

        const { error } = await supabase
          .from("blood_units")
          .delete()
          .eq("id", unit_id)
          .eq("hospital_id", hospital_id);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (existingUnit) {
          await logHistory(supabase, null, hospital_id, existingUnit.blood_group, "deleted", existingUnit.status, null, null, body.notes, userId);
          await syncBloodStock(supabase, hospital_id, existingUnit.blood_group);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Error in manage-blood-unit:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
