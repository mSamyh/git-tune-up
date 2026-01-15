import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches the points per donation setting from reward_settings
 */
export async function getPointsPerDonation(): Promise<number> {
  const { data } = await supabase
    .from("reward_settings")
    .select("setting_value")
    .eq("setting_key", "points_per_donation")
    .maybeSingle();

  return data ? parseInt(data.setting_value) : 100;
}

/**
 * Awards points to a donor for a blood donation
 * Includes duplicate prevention check
 */
export async function awardDonationPoints(
  donorId: string,
  donationId: string,
  hospitalName: string,
  pointsPerDonation: number
): Promise<boolean> {
  // Check for existing transaction to prevent duplicates
  const { data: existingTransaction } = await supabase
    .from("points_transactions")
    .select("id")
    .eq("related_donation_id", donationId)
    .maybeSingle();

  if (existingTransaction) {
    console.log(`Points already awarded for donation ${donationId}, skipping`);
    return false;
  }

  // Create points transaction
  const { error: txError } = await supabase
    .from("points_transactions")
    .insert({
      donor_id: donorId,
      points: pointsPerDonation,
      transaction_type: "earned",
      description: `Points earned from blood donation at ${hospitalName}`,
      related_donation_id: donationId,
    });

  if (txError) {
    console.error("Failed to create points transaction:", txError);
    return false;
  }

  // Update donor points
  const { data: existingPoints } = await supabase
    .from("donor_points")
    .select("*")
    .eq("donor_id", donorId)
    .maybeSingle();

  if (existingPoints) {
    await supabase
      .from("donor_points")
      .update({
        total_points: existingPoints.total_points + pointsPerDonation,
        lifetime_points: existingPoints.lifetime_points + pointsPerDonation,
        updated_at: new Date().toISOString(),
      })
      .eq("donor_id", donorId);
  } else {
    await supabase
      .from("donor_points")
      .insert({
        donor_id: donorId,
        total_points: pointsPerDonation,
        lifetime_points: pointsPerDonation,
      });
  }

  return true;
}

/**
 * Deducts points from a donor when a donation is deleted
 * Includes duplicate prevention check
 */
export async function deductDonationPoints(
  donorId: string,
  donationId: string,
  hospitalName: string,
  pointsPerDonation: number
): Promise<boolean> {
  // Check for existing deduction to prevent duplicates
  const { data: existingDeduction } = await supabase
    .from("points_transactions")
    .select("id")
    .eq("donor_id", donorId)
    .eq("related_donation_id", donationId)
    .eq("transaction_type", "adjusted")
    .lt("points", 0)
    .maybeSingle();

  if (existingDeduction) {
    console.log("Deduction already exists for donation:", donationId, "- skipping duplicate");
    return false;
  }

  const { data: existingPoints } = await supabase
    .from("donor_points")
    .select("*")
    .eq("donor_id", donorId)
    .maybeSingle();

  if (existingPoints) {
    await supabase
      .from("donor_points")
      .update({
        total_points: Math.max(0, existingPoints.total_points - pointsPerDonation),
        lifetime_points: Math.max(0, existingPoints.lifetime_points - pointsPerDonation),
        updated_at: new Date().toISOString(),
      })
      .eq("donor_id", donorId);

    await supabase
      .from("points_transactions")
      .insert({
        donor_id: donorId,
        points: -pointsPerDonation,
        transaction_type: "adjusted",
        description: `Points deducted for deleted donation at ${hospitalName}`,
        related_donation_id: donationId,
      });

    return true;
  }

  return false;
}

/**
 * Syncs the last_donation_date for a donor based on their donation history
 */
export async function syncLastDonationDate(donorId: string): Promise<void> {
  const { data: mostRecentDonation } = await supabase
    .from("donation_history")
    .select("donation_date")
    .eq("donor_id", donorId)
    .order("donation_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (mostRecentDonation) {
    await supabase
      .from("profiles")
      .update({ last_donation_date: mostRecentDonation.donation_date })
      .eq("id", donorId);
  } else {
    // No donations left, reset status
    await supabase
      .from("profiles")
      .update({ 
        last_donation_date: null,
        availability_status: 'available'
      })
      .eq("id", donorId);
  }
}
