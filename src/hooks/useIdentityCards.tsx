import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// OPN3.010-3: Identity data from discrete CARDs
export interface IdentityData {
  name?: string;
  email?: string;
  phone?: string;
}

interface MemberCardRow {
  id: string;
  member_id: string;
  catalog_card_id: string;
  card_data: Record<string, unknown>;
  label: string | null;
  created_at: string;
  updated_at: string;
  catalog_card: {
    card_key: string;
    title: string;
  } | null;
}

export function useIdentityCards() {
  const { user } = useAuth();
  const [identity, setIdentity] = useState<IdentityData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchIdentity = useCallback(async () => {
    if (!user) {
      setIdentity(null);
      setLoading(false);
      return;
    }

    try {
      // Fetch member's primary CARDs
      const { data, error } = await supabase
        .from('tno_member_cards')
        .select(`
          id,
          member_id,
          catalog_card_id,
          card_data,
          label,
          created_at,
          updated_at,
          catalog_card:tno_card_catalog(card_key, title)
        `)
        .eq('member_id', user.id)
        .eq('label', 'Primary');

      if (error) throw error;

      // Build identity from CARDs
      const identityData: IdentityData = {};
      
      for (const card of (data || []) as MemberCardRow[]) {
        const cardKey = card.catalog_card?.card_key;
        if (cardKey === 'identity.basic' && card.card_data) {
          identityData.name = card.card_data.name as string | undefined;
        } else if (cardKey === 'contact.email' && card.card_data) {
          identityData.email = card.card_data.email as string | undefined;
        } else if (cardKey === 'contact.phone' && card.card_data) {
          identityData.phone = card.card_data.phone as string | undefined;
        }
      }

      setIdentity(identityData);
    } catch (error) {
      console.error('Failed to fetch identity cards:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchIdentity();
  }, [fetchIdentity]);

  // Update a specific CARD
  const updateCard = useCallback(async (
    cardKey: string,
    cardData: Record<string, unknown>
  ) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { error } = await supabase.rpc('tno_update_member_card', {
        p_catalog_card_key: cardKey,
        p_card_data: cardData as unknown as string, // Cast for RPC parameter type
        p_label: 'Primary',
      });

      if (error) throw error;

      // Refresh identity
      await fetchIdentity();
      
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, [user, fetchIdentity]);

  // Update name (identity.basic CARD)
  const updateName = useCallback(async (name: string) => {
    return updateCard('identity.basic', { name });
  }, [updateCard]);

  // Update email (contact.email CARD)
  const updateEmail = useCallback(async (email: string) => {
    return updateCard('contact.email', { email });
  }, [updateCard]);

  // Update phone (contact.phone CARD)
  const updatePhone = useCallback(async (phone: string) => {
    return updateCard('contact.phone', { phone });
  }, [updateCard]);

  return {
    identity,
    loading,
    refetch: fetchIdentity,
    updateName,
    updateEmail,
    updatePhone,
    updateCard,
  };
}
