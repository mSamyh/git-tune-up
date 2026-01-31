import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CreateHospitalRequest {
  action: "create" | "update";
  hospitalId?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  atoll?: string | null;
  island?: string | null;
  address?: string | null;
  pin: string;
}

// Hash PIN with same method as verify-hospital-pin for consistency
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

    const body: CreateHospitalRequest = await req.json();
    const { action, hospitalId, name, phone, email, atoll, island, address, pin } = body;

    // Validate required fields
    if (!name || !pin) {
      return new Response(
        JSON.stringify({ error: "Name and PIN are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: "PIN must be exactly 6 digits" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash the PIN
    const pinHash = await hashPin(pin);
    console.log(`Hashing PIN for hospital: ${name}`);

    if (action === "update" && hospitalId) {
      // Update existing hospital
      const { data: hospital, error } = await supabase
        .from("hospitals")
        .update({
          name,
          phone,
          email,
          atoll,
          island,
          address,
          pin_hash: pinHash,
          updated_at: new Date().toISOString(),
        })
        .eq("id", hospitalId)
        .select()
        .single();

      if (error) {
        console.error("Error updating hospital:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Hospital updated: ${hospital.name}`);

      return new Response(
        JSON.stringify({
          success: true,
          hospital: {
            id: hospital.id,
            name: hospital.name,
            atoll: hospital.atoll,
            island: hospital.island,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Create new hospital
      const { data: hospital, error } = await supabase
        .from("hospitals")
        .insert({
          name,
          phone,
          email,
          atoll,
          island,
          address,
          pin_hash: pinHash,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating hospital:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Hospital created: ${hospital.name} (ID: ${hospital.id})`);

      // Initialize blood stock for all 8 blood groups
      const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
      const stockEntries = bloodGroups.map(bloodGroup => ({
        hospital_id: hospital.id,
        blood_group: bloodGroup,
        units_available: 0,
        units_reserved: 0,
        status: 'out_of_stock',
      }));

      const { error: stockError } = await supabase
        .from("blood_stock")
        .insert(stockEntries);

      if (stockError) {
        console.error("Error initializing blood stock:", stockError);
        // Don't fail the entire operation, hospital was created successfully
      } else {
        console.log(`Blood stock initialized for hospital: ${hospital.name}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          hospital: {
            id: hospital.id,
            name: hospital.name,
            atoll: hospital.atoll,
            island: hospital.island,
          },
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error in create-hospital:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
