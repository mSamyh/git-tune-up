import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerifyPinRequest {
  pin: string;
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

    const { pin }: VerifyPinRequest = await req.json();

    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      console.log("Invalid PIN format received");
      return new Response(
        JSON.stringify({ error: "Invalid PIN format. Must be 6 digits." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Verifying hospital PIN...");

    // Find hospital with matching PIN hash
    const { data: hospitals, error: fetchError } = await supabase
      .from("hospitals")
      .select("*")
      .eq("is_active", true);

    if (fetchError) {
      console.error("Error fetching hospitals:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to verify PIN" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Find the hospital with matching PIN
    let matchedHospital = null;
    for (const hospital of hospitals || []) {
      // Simple comparison - in production you'd use proper hashing
      // For now, we'll hash the input and compare
      const encoder = new TextEncoder();
      const data = encoder.encode(pin + "hospital_salt_key");
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (hospital.pin_hash === hashHex) {
        matchedHospital = hospital;
        break;
      }
    }

    if (!matchedHospital) {
      console.log("No hospital found with matching PIN");
      return new Response(
        JSON.stringify({ error: "Invalid PIN. Please try again." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Hospital authenticated: ${matchedHospital.name}`);

    // Get current blood stock for this hospital
    const { data: bloodStock, error: stockError } = await supabase
      .from("blood_stock")
      .select("*")
      .eq("hospital_id", matchedHospital.id)
      .order("blood_group");

    if (stockError) {
      console.error("Error fetching blood stock:", stockError);
    }

    // Return hospital details (excluding sensitive data) and stock
    return new Response(
      JSON.stringify({
        success: true,
        hospital: {
          id: matchedHospital.id,
          name: matchedHospital.name,
          address: matchedHospital.address,
          atoll: matchedHospital.atoll,
          island: matchedHospital.island,
          phone: matchedHospital.phone,
          email: matchedHospital.email,
          logo_url: matchedHospital.logo_url,
        },
        bloodStock: bloodStock || [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in verify-hospital-pin:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
