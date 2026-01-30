
-- Create enum for invite link status
CREATE TYPE public.invite_link_status AS ENUM ('pending', 'claimed', 'accepted', 'revoked', 'expired');

-- Create tno_invite_links table
CREATE TABLE public.tno_invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  inviter_member_id UUID NOT NULL REFERENCES public.tno_members(member_id),
  invitee_email TEXT NOT NULL,
  invitee_name TEXT,
  scenario_id UUID NOT NULL REFERENCES public.tno_sharing_scenarios(scenario_id),
  invitation_card_json JSONB NOT NULL,
  status public.invite_link_status NOT NULL DEFAULT 'pending',
  claimed_by_member_id UUID REFERENCES public.tno_members(member_id),
  invitation_id UUID REFERENCES public.tno_invitations(invitation_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  revoked_at TIMESTAMPTZ
);

-- Enable RLS on tno_invite_links
ALTER TABLE public.tno_invite_links ENABLE ROW LEVEL SECURITY;

-- RLS policies for tno_invite_links
CREATE POLICY "Inviters can create invite links"
ON public.tno_invite_links FOR INSERT
WITH CHECK (auth.uid() = inviter_member_id);

CREATE POLICY "Inviters and claimers can view invite links"
ON public.tno_invite_links FOR SELECT
USING (auth.uid() = inviter_member_id OR auth.uid() = claimed_by_member_id);

CREATE POLICY "Inviters and claimers can update invite links"
ON public.tno_invite_links FOR UPDATE
USING (auth.uid() = inviter_member_id OR auth.uid() = claimed_by_member_id);

-- Create tno_personal_cards table
CREATE TABLE public.tno_personal_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL UNIQUE REFERENCES public.tno_members(member_id),
  card_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on tno_personal_cards
ALTER TABLE public.tno_personal_cards ENABLE ROW LEVEL SECURITY;

-- RLS policies for tno_personal_cards
CREATE POLICY "Members can view their own personal card"
ON public.tno_personal_cards FOR SELECT
USING (auth.uid() = member_id);

CREATE POLICY "Members can insert their own personal card"
ON public.tno_personal_cards FOR INSERT
WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Members can update their own personal card"
ON public.tno_personal_cards FOR UPDATE
USING (auth.uid() = member_id);

-- Add new columns to tno_invitations
ALTER TABLE public.tno_invitations 
  ADD COLUMN to_email TEXT,
  ADD COLUMN invite_link_id UUID REFERENCES public.tno_invite_links(id),
  ALTER COLUMN to_member_id DROP NOT NULL;

-- Add check constraint: either to_member_id or to_email must be set
ALTER TABLE public.tno_invitations 
  ADD CONSTRAINT invitation_recipient_check 
  CHECK (to_member_id IS NOT NULL OR to_email IS NOT NULL);

-- Add new audit event types
ALTER TYPE public.audit_event_type ADD VALUE 'invite.created';
ALTER TYPE public.audit_event_type ADD VALUE 'invite.claimed';
ALTER TYPE public.audit_event_type ADD VALUE 'invite.revoked';
ALTER TYPE public.audit_event_type ADD VALUE 'personal_card.created';
ALTER TYPE public.audit_event_type ADD VALUE 'personal_card.updated';

