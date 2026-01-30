-- Create enums for status types
CREATE TYPE public.member_status AS ENUM ('active', 'disabled');
CREATE TYPE public.verification_level AS ENUM ('assumed_verified');
CREATE TYPE public.card_type AS ENUM ('standard');
CREATE TYPE public.card_status AS ENUM ('active', 'deprecated');
CREATE TYPE public.scenario_status AS ENUM ('active', 'deprecated');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'expired');
CREATE TYPE public.card_share_status AS ENUM ('offered', 'accepted', 'revoked');
CREATE TYPE public.acceptance_decision AS ENUM ('accepted', 'rejected');
CREATE TYPE public.relationship_status AS ENUM ('active', 'terminated');
CREATE TYPE public.audit_event_type AS ENUM (
  'member.created',
  'invitation.sent',
  'invitation.accepted',
  'invitation.rejected',
  'relationship.created',
  'relationship.revoked'
);

-- 1. Members table (thin profile)
CREATE TABLE public.tno_members (
  member_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT,
  email TEXT NOT NULL,
  status public.member_status NOT NULL DEFAULT 'active',
  verification_level public.verification_level NOT NULL DEFAULT 'assumed_verified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tno_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view all members" ON public.tno_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Members can update own profile" ON public.tno_members
  FOR UPDATE TO authenticated USING (auth.uid() = member_id);

CREATE POLICY "Members can insert own profile" ON public.tno_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);

