import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CreateHospitalRequest {
  action: "create" | "update" | "reset_password";
  hospitalId?: string;
  name: string;
  phone?: string | null;
  email: string; // Required for login
  password?: string; // Required for create/reset
  atoll?: string | null;
  island?: string | null;
  address?: string | null;
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
    const { action, hospitalId, name, phone, email, password, atoll, island, address } = body;

    // Validate required fields
    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: "Name and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if ((action === "create" || action === "reset_password") && !password) {
      return new Response(
        JSON.stringify({ error: "Password is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password && password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reset_password" && hospitalId) {
      // Reset password for existing hospital
      const { data: hospital, error: fetchError } = await supabase
        .from("hospitals")
        .select("auth_user_id")
        .eq("id", hospitalId)
        .single();

      if (fetchError || !hospital?.auth_user_id) {
        return new Response(
          JSON.stringify({ error: "Hospital not found or no auth account" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await supabase.auth.admin.updateUserById(
        hospital.auth_user_id,
        { password: password! }
      );

      if (updateError) {
        console.error("Error resetting password:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Password reset successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update" && hospitalId) {
      // Get existing hospital
      const { data: existingHospital, error: fetchError } = await supabase
        .from("hospitals")
        .select("auth_user_id, login_email")
        .eq("id", hospitalId)
        .single();

      if (fetchError) {
        return new Response(
          JSON.stringify({ error: "Hospital not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update hospital record
      const { data: hospital, error } = await supabase
        .from("hospitals")
        .update({
          name,
          phone,
          email,
          atoll,
          island,
          address,
          login_email: email,
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

      // Update auth user email if changed
      if (existingHospital.auth_user_id && existingHospital.login_email !== email) {
        await supabase.auth.admin.updateUserById(
          existingHospital.auth_user_id,
          { email: email }
        );
      }

      // Update password if provided
      if (password && existingHospital.auth_user_id) {
        await supabase.auth.admin.updateUserById(
          existingHospital.auth_user_id,
          { password: password }
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
            login_email: hospital.login_email,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Create new hospital
      
      // First create auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password!,
        email_confirm: true, // Auto-confirm for hospital accounts
        user_metadata: {
          role: 'hospital',
          hospital_name: name,
        }
      });

      if (authError) {
        console.error("Error creating auth user:", authError);
        return new Response(
          JSON.stringify({ error: authError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create hospital record with auth link
      const { data: hospital, error } = await supabase
        .from("hospitals")
        .insert({
          name,
          phone,
          email,
          atoll,
          island,
          address,
          pin_hash: "email_auth", // Placeholder since PIN is no longer used
          login_email: email,
          auth_user_id: authUser.user.id,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating hospital:", error);
        // Clean up auth user if hospital creation fails
        await supabase.auth.admin.deleteUser(authUser.user.id);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update auth user metadata with hospital ID
      await supabase.auth.admin.updateUserById(
        authUser.user.id,
        {
          user_metadata: {
            role: 'hospital',
            hospital_id: hospital.id,
            hospital_name: name,
          }
        }
      );

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
            login_email: hospital.login_email,
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
