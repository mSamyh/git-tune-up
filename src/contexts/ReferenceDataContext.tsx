import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// Type definitions
export interface BloodGroup {
  id: string;
  code: string;
  label: string;
  rarity_percent: number | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface BloodCompatibility {
  raw: Array<{ donor_blood_group: string; recipient_blood_group: string }>;
  canDonateTo: Record<string, string[]>;
  canReceiveFrom: Record<string, string[]>;
  bloodTypeInfo: Record<string, { title: string; rarity: string }>;
}

export interface AvailabilityStatus {
  id: string;
  code: string;
  label: string;
  color: string;
  bg_color: string;
  icon_name: string;
  sort_order: number;
  is_active: boolean;
}

export interface UrgencyOption {
  id: string;
  value: string;
  label: string;
  hours: number | null;
  sort_order: number;
  is_active: boolean;
}

export interface EmergencyType {
  id: string;
  code: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export interface TierInfo {
  name: string;
  color: string;
  discount: number;
  minPoints: number;
  maxPoints: number | null;
  icon: string;
}

export interface ReferenceData {
  bloodGroups: BloodGroup[];
  bloodGroupCodes: string[];
  bloodCompatibility: BloodCompatibility;
  availabilityStatuses: AvailabilityStatus[];
  urgencyOptions: UrgencyOption[];
  emergencyTypes: EmergencyType[];
  tiers: TierInfo[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

const defaultReferenceData: ReferenceData = {
  bloodGroups: [],
  bloodGroupCodes: [],
  bloodCompatibility: {
    raw: [],
    canDonateTo: {},
    canReceiveFrom: {},
    bloodTypeInfo: {}
  },
  availabilityStatuses: [],
  urgencyOptions: [],
  emergencyTypes: [],
  tiers: [],
  isLoading: true,
  error: null,
  refetch: () => {}
};

const ReferenceDataContext = createContext<ReferenceData>(defaultReferenceData);

async function fetchReferenceData() {
  const { data, error } = await supabase.functions.invoke('get-reference-data');
  
  if (error) {
    console.error('Error fetching reference data:', error);
    throw error;
  }
  
  return data;
}

export function ReferenceDataProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reference-data'],
    queryFn: fetchReferenceData,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours cache
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const value: ReferenceData = {
    bloodGroups: data?.blood_groups || [],
    bloodGroupCodes: data?.blood_groups?.map((bg: BloodGroup) => bg.code) || [],
    bloodCompatibility: data?.blood_compatibility || defaultReferenceData.bloodCompatibility,
    availabilityStatuses: data?.availability_statuses || [],
    urgencyOptions: data?.urgency_options || [],
    emergencyTypes: data?.emergency_types || [],
    tiers: data?.tiers || [],
    isLoading,
    error: error as Error | null,
    refetch
  };

  return (
    <ReferenceDataContext.Provider value={value}>
      {children}
    </ReferenceDataContext.Provider>
  );
}

export function useReferenceData() {
  const context = useContext(ReferenceDataContext);
  if (!context) {
    throw new Error('useReferenceData must be used within a ReferenceDataProvider');
  }
  return context;
}

// Fallback data for graceful degradation when reference data is loading or unavailable
export const FALLBACK_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const FALLBACK_URGENCY_OPTIONS = [
  { value: '2', label: '2 hours', hours: 2 },
  { value: '4', label: '4 hours', hours: 4 },
  { value: '6', label: '6 hours', hours: 6 },
  { value: '12', label: '12 hours', hours: 12 },
  { value: '24', label: '24 hours', hours: 24 },
  { value: '48', label: '48 hours', hours: 48 },
  { value: 'custom', label: 'Custom Date/Time', hours: null },
];

export const FALLBACK_EMERGENCY_TYPES = [
  { code: 'thalassaemia', label: 'Thalassaemia' },
  { code: 'pregnancy', label: 'Pregnancy' },
  { code: 'surgery', label: 'Surgery' },
  { code: 'emergency_surgery', label: 'Emergency Surgery' },
  { code: 'custom', label: 'Other (Specify)' },
];