-- 2. CARD Catalog
CREATE TABLE public.tno_card_catalog (
  card_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_key TEXT UNIQUE NOT NULL,
  card_type public.card_type NOT NULL DEFAULT 'standard',
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  issuer_member_id UUID REFERENCES public.tno_members(member_id),
  status public.card_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tno_card_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active cards" ON public.tno_card_catalog
  FOR SELECT TO authenticated USING (status = 'active');

-- 3. Sharing Scenarios
CREATE TABLE public.tno_sharing_scenarios (
  scenario_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status public.scenario_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tno_sharing_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active scenarios" ON public.tno_sharing_scenarios
  FOR SELECT TO authenticated USING (status = 'active');

-- 4. Scenario Cards (junction)
CREATE TABLE public.tno_scenario_cards (
  scenario_id UUID NOT NULL REFERENCES public.tno_sharing_scenarios(scenario_id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.tno_card_catalog(card_id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  PRIMARY KEY (scenario_id, card_id)
);

ALTER TABLE public.tno_scenario_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scenario cards" ON public.tno_scenario_cards
  FOR SELECT TO authenticated USING (true);

-- 5. Invitations
CREATE TABLE public.tno_invitations (
  invitation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_member_id UUID NOT NULL REFERENCES public.tno_members(member_id),
  to_member_id UUID NOT NULL REFERENCES public.tno_members(member_id),
  scenario_id UUID NOT NULL REFERENCES public.tno_sharing_scenarios(scenario_id),
  message TEXT,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

ALTER TABLE public.tno_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their invitations" ON public.tno_invitations
  FOR SELECT TO authenticated 
  USING (auth.uid() = from_member_id OR auth.uid() = to_member_id);

CREATE POLICY "Members can create invitations" ON public.tno_invitations
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = from_member_id);

CREATE POLICY "Recipient can update invitation" ON public.tno_invitations
  FOR UPDATE TO authenticated 
  USING (auth.uid() = to_member_id);

-- 6. Card Shares
CREATE TABLE public.tno_card_shares (
  card_share_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES public.tno_invitations(invitation_id),
  from_member_id UUID NOT NULL REFERENCES public.tno_members(member_id),
  to_member_id UUID NOT NULL REFERENCES public.tno_members(member_id),
  scenario_id UUID NOT NULL REFERENCES public.tno_sharing_scenarios(scenario_id),
  status public.card_share_status NOT NULL DEFAULT 'offered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

ALTER TABLE public.tno_card_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their card shares" ON public.tno_card_shares
  FOR SELECT TO authenticated 
  USING (auth.uid() = from_member_id OR auth.uid() = to_member_id);

CREATE POLICY "Members can create card shares" ON public.tno_card_shares
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = from_member_id);

CREATE POLICY "Members can update their card shares" ON public.tno_card_shares
  FOR UPDATE TO authenticated 
  USING (auth.uid() = from_member_id OR auth.uid() = to_member_id);

-- 7. Card Share Items
CREATE TABLE public.tno_card_share_items (
  card_share_id UUID NOT NULL REFERENCES public.tno_card_shares(card_share_id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.tno_card_catalog(card_id),
  position INT NOT NULL DEFAULT 0,
  PRIMARY KEY (card_share_id, card_id)
);

ALTER TABLE public.tno_card_share_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their share items" ON public.tno_card_share_items
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.tno_card_shares cs 
      WHERE cs.card_share_id = tno_card_share_items.card_share_id 
      AND (cs.from_member_id = auth.uid() OR cs.to_member_id = auth.uid())
    )
  );

CREATE POLICY "Members can insert share items" ON public.tno_card_share_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tno_card_shares cs 
      WHERE cs.card_share_id = tno_card_share_items.card_share_id 
      AND cs.from_member_id = auth.uid()
    )
  );

-- 8. Acceptances
CREATE TABLE public.tno_acceptances (
  acceptance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES public.tno_invitations(invitation_id),
  card_share_id UUID NOT NULL REFERENCES public.tno_card_shares(card_share_id),
  from_member_id UUID NOT NULL REFERENCES public.tno_members(member_id),
  to_member_id UUID NOT NULL REFERENCES public.tno_members(member_id),
  decision public.acceptance_decision NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

ALTER TABLE public.tno_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their acceptances" ON public.tno_acceptances
  FOR SELECT TO authenticated 
  USING (auth.uid() = from_member_id OR auth.uid() = to_member_id);

CREATE POLICY "Recipients can create acceptances" ON public.tno_acceptances
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = to_member_id);

-- 9. Relationships
CREATE TABLE public.tno_relationships (
  relationship_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_a_id UUID NOT NULL REFERENCES public.tno_members(member_id),
  member_b_id UUID NOT NULL REFERENCES public.tno_members(member_id),
  created_from_card_share_id UUID NOT NULL REFERENCES public.tno_card_shares(card_share_id),
  scenario_id UUID NOT NULL REFERENCES public.tno_sharing_scenarios(scenario_id),
  status public.relationship_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  terminated_at TIMESTAMPTZ,
  CONSTRAINT members_ordered CHECK (member_a_id < member_b_id),
  CONSTRAINT unique_relationship UNIQUE (member_a_id, member_b_id, scenario_id)
);

ALTER TABLE public.tno_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their relationships" ON public.tno_relationships
  FOR SELECT TO authenticated 
  USING (auth.uid() = member_a_id OR auth.uid() = member_b_id);

CREATE POLICY "Members can insert relationships" ON public.tno_relationships
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = member_a_id OR auth.uid() = member_b_id);

CREATE POLICY "Members can update their relationships" ON public.tno_relationships
  FOR UPDATE TO authenticated 
  USING (auth.uid() = member_a_id OR auth.uid() = member_b_id);

-- 10. Revocations
CREATE TABLE public.tno_revocations (
  revocation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.tno_relationships(relationship_id),
  card_share_id UUID NOT NULL REFERENCES public.tno_card_shares(card_share_id),
  revoked_by_member_id UUID NOT NULL REFERENCES public.tno_members(member_id),
  reason TEXT,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tno_revocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their revocations" ON public.tno_revocations
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.tno_relationships r 
      WHERE r.relationship_id = tno_revocations.relationship_id 
      AND (r.member_a_id = auth.uid() OR r.member_b_id = auth.uid())
    )
  );

