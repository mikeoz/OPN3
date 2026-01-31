-- OPN3.010: Trust Revocation & Lifecycle Integrity
-- Add per-CARD revocation tracking to share proposal items

-- Add revocation columns to tno_share_proposal_items
ALTER TABLE public.tno_share_proposal_items
ADD COLUMN revoked_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN revoked_by_member_id UUID DEFAULT NULL REFERENCES public.tno_members(member_id);

-- Add audit event type for shared card revocation
ALTER TYPE public.audit_event_type ADD VALUE 'shared_card.revoked';

-- Create index for efficient revocation queries
CREATE INDEX idx_share_proposal_items_revoked 
ON public.tno_share_proposal_items(proposal_id) 
WHERE revoked_at IS NOT NULL;

-- RPC: Revoke a specific shared CARD from an accepted proposal
CREATE OR REPLACE FUNCTION public.tno_revoke_shared_card(
  p_proposal_id UUID,
  p_card_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_proposal tno_share_proposals%ROWTYPE;
  v_item tno_share_proposal_items%ROWTYPE;
  v_card tno_card_catalog%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get and validate proposal
  SELECT * INTO v_proposal
  FROM tno_share_proposals
  WHERE proposal_id = p_proposal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;

  -- Only the sharer can revoke their shared CARDs
  IF v_proposal.from_member_id != v_user_id THEN
    RAISE EXCEPTION 'Only the sharing member can revoke shared CARDs';
  END IF;

  -- Proposal must be accepted for revocation to be meaningful
  IF v_proposal.status != 'accepted' THEN
    RAISE EXCEPTION 'Cannot revoke CARDs from a proposal that is not accepted';
  END IF;

  -- Get the share item
  SELECT * INTO v_item
  FROM tno_share_proposal_items
  WHERE proposal_id = p_proposal_id
    AND card_id = p_card_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CARD not found in this proposal';
  END IF;

  IF v_item.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'This CARD has already been revoked';
  END IF;

  -- Get card info for audit
  SELECT * INTO v_card FROM tno_card_catalog WHERE card_id = p_card_id;

  -- Revoke the card share
  UPDATE tno_share_proposal_items
  SET 
    revoked_at = now(),
    revoked_by_member_id = v_user_id
  WHERE proposal_id = p_proposal_id
    AND card_id = p_card_id;

  -- Audit event
  INSERT INTO tno_audit_events (
    event_type, actor_member_id, subject_member_id,
    relationship_id, share_proposal_id,
    metadata
  ) VALUES (
    'shared_card.revoked', v_user_id, v_proposal.to_member_id,
    v_proposal.relationship_id, p_proposal_id,
    jsonb_build_object(
      'card_id', p_card_id,
      'card_title', v_card.title,
      'reason', p_reason
    )
  );

  RETURN TRUE;
END;
$$;