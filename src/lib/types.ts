// Opn3 Trust Network Operator Types

export type MemberStatus = 'active' | 'disabled';
export type VerificationLevel = 'assumed_verified';
export type CardType = 'standard';
export type CardStatus = 'active' | 'deprecated';
export type ScenarioStatus = 'active' | 'deprecated';
export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
export type CardShareStatus = 'offered' | 'accepted' | 'revoked';
export type AcceptanceDecision = 'accepted' | 'rejected';
export type RelationshipStatus = 'active' | 'terminated';
export type InviteLinkStatus = 'pending' | 'claimed' | 'accepted' | 'revoked' | 'expired';
export type ShareProposalStatus = 'pending' | 'accepted' | 'declined';

export type AuditEventType = 
  | 'member.created'
  | 'invitation.sent'
  | 'invitation.accepted'
  | 'invitation.rejected'
  | 'relationship.created'
  | 'relationship.revoked'
  | 'invite.created'
  | 'invite.claimed'
  | 'invite.revoked'
  | 'personal_card.created'
  | 'personal_card.updated'
  | 'relationship_card.proposed'
  | 'relationship_card.activated'
  | 'share_proposal.created'
  | 'share_proposal.accepted'
  | 'share_proposal.declined'
  | 'trust_loop.completed'
  | 'shared_card.revoked';

// Extended Card type with revocation status (for UI display)
export interface SharedCardItem {
  card_id: string;
  card: Card;
  position: number;
  revoked_at: string | null;
  revoked_by_member_id: string | null;
}

export interface Member {
  member_id: string;
  handle: string | null;
  email: string;
  status: MemberStatus;
  verification_level: VerificationLevel;
  created_at: string;
}

export interface Card {
  card_id: string;
  card_key: string;
  card_type: CardType;
  title: string;
  summary: string;
  issuer_member_id: string | null;
  status: CardStatus;
  created_at: string;
}

export interface SharingScenario {
  scenario_id: string;
  scenario_key: string;
  title: string;
  description: string;
  status: ScenarioStatus;
  created_at: string;
  cards?: Card[];
}

export interface Invitation {
  invitation_id: string;
  from_member_id: string;
  to_member_id: string | null;
  to_email: string | null;
  scenario_id: string;
  message: string | null;
  status: InvitationStatus;
  created_at: string;
  responded_at: string | null;
  invite_link_id: string | null;
  from_member?: Member;
  to_member?: Member;
  scenario?: SharingScenario;
}

export interface CardShare {
  card_share_id: string;
  invitation_id: string;
  from_member_id: string;
  to_member_id: string;
  scenario_id: string;
  status: CardShareStatus;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  items?: Card[];
}

export interface Acceptance {
  acceptance_id: string;
  invitation_id: string;
  card_share_id: string;
  from_member_id: string;
  to_member_id: string;
  decision: AcceptanceDecision;
  decided_at: string;
  note: string | null;
}

export interface Relationship {
  relationship_id: string;
  member_a_id: string;
  member_b_id: string;
  created_from_card_share_id: string;
  scenario_id: string;
  status: RelationshipStatus;
  created_at: string;
  terminated_at: string | null;
  inviter_relationship_label: string | null;
  invitee_relationship_label: string | null;
  other_member?: Member;
  scenario?: SharingScenario;
  card_share?: CardShare;
}

export interface Revocation {
  revocation_id: string;
  relationship_id: string;
  card_share_id: string;
  revoked_by_member_id: string;
  reason: string | null;
  revoked_at: string;
}

export interface InviteLink {
  id: string;
  token: string;
  inviter_member_id: string;
  invitee_email: string;
  invitee_name: string | null;
  scenario_id: string;
  invitation_card_json: PersonalCardData;
  relationship_card_json: RelationshipCardData | null;
  status: InviteLinkStatus;
  claimed_by_member_id: string | null;
  invitation_id: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  scenario?: SharingScenario;
}

// Alpha-minimal Relationship CARD
// Stores asymmetric relationship labels from inviter perspective
export interface RelationshipCardData {
  inviter_label: string;  // e.g., "Parent of"
  invitee_label: string;  // e.g., "Child of"
}

export interface PersonalCardData {
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  title?: string;
}

export interface PersonalCard {
  id: string;
  member_id: string;
  card_json: PersonalCardData;
  created_at: string;
  updated_at: string;
}

// OPN3.010-3: Member-owned CARD instances (canonical identity source)
export interface MemberCard {
  id: string;
  member_id: string;
  catalog_card_id: string;
  card_data: Record<string, unknown>;
  label: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  catalog_card?: Card;
}

export interface AuditEvent {
  audit_id: string;
  event_type: AuditEventType;
  actor_member_id: string | null;
  subject_member_id: string | null;
  invitation_id: string | null;
  card_share_id: string | null;
  relationship_id: string | null;
  share_proposal_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_member?: Member;
  subject_member?: Member;
}

// OPN3.009: Share Proposals for post-relationship CARD sharing
export interface ShareProposal {
  proposal_id: string;
  relationship_id: string;
  from_member_id: string;
  to_member_id: string;
  scenario_id: string;
  status: ShareProposalStatus;
  message: string | null;
  created_at: string;
  responded_at: string | null;
  note: string | null;
  from_member?: Member;
  to_member?: Member;
  scenario?: SharingScenario;
  cards?: Card[];
}
