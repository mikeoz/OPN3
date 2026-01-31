
-- =============================================
-- OPN3.010-3: Member-Owned CARDs (Identity Authority)
-- Creates tno_member_cards for CARD-native identity storage
-- =============================================

-- First, create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Table for member-owned CARD instances
-- Each member owns discrete CARDs (person, email, phone) that are first-class data objects
CREATE TABLE public.tno_member_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.tno_members(member_id),
  catalog_card_id UUID NOT NULL REFERENCES public.tno_card_catalog(card_id),
  card_data JSONB NOT NULL,
  label TEXT NULL, -- Optional user-defined label (e.g., "Work Email", "Mobile")
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure a member can have multiple cards of same type (e.g., multiple phones)
  -- but constrained by catalog card
  CONSTRAINT unique_member_card UNIQUE (member_id, catalog_card_id, label)
);

-- Enable RLS
ALTER TABLE public.tno_member_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Members can view their own cards"
  ON public.tno_member_cards
  FOR SELECT
  USING (auth.uid() = member_id);

CREATE POLICY "Members can insert their own cards"
  ON public.tno_member_cards
  FOR INSERT
  WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Members can update their own cards"
  ON public.tno_member_cards
  FOR UPDATE
  USING (auth.uid() = member_id);

-- Trigger for updated_at
CREATE TRIGGER update_member_cards_updated_at
  BEFORE UPDATE ON public.tno_member_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create initial identity CARDs for a member
CREATE OR REPLACE FUNCTION public.tno_create_identity_cards(
  p_member_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_identity_card_id UUID;
  v_email_card_id UUID;
  v_phone_card_id UUID;
BEGIN
  -- Get catalog card IDs
  SELECT card_id INTO v_identity_card_id 
  FROM tno_card_catalog 
  WHERE card_key = 'identity.basic';
  
  SELECT card_id INTO v_email_card_id 
  FROM tno_card_catalog 
  WHERE card_key = 'contact.email';
  
  SELECT card_id INTO v_phone_card_id 
  FROM tno_card_catalog 
  WHERE card_key = 'contact.phone';

  -- Create Person CARD (identity.basic)
  INSERT INTO tno_member_cards (member_id, catalog_card_id, card_data, label)
  VALUES (
    p_member_id,
    v_identity_card_id,
    jsonb_build_object('name', p_name),
    'Primary'
  )
  ON CONFLICT (member_id, catalog_card_id, label) 
  DO UPDATE SET 
    card_data = jsonb_build_object('name', p_name),
    updated_at = now();

  -- Create Email CARD (contact.email)
  INSERT INTO tno_member_cards (member_id, catalog_card_id, card_data, label)
  VALUES (
    p_member_id,
    v_email_card_id,
    jsonb_build_object('email', p_email),
    'Primary'
  )
  ON CONFLICT (member_id, catalog_card_id, label) 
  DO UPDATE SET 
    card_data = jsonb_build_object('email', p_email),
    updated_at = now();

  -- Create Phone CARD if provided (contact.phone)
  IF p_phone IS NOT NULL AND p_phone != '' THEN
    INSERT INTO tno_member_cards (member_id, catalog_card_id, card_data, label)
    VALUES (
      p_member_id,
      v_phone_card_id,
      jsonb_build_object('phone', p_phone),
      'Primary'
    )
    ON CONFLICT (member_id, catalog_card_id, label) 
    DO UPDATE SET 
      card_data = jsonb_build_object('phone', p_phone),
      updated_at = now();
  END IF;
END;
$$;

-- Function to get member's identity from their CARDs (profile becomes a view)
CREATE OR REPLACE FUNCTION public.tno_get_member_identity(p_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '{}';
  v_card RECORD;
BEGIN
  FOR v_card IN 
    SELECT mc.card_data, cc.card_key
    FROM tno_member_cards mc
    JOIN tno_card_catalog cc ON cc.card_id = mc.catalog_card_id
    WHERE mc.member_id = p_member_id
      AND mc.label = 'Primary'
  LOOP
    v_result := v_result || v_card.card_data;
  END LOOP;
  
  RETURN v_result;
END;
$$;

-- Function to update a specific CARD type for a member
CREATE OR REPLACE FUNCTION public.tno_update_member_card(
  p_catalog_card_key TEXT,
  p_card_data JSONB,
  p_label TEXT DEFAULT 'Primary'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_catalog_card_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get catalog card ID
  SELECT card_id INTO v_catalog_card_id 
  FROM tno_card_catalog 
  WHERE card_key = p_catalog_card_key;
  
  IF v_catalog_card_id IS NULL THEN
    RAISE EXCEPTION 'Invalid card type: %', p_catalog_card_key;
  END IF;

  -- Update or insert the card
  INSERT INTO tno_member_cards (member_id, catalog_card_id, card_data, label)
  VALUES (v_user_id, v_catalog_card_id, p_card_data, p_label)
  ON CONFLICT (member_id, catalog_card_id, label) 
  DO UPDATE SET 
    card_data = p_card_data,
    updated_at = now();

  RETURN TRUE;
END;
$$;

-- Update tno_accept_invite to create identity CARDs
CREATE OR REPLACE FUNCTION public.tno_accept_invite(p_token text, p_personal_card_json jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  v_inviter_label TEXT;
  v_invitee_label TEXT;
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

  -- Extract relationship labels from relationship_card_json if present
  IF v_invite_link.relationship_card_json IS NOT NULL THEN
    v_inviter_label := v_invite_link.relationship_card_json->>'inviter_label';
    v_invitee_label := v_invite_link.relationship_card_json->>'invitee_label';
  END IF;

  -- Upsert personal card (legacy support)
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

  -- OPN3.010-3: Create discrete identity CARDs from personal card JSON
  PERFORM tno_create_identity_cards(
    v_user_id,
    p_personal_card_json->>'name',
    p_personal_card_json->>'email',
    p_personal_card_json->>'phone'
  );

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

  -- Insert relationship with relationship labels
  INSERT INTO tno_relationships (
    member_a_id, member_b_id, created_from_card_share_id, scenario_id,
    inviter_relationship_label, invitee_relationship_label
  ) VALUES (
    v_member_a_id, v_member_b_id, v_card_share.card_share_id, v_invitation.scenario_id,
    v_inviter_label, v_invitee_label
  ) RETURNING relationship_id INTO v_relationship_id;

  -- Write audit events
  INSERT INTO tno_audit_events (event_type, actor_member_id, subject_member_id, invitation_id, card_share_id)
  VALUES ('invitation.accepted', v_user_id, v_invitation.from_member_id, v_invitation.invitation_id, v_card_share.card_share_id);

  INSERT INTO tno_audit_events (event_type, actor_member_id, subject_member_id, relationship_id, card_share_id)
  VALUES ('relationship.created', v_user_id, v_invitation.from_member_id, v_relationship_id, v_card_share.card_share_id);

  -- If relationship card was proposed, record activation
  IF v_invite_link.relationship_card_json IS NOT NULL THEN
    INSERT INTO tno_audit_events (event_type, actor_member_id, subject_member_id, relationship_id, metadata)
    VALUES ('relationship_card.activated', v_user_id, v_invitation.from_member_id, v_relationship_id, v_invite_link.relationship_card_json);
  END IF;

  RETURN v_relationship_id;
END;
$$;
