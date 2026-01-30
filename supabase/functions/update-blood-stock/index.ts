import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface UpdateStockRequest {
  hospital_id: string;
  pin: string;
  blood_group: string;
  action: "add" | "remove" | "set";
  units: number;
  expiry_date?: string;
  notes?: string;
  reason?: string;
}

interface DeleteStockRequest {
  hospital_id: string;
  pin: string;
  blood_group: string;
  delete: true;
}

type RequestBody = UpdateStockRequest | DeleteStockRequest;

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "hospital_salt_key");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: RequestBody = await req.json();
    const { hospital_id, pin, blood_group } = body;

    // Validate required fields
    if (!hospital_id || !pin || !blood_group) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify PIN matches hospital
    const { data: hospital, error: hospitalError } = await supabase
      .from("hospitals")
      .select("id, name, pin_hash")
      .eq("id", hospital_id)
      .eq("is_active", true)
      .single();

    if (hospitalError || !hospital) {
      console.error("Hospital not found:", hospitalError);
      return new Response(
        JSON.stringify({ error: "Hospital not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify PIN
    const pinHash = await hashPin(pin);
    if (hospital.pin_hash !== pinHash) {
      console.log("Invalid PIN for hospital update");
      return new Response(
        JSON.stringify({ error: "Invalid PIN" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Authenticated hospital: ${hospital.name}`);

    // Handle delete operation
    if ('delete' in body && body.delete) {
      const { error: deleteError } = await supabase
        .from("blood_stock")
        .delete()
        .eq("hospital_id", hospital_id)
        .eq("blood_group", blood_group);

      if (deleteError) {
        console.error("Error deleting stock:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete stock entry" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log(`Deleted ${blood_group} stock for ${hospital.name}`);
      return new Response(
        JSON.stringify({ success: true, message: "Stock entry deleted" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle update/add operation
    const updateBody = body as UpdateStockRequest;
    const { action, units, expiry_date, notes, reason } = updateBody;

    if (!action || units === undefined || units < 0) {
      return new Response(
        JSON.stringify({ error: "Invalid action or units" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get current stock
    const { data: currentStock } = await supabase
      .from("blood_stock")
      .select("*")
      .eq("hospital_id", hospital_id)
      .eq("blood_group", blood_group)
      .single();

    let newUnits: number;
    const currentUnits = currentStock?.units_available || 0;

    switch (action) {
      case "add":
        newUnits = currentUnits + units;
        break;
      case "remove":
        newUnits = Math.max(0, currentUnits - units);
        break;
      case "set":
        newUnits = units;
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    const stockData = {
      hospital_id,
      blood_group,
      units_available: newUnits,
      expiry_date: expiry_date || null,
      notes: reason || notes || null,
    };

    let result;
    if (currentStock) {
      // Update existing stock
      const { data, error } = await supabase
        .from("blood_stock")
        .update(stockData)
        .eq("id", currentStock.id)
        .select()
        .single();
      
      result = { data, error };
    } else {
      // Insert new stock entry
      const { data, error } = await supabase
        .from("blood_stock")
        .insert(stockData)
        .select()
        .single();
      
      result = { data, error };
    }

    if (result.error) {
      console.error("Error updating stock:", result.error);
      return new Response(
        JSON.stringify({ error: "Failed to update stock" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Updated ${blood_group} stock for ${hospital.name}: ${currentUnits} -> ${newUnits}`);

    // Fetch updated stock list
    const { data: allStock } = await supabase
      .from("blood_stock")
      .select("*")
      .eq("hospital_id", hospital_id)
      .order("blood_group");

    return new Response(
      JSON.stringify({
        success: true,
        stock: result.data,
        allStock: allStock || [],
        message: `Stock updated: ${blood_group} now has ${newUnits} units`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in update-blood-stock:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
