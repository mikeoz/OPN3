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
export type AuditEventType = 
  | 'member.created'
  | 'invitation.sent'
  | 'invitation.accepted'
  | 'invitation.rejected'
  | 'relationship.created'
  | 'relationship.revoked';

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
  to_member_id: string;
  scenario_id: string;
  message: string | null;
  status: InvitationStatus;
  created_at: string;
  responded_at: string | null;
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

export interface AuditEvent {
  audit_id: string;
  event_type: AuditEventType;
  actor_member_id: string | null;
  subject_member_id: string | null;
  invitation_id: string | null;
  card_share_id: string | null;
  relationship_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_member?: Member;
  subject_member?: Member;
}
