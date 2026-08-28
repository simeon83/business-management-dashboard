import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Business, BusinessUser } from '@/types';
import { useAuth } from './useAuth';

export function useBusiness() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadBusinesses();
  }, [user]);

  const loadBusinesses = async () => {
    try {
      setLoading(true);
      const { data: businessUsers, error } = await supabase
        .from('business_users')
        .select('business_id, role')
        .eq('user_id', user?.id)
        .eq('active', true);

      if (error) throw error;

      if (businessUsers && businessUsers.length > 0) {
        const businessIds = businessUsers.map((bu) => bu.business_id);
        const { data: businessesData, error: businessError } = await supabase
          .from('businesses')
          .select('*')
          .in('id', businessIds)
          .eq('active', true);

        if (businessError) throw businessError;

        setBusinesses(businessesData || []);
        if (businessesData && businessesData.length > 0) {
          const firstBusiness = businessesData[0];
          setCurrentBusiness(firstBusiness);
          const role = businessUsers.find((bu) => bu.business_id === firstBusiness.id)?.role;
          setCurrentRole(role || 'viewer');
        }
      }
    } catch (error) {
      console.error('Error loading businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchBusiness = async (businessId: string) => {
    const business = businesses.find((b) => b.id === businessId);
    if (business) {
      setCurrentBusiness(business);
      const { data: businessUser } = await supabase
        .from('business_users')
        .select('role')
        .eq('business_id', businessId)
        .eq('user_id', user?.id)
        .single();

      setCurrentRole(businessUser?.role || 'viewer');
    }
  };

  const canAccess = (permission: string) => {
    const permissions: Record<string, string[]> = {
      admin: ['all'],
      manager: ['read', 'write', 'moderate'],
      staff: ['read', 'write'],
      viewer: ['read'],
    };

    const userPermissions = permissions[currentRole as string] || [];
    return userPermissions.includes('all') || userPermissions.includes(permission);
  };

  return {
    businesses,
    currentBusiness,
    currentRole,
    loading,
    switchBusiness,
    canAccess,
    loadBusinesses,
  };
}
