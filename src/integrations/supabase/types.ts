export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      atolls: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      blood_requests: {
        Row: {
          blood_group: string
          contact_name: string
          contact_phone: string
          created_at: string | null
          emergency_type: string | null
          hospital_name: string
          id: string
          needed_before: string | null
          notes: string | null
          patient_name: string
          requested_by: string | null
          status: string | null
          units_needed: number
          updated_at: string | null
          urgency: string
        }
        Insert: {
          blood_group: string
          contact_name: string
          contact_phone: string
          created_at?: string | null
          emergency_type?: string | null
          hospital_name: string
          id?: string
          needed_before?: string | null
          notes?: string | null
          patient_name: string
          requested_by?: string | null
          status?: string | null
          units_needed: number
          updated_at?: string | null
          urgency: string
        }
        Update: {
          blood_group?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string | null
          emergency_type?: string | null
          hospital_name?: string
          id?: string
          needed_before?: string | null
          notes?: string | null
          patient_name?: string
          requested_by?: string | null
          status?: string | null
          units_needed?: number
          updated_at?: string | null
          urgency?: string
        }
        Relationships: []
      }
      donation_history: {
        Row: {
          blood_request_id: string | null
          created_at: string | null
          donation_date: string
          donor_id: string
          hospital_name: string
          id: string
          notes: string | null
          units_donated: number | null
        }
        Insert: {
          blood_request_id?: string | null
          created_at?: string | null
          donation_date: string
          donor_id: string
          hospital_name: string
          id?: string
          notes?: string | null
          units_donated?: number | null
        }
        Update: {
          blood_request_id?: string | null
          created_at?: string | null
          donation_date?: string
          donor_id?: string
          hospital_name?: string
          id?: string
          notes?: string | null
          units_donated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "donation_history_blood_request_id_fkey"
            columns: ["blood_request_id"]
            isOneToOne: false
            referencedRelation: "blood_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_history_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      donor_directory: {
        Row: {
          address: string | null
          availability_status: string | null
          available_date: string | null
          avatar_url: string | null
          blood_group: string
          created_at: string | null
          district: string | null
          full_name: string
          id: string
          is_available: boolean | null
          is_registered: boolean | null
          last_donation_date: string | null
          linked_profile_id: string | null
          phone: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          availability_status?: string | null
          available_date?: string | null
          avatar_url?: string | null
          blood_group: string
          created_at?: string | null
          district?: string | null
          full_name: string
          id?: string
          is_available?: boolean | null
          is_registered?: boolean | null
          last_donation_date?: string | null
          linked_profile_id?: string | null
          phone: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          availability_status?: string | null
          available_date?: string | null
          avatar_url?: string | null
          blood_group?: string
          created_at?: string | null
          district?: string | null
          full_name?: string
          id?: string
          is_available?: boolean | null
          is_registered?: boolean | null
          last_donation_date?: string | null
          linked_profile_id?: string | null
          phone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donor_directory_linked_profile_id_fkey"
            columns: ["linked_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      donor_directory_history: {
        Row: {
          created_at: string | null
          donation_date: string
          donor_id: string
          hospital_name: string
          id: string
          notes: string | null
          units_donated: number | null
        }
        Insert: {
          created_at?: string | null
          donation_date: string
          donor_id: string
          hospital_name: string
          id?: string
          notes?: string | null
          units_donated?: number | null
        }
        Update: {
          created_at?: string | null
          donation_date?: string
          donor_id?: string
          hospital_name?: string
          id?: string
          notes?: string | null
          units_donated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "donor_directory_history_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "donor_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      donor_points: {
        Row: {
          created_at: string
          donor_id: string
          id: string
          lifetime_points: number
          total_points: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          donor_id: string
          id?: string
          lifetime_points?: number
          total_points?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          donor_id?: string
          id?: string
          lifetime_points?: number
          total_points?: number
          updated_at?: string
        }
        Relationships: []
      }
      islands: {
        Row: {
          atoll_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          atoll_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          atoll_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "islands_atoll_id_fkey"
            columns: ["atoll_id"]
            isOneToOne: false
            referencedRelation: "atolls"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          related_request_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          related_request_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          related_request_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_request_id_fkey"
            columns: ["related_request_id"]
            isOneToOne: false
            referencedRelation: "blood_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_verifications: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          otp: string
          phone: string
          verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          otp: string
          phone: string
          verified?: boolean | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          otp?: string
          phone?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      points_transactions: {
        Row: {
          created_at: string
          description: string
          donor_id: string
          id: string
          points: number
          related_donation_id: string | null
          related_redemption_id: string | null
          transaction_type: string
        }
        Insert: {
          created_at?: string
          description: string
          donor_id: string
          id?: string
          points: number
          related_donation_id?: string | null
          related_redemption_id?: string | null
          transaction_type: string
        }
        Update: {
          created_at?: string
          description?: string
          donor_id?: string
          id?: string
          points?: number
          related_donation_id?: string | null
          related_redemption_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_transactions_related_donation_id_fkey"
            columns: ["related_donation_id"]
            isOneToOne: false
            referencedRelation: "donation_history"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          atoll: string | null
          availability_status: string | null
          available_date: string | null
          avatar_url: string | null
          bio: string | null
          blood_group: string
          created_at: string | null
          district: string | null
          full_name: string
          id: string
          is_available: boolean | null
          island: string | null
          last_donation_date: string | null
          notification_preferences: Json | null
          phone: string
          title: string | null
          title_color: string | null
          updated_at: string | null
          user_type: string | null
        }
        Insert: {
          address?: string | null
          atoll?: string | null
          availability_status?: string | null
          available_date?: string | null
          avatar_url?: string | null
          bio?: string | null
          blood_group: string
          created_at?: string | null
          district?: string | null
          full_name: string
          id: string
          is_available?: boolean | null
          island?: string | null
          last_donation_date?: string | null
          notification_preferences?: Json | null
          phone: string
          title?: string | null
          title_color?: string | null
          updated_at?: string | null
          user_type?: string | null
        }
        Update: {
          address?: string | null
          atoll?: string | null
          availability_status?: string | null
          available_date?: string | null
          avatar_url?: string | null
          bio?: string | null
          blood_group?: string
          created_at?: string | null
          district?: string | null
          full_name?: string
          id?: string
          is_available?: boolean | null
          island?: string | null
          last_donation_date?: string | null
          notification_preferences?: Json | null
          phone?: string
          title?: string | null
          title_color?: string | null
          updated_at?: string | null
          user_type?: string | null
        }
        Relationships: []
      }
      redemption_history: {
        Row: {
          created_at: string
          donor_id: string
          expires_at: string
          id: string
          points_spent: number
          qr_code_data: string
          reward_id: string
          status: string
          verified_at: string | null
          voucher_code: string
        }
        Insert: {
          created_at?: string
          donor_id: string
          expires_at: string
          id?: string
          points_spent: number
          qr_code_data: string
          reward_id: string
          status?: string
          verified_at?: string | null
          voucher_code: string
        }
        Update: {
          created_at?: string
          donor_id?: string
          expires_at?: string
          id?: string
          points_spent?: number
          qr_code_data?: string
          reward_id?: string
          status?: string
          verified_at?: string | null
          voucher_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemption_history_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemption_history_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "reward_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      request_responses: {
        Row: {
          created_at: string | null
          donor_id: string
          id: string
          message: string | null
          request_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          donor_id: string
          id?: string
          message?: string | null
          request_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          donor_id?: string
          id?: string
          message?: string | null
          request_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_responses_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "blood_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_catalog: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          partner_logo_url: string | null
          partner_name: string
          points_required: number
          terms_conditions: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          partner_logo_url?: string | null
          partner_name: string
          points_required: number
          terms_conditions?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          partner_logo_url?: string | null
          partner_name?: string
          points_required?: number
          terms_conditions?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      reward_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          blood_group: string | null
          blood_request_id: string | null
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          failed_at: string | null
          hospital_name: string | null
          id: string
          message_body: string
          recipient_name: string | null
          recipient_phone: string
          sent_at: string | null
          status: string
        }
        Insert: {
          blood_group?: string | null
          blood_request_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          hospital_name?: string | null
          id?: string
          message_body: string
          recipient_name?: string | null
          recipient_phone: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          blood_group?: string | null
          blood_request_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          hospital_name?: string | null
          id?: string
          message_body?: string
          recipient_name?: string | null
          recipient_phone?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_blood_request_id_fkey"
            columns: ["blood_request_id"]
            isOneToOne: false
            referencedRelation: "blood_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          created_at: string
          id: string
          template_body: string
          template_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          template_body: string
          template_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          template_body?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_config: {
        Row: {
          admin_chat_ids: string[]
          bot_token: string
          created_at: string
          id: string
          is_enabled: boolean | null
          updated_at: string
        }
        Insert: {
          admin_chat_ids?: string[]
          bot_token: string
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          updated_at?: string
        }
        Update: {
          admin_chat_ids?: string[]
          bot_token?: string
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      telegram_notification_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          message: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          message: string
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          message?: string
          status?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_directory_donation_count: {
        Args: { donor_uuid: string }
        Returns: number
      }
      get_donation_count: { Args: { donor_uuid: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
