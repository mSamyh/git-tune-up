import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all reference data in parallel
    const [
      bloodGroupsResult,
      bloodCompatibilityResult,
      availabilityStatusesResult,
      urgencyOptionsResult,
      emergencyTypesResult,
      tiersResult
    ] = await Promise.all([
      supabase
        .from('blood_groups')
        .select('*')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('blood_compatibility')
        .select('*'),
      supabase
        .from('availability_statuses')
        .select('*')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('urgency_options')
        .select('*')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('emergency_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order'),
      supabase.rpc('get_all_tiers')
    ]);

    // Check for errors
    if (bloodGroupsResult.error) throw bloodGroupsResult.error;
    if (bloodCompatibilityResult.error) throw bloodCompatibilityResult.error;
    if (availabilityStatusesResult.error) throw availabilityStatusesResult.error;
    if (urgencyOptionsResult.error) throw urgencyOptionsResult.error;
    if (emergencyTypesResult.error) throw emergencyTypesResult.error;

    // Build blood compatibility maps for easy lookup
    const canDonateTo: Record<string, string[]> = {};
    const canReceiveFrom: Record<string, string[]> = {};

    bloodCompatibilityResult.data?.forEach((item: { donor_blood_group: string; recipient_blood_group: string }) => {
      // Build canDonateTo map
      if (!canDonateTo[item.donor_blood_group]) {
        canDonateTo[item.donor_blood_group] = [];
      }
      canDonateTo[item.donor_blood_group].push(item.recipient_blood_group);

      // Build canReceiveFrom map
      if (!canReceiveFrom[item.recipient_blood_group]) {
        canReceiveFrom[item.recipient_blood_group] = [];
      }
      canReceiveFrom[item.recipient_blood_group].push(item.donor_blood_group);
    });

    // Build blood type info map
    const bloodTypeInfo: Record<string, { title: string; rarity: string }> = {};
    bloodGroupsResult.data?.forEach((bg: { code: string; label: string; rarity_percent: number }) => {
      bloodTypeInfo[bg.code] = {
        title: bg.label,
        rarity: `${bg.rarity_percent}% of population`
      };
    });

    const response = {
      blood_groups: bloodGroupsResult.data || [],
      blood_compatibility: {
        raw: bloodCompatibilityResult.data || [],
        canDonateTo,
        canReceiveFrom,
        bloodTypeInfo
      },
      availability_statuses: availabilityStatusesResult.data || [],
      urgency_options: urgencyOptionsResult.data || [],
      emergency_types: emergencyTypesResult.data || [],
      tiers: tiersResult.data || []
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching reference data:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
