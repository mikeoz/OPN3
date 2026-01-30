-- OPN3.008: Relationship CARDs (Alpha)
-- Add minimal Relationship CARD support to enable asymmetric relationship declarations at invitation time

-- Add relationship_card_json to tno_invite_links
-- This stores the inviter's declaration of the relationship (e.g., "I am parent of invitee")
ALTER TABLE public.tno_invite_links
ADD COLUMN relationship_card_json jsonb DEFAULT NULL;

COMMENT ON COLUMN public.tno_invite_links.relationship_card_json IS 'Asymmetric relationship declaration from inviter perspective';

-- Add relationship_card_json to tno_relationships
-- This stores the activated relationship card data for both parties
ALTER TABLE public.tno_relationships
ADD COLUMN inviter_relationship_label text DEFAULT NULL,
ADD COLUMN invitee_relationship_label text DEFAULT NULL;

COMMENT ON COLUMN public.tno_relationships.inviter_relationship_label IS 'How the inviter describes their role (e.g., "Parent of")';
COMMENT ON COLUMN public.tno_relationships.invitee_relationship_label IS 'How the invitee describes their role (e.g., "Child of")';

-- Add new audit event type for relationship card
ALTER TYPE public.audit_event_type ADD VALUE IF NOT EXISTS 'relationship_card.proposed';
ALTER TYPE public.audit_event_type ADD VALUE IF NOT EXISTS 'relationship_card.activated';

-- Update tno_claim_invite to return relationship_card_json
CREATE OR REPLACE FUNCTION public.tno_claim_invite(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'relationship_card_json', v_invite_link.relationship_card_json,
    'invitee_name', v_invite_link.invitee_name,
    'invitee_email', v_invite_link.invitee_email
  );
END;
$function$;

-- Update tno_accept_invite to store relationship card data
CREATE OR REPLACE FUNCTION public.tno_accept_invite(p_token text, p_personal_card_json jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;