-- Create function to claim an invite link
CREATE OR REPLACE FUNCTION public.tno_claim_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_link tno_invite_links%ROWTYPE;
  v_inviter tno_members%ROWTYPE;
  v_scenario tno_sharing_scenarios%ROWTYPE;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get and validate the invite link
  SELECT * INTO v_invite_link
  FROM tno_invite_links
  WHERE token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invitation token';
  END IF;

  IF v_invite_link.status != 'pending' THEN
    RAISE EXCEPTION 'Invitation has already been %', v_invite_link.status;
  END IF;

  IF v_invite_link.expires_at < now() THEN
    -- Mark as expired
    UPDATE tno_invite_links SET status = 'expired' WHERE id = v_invite_link.id;
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  IF v_invite_link.inviter_member_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot claim your own invitation';
  END IF;

  -- Claim the invite
  UPDATE tno_invite_links
  SET 
    status = 'claimed',
    claimed_by_member_id = v_user_id
  WHERE id = v_invite_link.id;

  -- Update the invitation record
  UPDATE tno_invitations
  SET to_member_id = v_user_id
  WHERE invite_link_id = v_invite_link.id;

  -- Get inviter info
  SELECT * INTO v_inviter FROM tno_members WHERE member_id = v_invite_link.inviter_member_id;

  -- Get scenario info
  SELECT * INTO v_scenario FROM tno_sharing_scenarios WHERE scenario_id = v_invite_link.scenario_id;

  -- Write audit event
  INSERT INTO tno_audit_events (event_type, actor_member_id, subject_member_id, invitation_id, metadata)
  SELECT 
    'invite.claimed',
    v_user_id,
    v_invite_link.inviter_member_id,
    invitation_id,
    jsonb_build_object('invite_link_id', v_invite_link.id)
  FROM tno_invitations WHERE invite_link_id = v_invite_link.id;

  RETURN jsonb_build_object(
    'invite_link_id', v_invite_link.id,
    'inviter', jsonb_build_object(
      'member_id', v_inviter.member_id,
      'handle', v_inviter.handle,
      'email', v_inviter.email
    ),
    'scenario', jsonb_build_object(
      'scenario_id', v_scenario.scenario_id,
      'title', v_scenario.title,
      'description', v_scenario.description
    ),
    'invitation_card_json', v_invite_link.invitation_card_json,
    'invitee_name', v_invite_link.invitee_name,
    'invitee_email', v_invite_link.invitee_email
  );
END;
$$;

