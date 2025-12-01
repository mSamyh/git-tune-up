import { supabase } from "@/integrations/supabase/client";

interface NotificationOptions {
  eventType: string;
  message: string;
  details?: Record<string, any>;
}

export const sendTelegramNotification = async (options: NotificationOptions) => {
  try {
    const { error } = await supabase.functions.invoke("send-telegram-notification", {
      body: options
    });

    if (error) {
      console.error("Failed to send Telegram notification:", error);
    }
  } catch (error) {
    console.error("Error sending Telegram notification:", error);
  }
};

// Specific notification helpers
export const notifyNewUserRegistration = async (user: {
  full_name: string;
  phone: string;
  blood_group: string;
  district?: string;
}) => {
  await sendTelegramNotification({
    eventType: "🆕 New User Registration",
    message: `A new donor has registered on the platform!`,
    details: {
      "Name": user.full_name,
      "Blood Group": user.blood_group,
      "Phone": user.phone,
      "District": user.district || "Not specified"
    }
  });
};

export const notifyNewBloodRequest = async (request: {
  patient_name: string;
  blood_group: string;
  hospital_name: string;
  units_needed: number;
  urgency: string;
  contact_phone: string;
}) => {
  await sendTelegramNotification({
    eventType: "🩸 New Blood Request",
    message: `Urgent: New blood request received!`,
    details: {
      "Patient": request.patient_name,
      "Blood Group": request.blood_group,
      "Hospital": request.hospital_name,
      "Units Needed": request.units_needed.toString(),
      "Urgency": request.urgency,
      "Contact": request.contact_phone
    }
  });
};

export const notifyBloodRequestUpdate = async (request: {
  patient_name: string;
  blood_group: string;
  status: string;
}) => {
  await sendTelegramNotification({
    eventType: "📋 Blood Request Updated",
    message: `Blood request status changed`,
    details: {
      "Patient": request.patient_name,
      "Blood Group": request.blood_group,
      "New Status": request.status
    }
  });
};

export const notifyProfileUpdate = async (profile: {
  full_name: string;
  field_changed: string;
  new_value: string;
}) => {
  await sendTelegramNotification({
    eventType: "👤 Profile Updated",
    message: `A donor profile has been updated`,
    details: {
      "Donor": profile.full_name,
      "Field Changed": profile.field_changed,
      "New Value": profile.new_value
    }
  });
};

export const notifyNewDonation = async (donation: {
  donor_name: string;
  hospital_name: string;
  donation_date: string;
  units_donated?: number;
}) => {
  await sendTelegramNotification({
    eventType: "💉 New Donation Recorded",
    message: `A new blood donation has been recorded!`,
    details: {
      "Donor": donation.donor_name,
      "Hospital": donation.hospital_name,
      "Date": new Date(donation.donation_date).toLocaleDateString(),
      "Units": donation.units_donated?.toString() || "1"
    }
  });
};

export const notifyAdminRoleChange = async (user: {
  full_name: string;
  email?: string;
  action: "added" | "removed";
}) => {
  await sendTelegramNotification({
    eventType: "🔐 Admin Role Changed",
    message: `Admin role ${user.action} for a user`,
    details: {
      "User": user.full_name,
      "Email": user.email || "Not specified",
      "Action": user.action === "added" ? "Granted admin access" : "Revoked admin access"
    }
  });
};