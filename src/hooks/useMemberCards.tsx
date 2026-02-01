import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// OPN3.011-0: Member CARD with supersession support
export interface MemberCardInstance {
  id: string;
  member_id: string;
  catalog_card_id: string;
  card_data: Record<string, unknown>;
  label: string | null;
  is_current: boolean;
  superseded_by: string | null;
  superseded_at: string | null;
  created_at: string;
  updated_at: string;
  catalog_card?: {
    card_key: string;
    title: string;
    summary: string;
  };
}

export interface CardLineageItem {
  id: string;
  card_data: Record<string, unknown>;
  label: string | null;
  is_current: boolean;
  superseded_by: string | null;
  superseded_at: string | null;
  created_at: string;
  position_in_chain: number;
}

export function useMemberCards() {
  const { user } = useAuth();
  const [cards, setCards] = useState<MemberCardInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCards = useCallback(async () => {
    if (!user) {
      setCards([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tno_member_cards')
        .select(`
          id,
          member_id,
          catalog_card_id,
          card_data,
          label,
          is_current,
          superseded_by,
          superseded_at,
          created_at,
          updated_at,
          catalog_card:tno_card_catalog(card_key, title, summary)
        `)
        .eq('member_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Type assertion for the joined data
      const typedCards = (data || []).map(card => ({
        ...card,
        catalog_card: card.catalog_card as MemberCardInstance['catalog_card'],
      })) as MemberCardInstance[];

      setCards(typedCards);
    } catch (error) {
      console.error('Failed to fetch member cards:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Get current cards only
  const currentCards = cards.filter(c => c.is_current);

  // Get superseded cards only
  const supersededCards = cards.filter(c => !c.is_current);

  // Create a new CARD instance
  const createCard = useCallback(async (
    cardKey: string,
    cardData: Record<string, unknown>,
    label: string = 'Primary'
  ) => {
    if (!user) return { error: new Error('Not authenticated'), cardId: null };

    try {
      const { data, error } = await supabase.rpc('tno_create_member_card', {
        p_catalog_card_key: cardKey,
        p_card_data: cardData as unknown as string, // Cast for RPC Json type
        p_label: label,
      });

      if (error) throw error;

      await fetchCards();
      return { error: null, cardId: data as string };
    } catch (error) {
      return { error: error as Error, cardId: null };
    }
  }, [user, fetchCards]);

  // Supersede a CARD (non-mutating edit)
  const supersedeCard = useCallback(async (
    memberCardId: string,
    newCardData: Record<string, unknown>,
    newLabel?: string
  ) => {
    if (!user) return { error: new Error('Not authenticated'), newCardId: null };

    try {
      const { data, error } = await supabase.rpc('tno_supersede_member_card', {
        p_member_card_id: memberCardId,
        p_new_card_data: newCardData as unknown as string, // Cast for RPC Json type
        p_new_label: newLabel ?? null,
      });

      if (error) throw error;

      await fetchCards();
      return { error: null, newCardId: data as string };
    } catch (error) {
      return { error: error as Error, newCardId: null };
    }
  }, [user, fetchCards]);

  // Update just the label (does not create supersession)
  const updateLabel = useCallback(async (
    memberCardId: string,
    newLabel: string
  ) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { error } = await supabase.rpc('tno_update_card_label', {
        p_member_card_id: memberCardId,
        p_new_label: newLabel,
      });

      if (error) throw error;

      await fetchCards();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, [user, fetchCards]);

  // Get lineage for a specific card
  const getCardLineage = useCallback(async (memberCardId: string) => {
    if (!user) return { error: new Error('Not authenticated'), lineage: [] };

    try {
      const { data, error } = await supabase.rpc('tno_get_card_lineage', {
        p_member_card_id: memberCardId,
      });

      if (error) throw error;

      return { error: null, lineage: (data || []) as CardLineageItem[] };
    } catch (error) {
      return { error: error as Error, lineage: [] };
    }
  }, [user]);

  return {
    cards,
    currentCards,
    supersededCards,
    loading,
    refetch: fetchCards,
    createCard,
    supersedeCard,
    updateLabel,
    getCardLineage,
  };
}
