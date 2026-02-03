import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { hospital_id } = await req.json();

    if (!hospital_id) {
      return new Response(
        JSON.stringify({ error: "Hospital ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Deleting hospital: ${hospital_id}`);

    // Get hospital details including auth_user_id
    const { data: hospital, error: fetchError } = await supabase
      .from("hospitals")
      .select("id, name, auth_user_id")
      .eq("id", hospital_id)
      .single();

    if (fetchError || !hospital) {
      return new Response(
        JSON.stringify({ error: "Hospital not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete associated auth user if exists
    if (hospital.auth_user_id) {
      console.log(`Deleting auth user: ${hospital.auth_user_id}`);
      const { error: authError } = await supabase.auth.admin.deleteUser(hospital.auth_user_id);
      if (authError) {
        console.error("Error deleting auth user:", authError);
        // Continue with deletion even if auth user deletion fails
      }
    }

    // Delete blood_units for this hospital
    const { error: unitsError } = await supabase
      .from("blood_units")
      .delete()
      .eq("hospital_id", hospital_id);

    if (unitsError) {
      console.error("Error deleting blood units:", unitsError);
    }

    // Delete blood_stock for this hospital
    const { error: stockError } = await supabase
      .from("blood_stock")
      .delete()
      .eq("hospital_id", hospital_id);

    if (stockError) {
      console.error("Error deleting blood stock:", stockError);
    }

    // Delete the hospital record
    const { error: deleteError } = await supabase
      .from("hospitals")
      .delete()
      .eq("id", hospital_id);

    if (deleteError) {
      console.error("Error deleting hospital:", deleteError);
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Hospital ${hospital.name} deleted successfully`);

    return new Response(
      JSON.stringify({ success: true, message: "Hospital deleted successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in delete-hospital:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
