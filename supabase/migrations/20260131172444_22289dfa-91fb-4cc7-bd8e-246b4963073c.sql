-- Create a public function to preview invite link details (no auth required)
-- This allows prefilling auth forms before claiming
CREATE OR REPLACE FUNCTION public.tno_preview_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_invite_link tno_invite_links%ROWTYPE;
  v_inviter tno_members%ROWTYPE;
  v_scenario tno_sharing_scenarios%ROWTYPE;
BEGIN
  -- Get the invite link (no auth check - this is preview only)
  SELECT * INTO v_invite_link
  FROM tno_invite_links
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'error_message', 'Invalid invitation token'
    );
  END IF;

  IF v_invite_link.status NOT IN ('pending', 'claimed') THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'error_message', 'Invitation has already been ' || v_invite_link.status
    );
  END IF;

  IF v_invite_link.expires_at < now() THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'error_message', 'Invitation has expired'
    );
  END IF;

  -- Get inviter info
  SELECT * INTO v_inviter FROM tno_members WHERE member_id = v_invite_link.inviter_member_id;

  -- Get scenario info
  SELECT * INTO v_scenario FROM tno_sharing_scenarios WHERE scenario_id = v_invite_link.scenario_id;

  RETURN jsonb_build_object(
    'is_valid', true,
    'inviter_handle', v_inviter.handle,
    'inviter_email', v_inviter.email,
    'invitee_name', v_invite_link.invitee_name,
    'invitee_email', v_invite_link.invitee_email,
    'scenario_title', v_scenario.title
  );
END;
$$;