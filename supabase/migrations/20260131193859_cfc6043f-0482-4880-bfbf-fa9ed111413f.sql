-- OPN3.009: Share Proposals for Share Back functionality
-- Creates tables and RPCs for post-relationship CARD sharing

-- Create proposal status enum
CREATE TYPE share_proposal_status AS ENUM ('pending', 'accepted', 'declined');

-- Share proposals table
CREATE TABLE public.tno_share_proposals (
  proposal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES tno_relationships(relationship_id),
  from_member_id UUID NOT NULL REFERENCES tno_members(member_id),
  to_member_id UUID NOT NULL REFERENCES tno_members(member_id),
  scenario_id UUID NOT NULL REFERENCES tno_sharing_scenarios(scenario_id),
  status share_proposal_status NOT NULL DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  note TEXT
);

-- Share proposal items (cards being proposed)
CREATE TABLE public.tno_share_proposal_items (
  proposal_id UUID NOT NULL REFERENCES tno_share_proposals(proposal_id),
  card_id UUID NOT NULL REFERENCES tno_card_catalog(card_id),
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (proposal_id, card_id)
);

-- Enable RLS
ALTER TABLE tno_share_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tno_share_proposal_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for share_proposals
CREATE POLICY "Members can view their proposals"
ON tno_share_proposals FOR SELECT
USING (auth.uid() = from_member_id OR auth.uid() = to_member_id);

CREATE POLICY "Members can create proposals"
ON tno_share_proposals FOR INSERT
WITH CHECK (auth.uid() = from_member_id);

CREATE POLICY "Recipients can update proposals"
ON tno_share_proposals FOR UPDATE
USING (auth.uid() = to_member_id);

-- RLS policies for share_proposal_items
CREATE POLICY "Members can view proposal items"
ON tno_share_proposal_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM tno_share_proposals sp
  WHERE sp.proposal_id = tno_share_proposal_items.proposal_id
  AND (sp.from_member_id = auth.uid() OR sp.to_member_id = auth.uid())
));

CREATE POLICY "Proposers can insert items"
ON tno_share_proposal_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM tno_share_proposals sp
  WHERE sp.proposal_id = tno_share_proposal_items.proposal_id
  AND sp.from_member_id = auth.uid()
));

-- Add new audit event types
ALTER TYPE audit_event_type ADD VALUE 'share_proposal.created';
ALTER TYPE audit_event_type ADD VALUE 'share_proposal.accepted';
ALTER TYPE audit_event_type ADD VALUE 'share_proposal.declined';
ALTER TYPE audit_event_type ADD VALUE 'trust_loop.completed';

-- Add share_proposal_id to audit_events
ALTER TABLE tno_audit_events ADD COLUMN share_proposal_id UUID REFERENCES tno_share_proposals(proposal_id);

-- RPC: Create a share proposal
CREATE OR REPLACE FUNCTION public.tno_create_share_proposal(
  p_relationship_id UUID,
  p_to_member_id UUID,
  p_scenario_id UUID,
  p_card_ids UUID[],
  p_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_proposal_id UUID;
  v_relationship tno_relationships%ROWTYPE;
  v_card_id UUID;
  v_position INTEGER := 0;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify relationship exists and user is part of it
  SELECT * INTO v_relationship
  FROM tno_relationships
  WHERE relationship_id = p_relationship_id
    AND status = 'active'
    AND (member_a_id = v_user_id OR member_b_id = v_user_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active relationship not found or you are not a member';
  END IF;

  -- Verify to_member is the other party in the relationship
  IF NOT (
    (v_relationship.member_a_id = v_user_id AND v_relationship.member_b_id = p_to_member_id) OR
    (v_relationship.member_b_id = v_user_id AND v_relationship.member_a_id = p_to_member_id)
  ) THEN
    RAISE EXCEPTION 'Target member is not part of this relationship';
  END IF;

  -- Create the proposal
  INSERT INTO tno_share_proposals (
    relationship_id, from_member_id, to_member_id, scenario_id, message
  ) VALUES (
    p_relationship_id, v_user_id, p_to_member_id, p_scenario_id, p_message
  ) RETURNING proposal_id INTO v_proposal_id;

  -- Add cards to proposal
  FOREACH v_card_id IN ARRAY p_card_ids LOOP
    INSERT INTO tno_share_proposal_items (proposal_id, card_id, position)
    VALUES (v_proposal_id, v_card_id, v_position);
    v_position := v_position + 1;
  END LOOP;

  -- Audit event
  INSERT INTO tno_audit_events (
    event_type, actor_member_id, subject_member_id, 
    relationship_id, share_proposal_id, metadata
  ) VALUES (
    'share_proposal.created', v_user_id, p_to_member_id,
    p_relationship_id, v_proposal_id,
    jsonb_build_object('card_count', array_length(p_card_ids, 1))
  );

  RETURN v_proposal_id;
END;
$$;

-- RPC: Accept a share proposal
CREATE OR REPLACE FUNCTION public.tno_accept_share_proposal(
  p_proposal_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_proposal tno_share_proposals%ROWTYPE;
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

  IF v_proposal.to_member_id != v_user_id THEN
    RAISE EXCEPTION 'You are not the recipient of this proposal';
  END IF;

  IF v_proposal.status != 'pending' THEN
    RAISE EXCEPTION 'Proposal has already been %', v_proposal.status;
  END IF;

  -- Update proposal status
  UPDATE tno_share_proposals
  SET status = 'accepted', responded_at = now(), note = p_note
  WHERE proposal_id = p_proposal_id;

  -- Audit: proposal accepted
  INSERT INTO tno_audit_events (
    event_type, actor_member_id, subject_member_id,
    relationship_id, share_proposal_id
  ) VALUES (
    'share_proposal.accepted', v_user_id, v_proposal.from_member_id,
    v_proposal.relationship_id, p_proposal_id
  );

  -- Audit: trust loop completed
  INSERT INTO tno_audit_events (
    event_type, actor_member_id, subject_member_id,
    relationship_id, share_proposal_id,
    metadata
  ) VALUES (
    'trust_loop.completed', v_user_id, v_proposal.from_member_id,
    v_proposal.relationship_id, p_proposal_id,
    jsonb_build_object('completed_at', now())
  );

  RETURN TRUE;
END;
$$;

-- RPC: Decline a share proposal
CREATE OR REPLACE FUNCTION public.tno_decline_share_proposal(
  p_proposal_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_proposal tno_share_proposals%ROWTYPE;
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

  IF v_proposal.to_member_id != v_user_id THEN
    RAISE EXCEPTION 'You are not the recipient of this proposal';
  END IF;

  IF v_proposal.status != 'pending' THEN
    RAISE EXCEPTION 'Proposal has already been %', v_proposal.status;
  END IF;

  -- Update proposal status
  UPDATE tno_share_proposals
  SET status = 'declined', responded_at = now(), note = p_note
  WHERE proposal_id = p_proposal_id;

  -- Audit event
  INSERT INTO tno_audit_events (
    event_type, actor_member_id, subject_member_id,
    relationship_id, share_proposal_id
  ) VALUES (
    'share_proposal.declined', v_user_id, v_proposal.from_member_id,
    v_proposal.relationship_id, p_proposal_id
  );

  RETURN TRUE;
END;
$$;