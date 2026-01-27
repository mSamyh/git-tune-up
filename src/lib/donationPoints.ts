import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface PointsResult {
  success: boolean;
  points: number;
  reason?: string;
}

/**
 * Get the points awarded per donation from the reward settings
 * Uses the secure database function
 */
export async function getPointsPerDonation(): Promise<number> {
  const { data, error } = await supabase.rpc('get_points_per_donation');
  
  if (error) {
    logger.error('Error fetching points per donation:', error);
    return 100;
  }
  
  return (data as number) || 100;
}

/**
 * Award points to a donor for a blood donation
 * Uses the secure database function to prevent manipulation
 */
export async function awardDonationPoints(
  donorId: string,
  donationId: string,
  hospitalName: string,
  pointsPerDonation?: number
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('award_donation_points_secure', {
      p_donor_id: donorId,
      p_donation_id: donationId,
      p_hospital_name: hospitalName
    });

    if (error) {
      logger.error('Error awarding points:', error);
      return false;
    }

    const result = data as unknown as PointsResult;
    if (result?.reason === 'already_awarded') {
      logger.log('Points already awarded for donation:', donationId);
      return true;
    }

    logger.log('Points awarded successfully:', result?.points);
    return result?.success ?? false;
  } catch (error) {
    logger.error('Exception awarding points:', error);
    return false;
  }
}

/**
 * Deduct points from a donor when a donation is deleted
 * Uses the secure database function to prevent manipulation
 */
export async function deductDonationPoints(
  donorId: string,
  donationId: string,
  hospitalName: string,
  pointsPerDonation?: number
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('deduct_donation_points_secure', {
      p_donor_id: donorId,
      p_donation_id: donationId,
      p_hospital_name: hospitalName
    });

    if (error) {
      logger.error('Error deducting points:', error);
      return false;
    }

    const result = data as unknown as PointsResult;
    if (result?.reason === 'already_deducted') {
      logger.log('Points already deducted for donation:', donationId);
      return true;
    }

    logger.log('Points deducted successfully:', result?.points);
    return result?.success ?? false;
  } catch (error) {
    logger.error('Exception deducting points:', error);
    return false;
  }
}

/**
 * Sync the last donation date for a donor
 * Uses the secure database function
 */
export async function syncLastDonationDate(donorId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('sync_donor_last_donation', {
      p_donor_id: donorId
    });

    if (error) {
      logger.error('Error syncing last donation date:', error);
    }
  } catch (error) {
    logger.error('Exception syncing last donation date:', error);
  }
}