-- Create function to accept an invite
CREATE OR REPLACE FUNCTION public.tno_accept_invite(p_token TEXT, p_personal_card_json JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_link tno_invite_links%ROWTYPE;
  v_invitation tno_invitations%ROWTYPE;
  v_card_share tno_card_shares%ROWTYPE;
  v_user_id UUID;
  v_relationship_id UUID;
  v_member_a_id UUID;
  v_member_b_id UUID;
  v_personal_card_exists BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get and validate the invite link
  SELECT * INTO v_invite_link
  FROM tno_invite_links
  WHERE token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invitation token';
  END IF;

  IF v_invite_link.claimed_by_member_id != v_user_id THEN
    RAISE EXCEPTION 'This invitation was not claimed by you';
  END IF;

  IF v_invite_link.status != 'claimed' THEN
    RAISE EXCEPTION 'Invitation is not in claimable state, status: %', v_invite_link.status;
  END IF;

  -- Upsert personal card
  SELECT EXISTS(SELECT 1 FROM tno_personal_cards WHERE member_id = v_user_id) INTO v_personal_card_exists;
  
  IF v_personal_card_exists THEN
    UPDATE tno_personal_cards
    SET card_json = p_personal_card_json, updated_at = now()
    WHERE member_id = v_user_id;

    INSERT INTO tno_audit_events (event_type, actor_member_id, subject_member_id, metadata)
    VALUES ('personal_card.updated', v_user_id, v_user_id, p_personal_card_json);
  ELSE
    INSERT INTO tno_personal_cards (member_id, card_json)
    VALUES (v_user_id, p_personal_card_json);

    INSERT INTO tno_audit_events (event_type, actor_member_id, subject_member_id, metadata)
    VALUES ('personal_card.created', v_user_id, v_user_id, p_personal_card_json);
  END IF;

  -- Optionally update member handle from personal card
  UPDATE tno_members
  SET handle = COALESCE(p_personal_card_json->>'name', handle)
  WHERE member_id = v_user_id AND handle IS NULL;

  -- Get the invitation
  SELECT * INTO v_invitation
  FROM tno_invitations
  WHERE invite_link_id = v_invite_link.id;

  -- Get the card share
  SELECT * INTO v_card_share
  FROM tno_card_shares
  WHERE invitation_id = v_invitation.invitation_id;

  -- Create acceptance
  INSERT INTO tno_acceptances (
    invitation_id, card_share_id, from_member_id, to_member_id, decision
  ) VALUES (
    v_invitation.invitation_id, v_card_share.card_share_id,
    v_invitation.from_member_id, v_user_id, 'accepted'
  );

  -- Update invitation status
  UPDATE tno_invitations
  SET status = 'accepted', responded_at = now()
  WHERE invitation_id = v_invitation.invitation_id;

  -- Update card share status
  UPDATE tno_card_shares
  SET status = 'accepted', accepted_at = now()
  WHERE card_share_id = v_card_share.card_share_id;

  -- Update invite link status
  UPDATE tno_invite_links
  SET status = 'accepted'
  WHERE id = v_invite_link.id;

  -- Create relationship with canonical ordering
  IF v_invitation.from_member_id < v_user_id THEN
    v_member_a_id := v_invitation.from_member_id;
    v_member_b_id := v_user_id;
  ELSE
    v_member_a_id := v_user_id;
    v_member_b_id := v_invitation.from_member_id;
  END IF;

  INSERT INTO tno_relationships (
    member_a_id, member_b_id, created_from_card_share_id, scenario_id
  ) VALUES (
    v_member_a_id, v_member_b_id, v_card_share.card_share_id, v_invitation.scenario_id
  ) RETURNING relationship_id INTO v_relationship_id;

  -- Write audit events
  INSERT INTO tno_audit_events (event_type, actor_member_id, subject_member_id, invitation_id, card_share_id)
  VALUES ('invitation.accepted', v_user_id, v_invitation.from_member_id, v_invitation.invitation_id, v_card_share.card_share_id);

  INSERT INTO tno_audit_events (event_type, actor_member_id, subject_member_id, relationship_id, card_share_id)
  VALUES ('relationship.created', v_user_id, v_invitation.from_member_id, v_relationship_id, v_card_share.card_share_id);

  RETURN v_relationship_id;
END;
$$;

-- Create function to revoke an invite link
CREATE OR REPLACE FUNCTION public.tno_revoke_invite(p_invite_link_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_link tno_invite_links%ROWTYPE;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_invite_link FROM tno_invite_links WHERE id = p_invite_link_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite link not found';
  END IF;

  IF v_invite_link.inviter_member_id != v_user_id THEN
    RAISE EXCEPTION 'Only the inviter can revoke this invitation';
  END IF;

  IF v_invite_link.status NOT IN ('pending', 'claimed') THEN
    RAISE EXCEPTION 'Cannot revoke invitation with status: %', v_invite_link.status;
  END IF;

  -- Revoke the invite link
  UPDATE tno_invite_links
  SET status = 'revoked', revoked_at = now()
  WHERE id = p_invite_link_id;

  -- Update the invitation
  UPDATE tno_invitations
  SET status = 'cancelled', responded_at = now()
  WHERE invite_link_id = p_invite_link_id;

  -- Write audit event
  INSERT INTO tno_audit_events (event_type, actor_member_id, subject_member_id, metadata)
  SELECT 
    'invite.revoked',
    v_user_id,
    claimed_by_member_id,
    jsonb_build_object('invite_link_id', p_invite_link_id, 'reason', p_reason)
  FROM tno_invite_links WHERE id = p_invite_link_id;

  RETURN TRUE;
END;
$$;

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION public.tno_claim_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tno_accept_invite(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tno_revoke_invite(UUID, TEXT) TO authenticated;

-- Update existing RLS policy for tno_invitations to handle nullable to_member_id
DROP POLICY IF EXISTS "Members can view their invitations" ON public.tno_invitations;
CREATE POLICY "Members can view their invitations"
ON public.tno_invitations FOR SELECT
USING (
  auth.uid() = from_member_id 
  OR auth.uid() = to_member_id 
  OR (to_member_id IS NULL AND EXISTS (
    SELECT 1 FROM tno_invite_links 
    WHERE tno_invite_links.invitation_id = tno_invitations.invitation_id 
    AND tno_invite_links.inviter_member_id = auth.uid()
  ))
);
