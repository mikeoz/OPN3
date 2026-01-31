-- OPN3.010-4: Add member_card_id for instance-level CARD sharing
-- STEP 1: Add the column first
ALTER TABLE public.tno_share_proposal_items 
ADD COLUMN IF NOT EXISTS member_card_id UUID REFERENCES public.tno_member_cards(id);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_share_proposal_items_member_card 
ON public.tno_share_proposal_items(member_card_id);

-- STEP 2: Drop the old function signature first
DROP FUNCTION IF EXISTS public.tno_create_share_proposal(UUID, UUID, UUID, UUID[], TEXT);

-- STEP 3: Create the updated function that accepts member_card_ids
CREATE OR REPLACE FUNCTION public.tno_create_share_proposal(
  p_relationship_id UUID,
  p_to_member_id UUID,
  p_scenario_id UUID,
  p_member_card_ids UUID[],
  p_message TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal_id UUID;
  v_from_member_id UUID := auth.uid();
  v_member_card_id UUID;
  v_catalog_card_id UUID;
  v_position INT := 0;
BEGIN
  IF v_from_member_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify caller is part of the relationship
  IF NOT EXISTS (
    SELECT 1 FROM tno_relationships 
    WHERE relationship_id = p_relationship_id
    AND (member_a_id = v_from_member_id OR member_b_id = v_from_member_id)
    AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized or relationship not active';
  END IF;

  -- Verify to_member is the other party
  IF NOT EXISTS (
    SELECT 1 FROM tno_relationships 
    WHERE relationship_id = p_relationship_id
    AND (member_a_id = p_to_member_id OR member_b_id = p_to_member_id)
    AND p_to_member_id != v_from_member_id
  ) THEN
    RAISE EXCEPTION 'Invalid recipient for this relationship';
  END IF;

  -- Create the proposal
  INSERT INTO tno_share_proposals (
    relationship_id,
    from_member_id,
    to_member_id,
    scenario_id,
    message,
    status
  ) VALUES (
    p_relationship_id,
    v_from_member_id,
    p_to_member_id,
    p_scenario_id,
    p_message,
    'pending'
  ) RETURNING proposal_id INTO v_proposal_id;

  -- Add proposal items - reference both catalog card and member card instance
  FOREACH v_member_card_id IN ARRAY p_member_card_ids
  LOOP
    -- Get the catalog_card_id from the member_card
    SELECT catalog_card_id INTO v_catalog_card_id
    FROM tno_member_cards
    WHERE id = v_member_card_id AND member_id = v_from_member_id;

    IF v_catalog_card_id IS NULL THEN
      RAISE EXCEPTION 'Member card % not found or not owned by caller', v_member_card_id;
    END IF;

    INSERT INTO tno_share_proposal_items (
      proposal_id,
      card_id,
      member_card_id,
      position
    ) VALUES (
      v_proposal_id,
      v_catalog_card_id,
      v_member_card_id,
      v_position
    );
    v_position := v_position + 1;
  END LOOP;

  -- Create audit event
  INSERT INTO tno_audit_events (
    event_type,
    actor_member_id,
    subject_member_id,
    share_proposal_id,
    relationship_id,
    metadata
  ) VALUES (
    'share_proposal.created',
    v_from_member_id,
    p_to_member_id,
    v_proposal_id,
    p_relationship_id,
    jsonb_build_object('card_count', array_length(p_member_card_ids, 1))
  );

  RETURN v_proposal_id;
END;
$$;

-- Backfill function to ensure all existing members have identity CARDs
CREATE OR REPLACE FUNCTION public.tno_ensure_identity_cards(p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member RECORD;
  v_identity_card_id UUID;
  v_email_card_id UUID;
  v_phone_card_id UUID;
BEGIN
  -- Get member info
  SELECT * INTO v_member FROM tno_members WHERE member_id = p_member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- Get catalog card IDs
  SELECT card_id INTO v_identity_card_id FROM tno_card_catalog WHERE card_key = 'identity.basic';
  SELECT card_id INTO v_email_card_id FROM tno_card_catalog WHERE card_key = 'contact.email';
  SELECT card_id INTO v_phone_card_id FROM tno_card_catalog WHERE card_key = 'contact.phone';

  -- Create identity.basic if not exists
  INSERT INTO tno_member_cards (member_id, catalog_card_id, card_data, label)
  SELECT p_member_id, v_identity_card_id, jsonb_build_object('name', COALESCE(v_member.handle, '')), 'Primary'
  WHERE NOT EXISTS (
    SELECT 1 FROM tno_member_cards 
    WHERE member_id = p_member_id AND catalog_card_id = v_identity_card_id AND label = 'Primary'
  );

  -- Create contact.email if not exists
  INSERT INTO tno_member_cards (member_id, catalog_card_id, card_data, label)
  SELECT p_member_id, v_email_card_id, jsonb_build_object('email', v_member.email), 'Primary'
  WHERE NOT EXISTS (
    SELECT 1 FROM tno_member_cards 
    WHERE member_id = p_member_id AND catalog_card_id = v_email_card_id AND label = 'Primary'
  );

  -- Create contact.phone if not exists (empty phone)
  INSERT INTO tno_member_cards (member_id, catalog_card_id, card_data, label)
  SELECT p_member_id, v_phone_card_id, jsonb_build_object('phone', ''), 'Primary'
  WHERE NOT EXISTS (
    SELECT 1 FROM tno_member_cards 
    WHERE member_id = p_member_id AND catalog_card_id = v_phone_card_id AND label = 'Primary'
  );
END;
$$;