CREATE POLICY "Members can create revocations" ON public.tno_revocations
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = revoked_by_member_id);

-- 11. Audit Events
CREATE TABLE public.tno_audit_events (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type public.audit_event_type NOT NULL,
  actor_member_id UUID REFERENCES public.tno_members(member_id),
  subject_member_id UUID REFERENCES public.tno_members(member_id),
  invitation_id UUID REFERENCES public.tno_invitations(invitation_id),
  card_share_id UUID REFERENCES public.tno_card_shares(card_share_id),
  relationship_id UUID REFERENCES public.tno_relationships(relationship_id),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tno_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their audit events" ON public.tno_audit_events
  FOR SELECT TO authenticated 
  USING (auth.uid() = actor_member_id OR auth.uid() = subject_member_id);

CREATE POLICY "System can insert audit events" ON public.tno_audit_events
  FOR INSERT TO authenticated WITH CHECK (true);

-- Seed Standard CARDs
INSERT INTO public.tno_card_catalog (card_key, title, summary) VALUES
  ('identity.basic', 'Basic Identity', 'Share your name and public profile information'),
  ('contact.email', 'Email Contact', 'Share your email address for communication'),
  ('contact.phone', 'Phone Contact', 'Share your phone number for direct calls'),
  ('location.city', 'City Location', 'Share the city where you are based'),
  ('professional.title', 'Professional Title', 'Share your job title and role'),
  ('professional.company', 'Company Affiliation', 'Share your current company or organization'),
  ('social.linkedin', 'LinkedIn Profile', 'Share your LinkedIn profile URL'),
  ('verification.photo', 'Photo Verification', 'Confirm identity with a verified photo');

-- Seed Sharing Scenarios
INSERT INTO public.tno_sharing_scenarios (scenario_key, title, description) VALUES
  ('networking.basic', 'Basic Networking', 'Exchange basic contact information for professional networking'),
  ('collaboration.project', 'Project Collaboration', 'Share detailed professional info for working together'),
  ('trust.full', 'Full Trust Exchange', 'Complete information sharing for trusted partnerships');

-- Link scenarios to cards
INSERT INTO public.tno_scenario_cards (scenario_id, card_id, position)
SELECT s.scenario_id, c.card_id, 
  CASE c.card_key 
    WHEN 'identity.basic' THEN 1
    WHEN 'contact.email' THEN 2
  END
FROM public.tno_sharing_scenarios s, public.tno_card_catalog c
WHERE s.scenario_key = 'networking.basic' 
  AND c.card_key IN ('identity.basic', 'contact.email');

INSERT INTO public.tno_scenario_cards (scenario_id, card_id, position)
SELECT s.scenario_id, c.card_id, 
  CASE c.card_key 
    WHEN 'identity.basic' THEN 1
    WHEN 'contact.email' THEN 2
    WHEN 'professional.title' THEN 3
    WHEN 'professional.company' THEN 4
    WHEN 'social.linkedin' THEN 5
  END
FROM public.tno_sharing_scenarios s, public.tno_card_catalog c
WHERE s.scenario_key = 'collaboration.project' 
  AND c.card_key IN ('identity.basic', 'contact.email', 'professional.title', 'professional.company', 'social.linkedin');

INSERT INTO public.tno_scenario_cards (scenario_id, card_id, position)
SELECT s.scenario_id, c.card_id, 
  CASE c.card_key 
    WHEN 'identity.basic' THEN 1
    WHEN 'contact.email' THEN 2
    WHEN 'contact.phone' THEN 3
    WHEN 'location.city' THEN 4
    WHEN 'professional.title' THEN 5
    WHEN 'professional.company' THEN 6
    WHEN 'social.linkedin' THEN 7
    WHEN 'verification.photo' THEN 8
  END
FROM public.tno_sharing_scenarios s, public.tno_card_catalog c
WHERE s.scenario_key = 'trust.full';