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

    console.log(`Starting hospital deletion: ${hospital_id}`);

    // Step 1: Get hospital details including auth_user_id
    const { data: hospital, error: fetchError } = await supabase
      .from("hospitals")
      .select("id, name, auth_user_id")
      .eq("id", hospital_id)
      .single();

    if (fetchError || !hospital) {
      console.error("Hospital not found:", fetchError);
      return new Response(
        JSON.stringify({ error: "Hospital not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found hospital: ${hospital.name} (auth_user_id: ${hospital.auth_user_id || "none"})`);

    // Step 2: Delete associated auth user if exists
    if (hospital.auth_user_id) {
      console.log(`Deleting auth user: ${hospital.auth_user_id}`);
      const { error: authError } = await supabase.auth.admin.deleteUser(hospital.auth_user_id);
      if (authError) {
        // Gracefully handle "user not found" - the auth user may already be deleted
        if (authError.message?.includes("not found") || authError.message?.includes("User not found")) {
          console.log("Auth user already deleted or not found, continuing...");
        } else {
          console.error("Error deleting auth user (continuing anyway):", authError.message);
        }
      } else {
        console.log("Auth user deleted successfully");
      }
    }

    // Step 3: Delete blood_unit_history records
    const { error: unitHistoryError, count: unitHistoryCount } = await supabase
      .from("blood_unit_history")
      .delete()
      .eq("hospital_id", hospital_id);

    if (unitHistoryError) {
      console.error("Error deleting blood_unit_history:", unitHistoryError.message);
    } else {
      console.log(`Deleted blood_unit_history records for hospital`);
    }

    // Step 4: Delete blood_units
    const { error: unitsError } = await supabase
      .from("blood_units")
      .delete()
      .eq("hospital_id", hospital_id);

    if (unitsError) {
      console.error("Error deleting blood_units:", unitsError.message);
    } else {
      console.log("Deleted blood_units records");
    }

    // Step 5: Delete blood_stock_history records
    const { error: stockHistoryError } = await supabase
      .from("blood_stock_history")
      .delete()
      .eq("hospital_id", hospital_id);

    if (stockHistoryError) {
      console.error("Error deleting blood_stock_history:", stockHistoryError.message);
    } else {
      console.log("Deleted blood_stock_history records");
    }

    // Step 6: Delete blood_stock
    const { error: stockError } = await supabase
      .from("blood_stock")
      .delete()
      .eq("hospital_id", hospital_id);

    if (stockError) {
      console.error("Error deleting blood_stock:", stockError.message);
    } else {
      console.log("Deleted blood_stock records");
    }

    // Step 7: Delete the hospital record
    const { error: deleteError } = await supabase
      .from("hospitals")
      .delete()
      .eq("id", hospital_id);

    if (deleteError) {
      console.error("Error deleting hospital:", deleteError.message);
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Hospital "${hospital.name}" deleted successfully with all related data`);

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
