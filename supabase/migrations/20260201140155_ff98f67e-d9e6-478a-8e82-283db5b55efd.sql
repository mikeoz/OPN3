-- OPN3.011-0: CARD Lifecycle & Identity Authority
-- Add supersession columns for non-mutating edits and lineage tracking

-- Add supersession columns to tno_member_cards
ALTER TABLE public.tno_member_cards 
ADD COLUMN superseded_by uuid REFERENCES public.tno_member_cards(id),
ADD COLUMN superseded_at timestamp with time zone,
ADD COLUMN is_current boolean NOT NULL DEFAULT true;

-- Create index for efficient querying of current cards
CREATE INDEX idx_member_cards_current ON public.tno_member_cards(member_id, is_current) WHERE is_current = true;

-- Create index for lineage traversal
CREATE INDEX idx_member_cards_superseded_by ON public.tno_member_cards(superseded_by) WHERE superseded_by IS NOT NULL;

-- Function: Create a new member CARD instance explicitly
CREATE OR REPLACE FUNCTION public.tno_create_member_card(
  p_catalog_card_key text,
  p_card_data jsonb,
  p_label text DEFAULT 'Primary'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_catalog_card_id uuid;
  v_new_card_id uuid;
BEGIN
  -- Get catalog card ID
  SELECT card_id INTO v_catalog_card_id
  FROM tno_card_catalog
  WHERE card_key = p_catalog_card_key AND status = 'active';
  
  IF v_catalog_card_id IS NULL THEN
    RAISE EXCEPTION 'Card type not found: %', p_catalog_card_key;
  END IF;
  
  -- Create new member card instance
  INSERT INTO tno_member_cards (
    member_id,
    catalog_card_id,
    card_data,
    label,
    is_current
  ) VALUES (
    auth.uid(),
    v_catalog_card_id,
    p_card_data,
    p_label,
    true
  )
  RETURNING id INTO v_new_card_id;
  
  -- Create audit event
  INSERT INTO tno_audit_events (
    event_type,
    actor_member_id,
    subject_member_id,
    metadata
  ) VALUES (
    'personal_card.created',
    auth.uid(),
    auth.uid(),
    jsonb_build_object(
      'member_card_id', v_new_card_id,
      'card_key', p_catalog_card_key,
      'label', p_label
    )
  );
  
  RETURN v_new_card_id;
END;
$$;

-- Function: Supersede a CARD (non-mutating edit)
-- Creates new CARD instance with updated data, marks old as superseded
CREATE OR REPLACE FUNCTION public.tno_supersede_member_card(
  p_member_card_id uuid,
  p_new_card_data jsonb,
  p_new_label text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_card RECORD;
  v_new_card_id uuid;
  v_final_label text;
BEGIN
  -- Get the old card and verify ownership
  SELECT * INTO v_old_card
  FROM tno_member_cards
  WHERE id = p_member_card_id
    AND member_id = auth.uid()
    AND is_current = true;
  
  IF v_old_card IS NULL THEN
    RAISE EXCEPTION 'Card not found, not owned by user, or already superseded';
  END IF;
  
  -- Use new label if provided, otherwise keep existing
  v_final_label := COALESCE(p_new_label, v_old_card.label);
  
  -- Create the new card instance
  INSERT INTO tno_member_cards (
    member_id,
    catalog_card_id,
    card_data,
    label,
    is_current
  ) VALUES (
    auth.uid(),
    v_old_card.catalog_card_id,
    p_new_card_data,
    v_final_label,
    true
  )
  RETURNING id INTO v_new_card_id;
  
  -- Mark the old card as superseded
  UPDATE tno_member_cards
  SET 
    superseded_by = v_new_card_id,
    superseded_at = now(),
    is_current = false
  WHERE id = p_member_card_id;
  
  -- Create audit event for supersession
  INSERT INTO tno_audit_events (
    event_type,
    actor_member_id,
    subject_member_id,
    metadata
  ) VALUES (
    'personal_card.updated',
    auth.uid(),
    auth.uid(),
    jsonb_build_object(
      'old_member_card_id', p_member_card_id,
      'new_member_card_id', v_new_card_id,
      'action', 'supersession'
    )
  );
  
  RETURN v_new_card_id;
END;
$$;

-- Function: Get lineage for a CARD (original → current chain)
CREATE OR REPLACE FUNCTION public.tno_get_card_lineage(
  p_member_card_id uuid
)
RETURNS TABLE (
  id uuid,
  card_data jsonb,
  label text,
  is_current boolean,
  superseded_by uuid,
  superseded_at timestamp with time zone,
  created_at timestamp with time zone,
  position_in_chain integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_root_id uuid;
  v_catalog_card_id uuid;
BEGIN
  -- Get card owner and catalog card ID
  SELECT mc.member_id, mc.catalog_card_id INTO v_member_id, v_catalog_card_id
  FROM tno_member_cards mc
  WHERE mc.id = p_member_card_id;
  
  -- Must be owner or have shared access
  IF v_member_id IS NULL THEN
    RETURN;
  END IF;
  
  -- For now, only owner can see full lineage (could extend for recipients later)
  IF v_member_id != auth.uid() THEN
    RETURN;
  END IF;
  
  -- Find the root of the chain by traversing backwards
  -- We need to find all cards of same type for this member, then walk the chain
  v_root_id := p_member_card_id;
  
  -- Return the full lineage chain ordered by creation
  RETURN QUERY
  WITH RECURSIVE chain AS (
    -- Start from all cards of this type that have no predecessor pointing to them
    SELECT mc.id, mc.card_data, mc.label, mc.is_current, 
           mc.superseded_by, mc.superseded_at, mc.created_at,
           1 as depth
    FROM tno_member_cards mc
    WHERE mc.member_id = v_member_id
      AND mc.catalog_card_id = v_catalog_card_id
      AND NOT EXISTS (
        SELECT 1 FROM tno_member_cards mc2 
        WHERE mc2.superseded_by = mc.id
      )
    
    UNION ALL
    
    -- Walk forward through supersession chain
    SELECT mc.id, mc.card_data, mc.label, mc.is_current,
           mc.superseded_by, mc.superseded_at, mc.created_at,
           c.depth + 1
    FROM tno_member_cards mc
    JOIN chain c ON c.superseded_by = mc.id
  )
  SELECT c.id, c.card_data, c.label, c.is_current,
         c.superseded_by, c.superseded_at, c.created_at,
         c.depth as position_in_chain
  FROM chain c
  ORDER BY c.depth;
END;
$$;

-- Function: Update label on a CARD (does not create supersession, just label change)
CREATE OR REPLACE FUNCTION public.tno_update_card_label(
  p_member_card_id uuid,
  p_new_label text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tno_member_cards
  SET label = p_new_label, updated_at = now()
  WHERE id = p_member_card_id
    AND member_id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Update existing tno_update_member_card to use supersession model
CREATE OR REPLACE FUNCTION public.tno_update_member_card(
  p_catalog_card_key text,
  p_card_data jsonb,
  p_label text DEFAULT 'Primary'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_catalog_card_id uuid;
  v_existing_card_id uuid;
  v_new_card_id uuid;
BEGIN
  -- Get catalog card ID
  SELECT card_id INTO v_catalog_card_id
  FROM tno_card_catalog
  WHERE card_key = p_catalog_card_key AND status = 'active';
  
  IF v_catalog_card_id IS NULL THEN
    RAISE EXCEPTION 'Card type not found: %', p_catalog_card_key;
  END IF;
  
  -- Check if user has an existing current card of this type with this label
  SELECT id INTO v_existing_card_id
  FROM tno_member_cards
  WHERE member_id = auth.uid()
    AND catalog_card_id = v_catalog_card_id
    AND label = p_label
    AND is_current = true;
  
  IF v_existing_card_id IS NOT NULL THEN
    -- Supersede the existing card
    PERFORM tno_supersede_member_card(v_existing_card_id, p_card_data, p_label);
  ELSE
    -- Create new card
    PERFORM tno_create_member_card(p_catalog_card_key, p_card_data, p_label);
  END IF;
  
  RETURN true;
END;
$$;