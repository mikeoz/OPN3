# Opn3 — Alpha Decisions Log (v0.1)

This document records **intentional Alpha Test decisions** for Opn3 (Trust Network Operator).

Alpha decisions are *not* accidents or technical debt.

They are **deliberate scaffolding** used to validate trust lifecycle semantics under controlled conditions.

All Alpha decisions must:

- Name the constraint

- Describe the shortcut taken

- State the implication

- Describe how the decision will be revisited or removed in MVP

---

## Alpha Test Operating Constraints

The Opn3 Alpha operates under the following declared constraints:

- No outbound email, SMS, or push notifications exist

- All user identities use fake or test email addresses

- A single human may play multiple roles (inviter, invitee, administrator)

- All trust lifecycle steps must be observable inside the application

- The goal is to validate **trust mechanics**, not production UX realism

These constraints are intentional and must not be silently "worked around."

---

## Decision A-001: Email auto-confirmation enabled

**Context**  
Supabase email confirmation blocks immediate session creation and interferes with Alpha trust flows.

**Alpha Choice**  
Email auto-confirmation is enabled for all users.

**Implication**  
All users are treated as verified at signup. No verification states are modeled.

**MVP Transition**  
Reintroduce email verification (or alternative verification) and explicitly model verification states in the Trust Network.

---

## Decision A-002: Invitation delivery occurs in-app only

**Context**  
Alpha has no messaging or notification infrastructure.

**Alpha Choice**  
Invitation links are surfaced directly in the UI to the inviter for copying and testing.

**Implication**  
Invitations are treated as trust artifacts, not messages. Delivery is manual.

**MVP Transition**  
Replace in-app surfacing with outbound email/SMS delivery while preserving the underlying invitation and acceptance model.

---

## Decision A-003: Invitation CARD used as Personal CARD seed

**Context**  
Non-members must be able to join with starter information but have no prior Personal CARD.

**Alpha Choice**  
An Invitation CARD contains editable starter information that is converted into the invitee's Personal CARD during acceptance.

**Implication**  
Personal CARD creation is implicit and occurs during the invitation acceptance flow.

**MVP Transition**  
Support explicit Personal CARD creation, editing, versioning, and multiple CARD types independent of invitations.

---

## Decision A-004: Invitation acceptance requires authentication

**Context**  
Row-Level Security and auditability require a known actor for trust events.

**Alpha Choice**  
Invite links require the invitee to authenticate before an invitation can be claimed or accepted.

**Implication**  
Anonymous invitation browsing is not supported.

**MVP Transition**  
Consider email magic-link authentication or signed, time-bound invitation claims.

---

## Decision A-005: Relationship CARDs are minimal and preset-based

**Context**  
Alpha requires demonstrating asymmetric relationships without a full ontology or validation.

**Alpha Choice**  
Relationship CARDs contain only two labels (inviter_label and invitee_label) with preset options. No role validation, family tree inference, or permission enforcement occurs.

**Implication**  
Relationships are declarative only. The system records the declared relationship but does not validate correctness or enforce derived permissions.

**MVP Transition**  
Extend Relationship CARDs with structured types, optional validation, and permission inference based on relationship type.

---

## Decision A-006: Alpha persona-switch UI hints

**Context**  
Alpha testing requires one tester to play both inviter and invitee roles in a single browser session.

**Alpha Choice**  
Temporary UI affordances added to support persona switching:
- Screen 7 (Invite Link Ready): Primary "Continue as Invitee (Alpha Test)" button navigates to join link in same session; "Create Another Invite" disabled with MVP tooltip.
- Screen 8 (Join Invitation): Explicit framing that user is acting as invitee; separate "Sign In" and "Create Account" buttons; Alpha Test Tip explaining account choice.
- Screen 9 (Success): Completion panel with "Continue to Share Back (Alpha)" shortcut.

**Implication**  
These hints are temporary Alpha scaffolding and will be removed in MVP when invitations are delivered externally and testers do not need to manually switch personas.

**MVP Transition**  
Remove all Alpha Test Tips, persona switch buttons, and disabled-feature tooltips. Restore standard "Create Another Invite" functionality.

---

## Decision A-007: Alpha persona switch requires auth reset

**Context**  
Alpha testing requires one tester to play both inviter and invitee roles. Backend self-claim protections correctly block an inviter from claiming their own invitation.

**Alpha Choice**  
When clicking "Continue as Invitee (Alpha Test)", the system:
1. Explicitly signs out the current authenticated user (inviter)
2. Redirects to the invitation join URL with an `alpha_switch=true` flag
3. Displays a clear notice that the inviter session was ended intentionally

The Join page (Screen 8) shows a "Persona Switch Complete" notice when this flag is present, guiding the tester to authenticate as a different user.

**Implication**  
This is a testing convenience that does not bypass or weaken backend self-claim protections. The auth reset forces the tester to authenticate as a different user before claiming the invitation.

**MVP Transition**  
Remove the `alpha_switch` parameter handling and the auth reset behavior. In production, invitations will be delivered externally and self-claim protections will simply block invalid attempts without special UX handling.

---

## Decision A-008: Inline authentication on Join Invitation screen

**Context**  
Alpha testing requires seamless persona switching. Redirecting to a separate Auth page with complex query parameters caused navigation failures and test dead-ends.

**Alpha Choice**  
The Join Invitation screen (Screen 8) now includes inline authentication forms for both "Create Account" and "Sign In". Account creation automatically authenticates the user and continues directly to invitation acceptance without a redirect.

**Implication**  
The Join page handles authentication internally, avoiding URL parameter parsing issues. The user experience is streamlined for Alpha testing where quick persona switching is essential.

**MVP Transition**  
Consider whether inline auth on the Join page provides a better UX for production users, or whether integration with the main Auth flow (with proper redirect handling) is preferred.

---

## Decision A-009: Invitation Join prefills data and ensures Member before claim

**Context**  
The invite claim RPC requires a valid Member row (FK constraint). Alpha testing revealed that the claim was attempted before member creation completed, causing FK violations. Additionally, inviter-provided invitee data was not visible until after claiming.

**Alpha Choice**  
The Join Invitation flow now:
1. Fetches a preview of the invitation (via `tno_preview_invite` RPC) before authentication to prefill the auth form with inviter-provided name and email
2. After successful authentication, explicitly ensures a Member row exists before calling the claim RPC
3. Shows clear Alpha copy explaining that the inviter has provided starting information

**Implication**  
Auth forms are prefilled with inviter-proposed data. Member creation is guaranteed before claim. This maintains FK integrity while providing trust continuity (inviter proposes → invitee owns).

**MVP Transition**  
Consider whether prefill behavior should persist in production or if invitees should always enter their own information fresh.

---

## Decision A-010: OPN3.008 scope closes at relationship acceptance

**Context**  
OPN3.008 Alpha successfully demonstrates the complete invitation lifecycle: Invite → Persona Switch → Authenticate → Claim → Accept → Relationship Created.

**Alpha Choice**  
Relationship acceptance is declared the terminal state for OPN3.008. The "Continue to Share Back (Alpha)" button explicitly labels the next phase as OPN3.009.

**Implication**  
Share-back, CARD exchange, and ongoing relationship management are explicitly out of scope for this thread. Any further UX beyond the Relationship Created screen belongs to subsequent threads.

**MVP Transition**  
Thread boundaries will be replaced by a continuous user flow where relationship creation naturally leads into CARD sharing without explicit phase markers.

---

## Decision A-011: Share Back is the second trust act

**Context**  
OPN3.009 implements Share Back functionality allowing members to propose CARD sharing within an existing relationship.

**Alpha Choice**  
Share Back is a separate, explicit trust act. Relationship creation alone does not grant data access. The recipient must explicitly accept the share proposal to complete the trust loop.

**Mechanics**  
1. Member initiates "Share Back" from an active relationship
2. Member selects CARDs to propose sharing
3. Proposal is created and recipient sees it in Inbox
4. Recipient can accept (trust loop completed) or decline
5. All transitions are audited

**Implication**  
Trust is always bidirectional and requires explicit consent at each step. A relationship is a container for potential sharing, not automatic access.

**MVP Transition**  
Share Back may be streamlined into the initial invitation flow, allowing bidirectional sharing proposals from the start. The core principle of explicit consent for each share direction will be preserved.

---

## Decision A-012: Per-CARD revocation without relationship termination

**Context**  
OPN3.010 implements trust revocation mechanics. Members need to control data access granularly without destroying relationships.

**Alpha Choice**  
Revocation operates at the individual CARD level within accepted share proposals:
1. A sharing member can revoke access to specific CARDs
2. Revocation is immediate and removes recipient access
3. Other shared CARDs remain accessible
4. The underlying relationship remains active
5. Both members can see the revocation status

**Implication**  
Trust decay is granular and does not require relationship termination. This supports real-world scenarios where data access may need adjustment while maintaining the connection context.

**MVP Transition**  
Consider adding:
- Re-sharing flows to restore previously revoked CARDs
- Bulk revocation options
- Time-based expiration as an alternative to explicit revocation

---

## Decision A-013: CARD-native identity authority

**Context**  
OPN3.010-3 establishes CARDs as the canonical source of identity data, replacing the implicit treatment of identity as profile fields.

**Alpha Choice**  
Identity attributes are now stored in discrete CARD instances:
1. `identity.basic` CARD stores name/display identity
2. `contact.email` CARD stores email address
3. `contact.phone` CARD stores phone number (optional)

Each CARD has its own `card_id`, is owned by the member, and can be independently shared or revoked.

**Implementation**  
- `tno_member_cards` table stores member-owned CARD instances
- Identity CARDs are created on account creation and invitation acceptance
- Profile rendering reads from CARDs via `tno_get_member_identity()` RPC
- Profile edits update underlying CARDs via `tno_update_member_card()` RPC
- Legacy `tno_personal_cards` table retained for backward compatibility

**Implication**  
Identity data exists only in CARDs. A user can share/revoke email without affecting name or phone. This establishes the foundation for CARD-centric trust controls.

**MVP Transition**  
Fully deprecate `tno_personal_cards`. Add CARD versioning, multiple instances per type (e.g., work email, personal email), and CARD stacking for composite identities.

---

## Decision A-014: Instance-level CARD sharing

**Context**  
OPN3.010-4 makes CARD sharing testable by ensuring share proposals reference actual member-owned CARD instances rather than just catalog types.

**Alpha Choice**  
Share proposals now reference specific member CARD instances:
1. `tno_share_proposal_items.member_card_id` references the actual `tno_member_cards.id`
2. The ShareBack UI shows the member's owned CARDs with their actual values
3. Revocation operates on the shared instance, not the catalog type
4. Recipients can see the actual data values being shared (e.g., "Email Contact (gerry@example.com)")

**Implementation**  
- Added `member_card_id` column to `tno_share_proposal_items`
- Updated `tno_create_share_proposal` RPC to accept member_card_ids
- ShareBack page fetches from `tno_member_cards` instead of `tno_card_catalog`
- RelationshipDetail and Inbox show actual card data values alongside card type

**Implication**  
Sharing is now instance-scoped. A member shares "this specific email CARD" not "the concept of an email CARD." This enables:
- Gerry shares Email CARD to Brad → Brad sees the actual email value
- Gerry revokes that specific CARD → Brad loses access immediately
- Relationship remains active, other shared CARDs unaffected

**MVP Transition**  
Support re-sharing previously revoked CARDs, CARD versioning (update a value, recipients see new version), and explicit consent for viewing updated values.

---

## Decision A-015: CARD lifecycle with supersession model

**Context**  
OPN3.011-0 implements CARD lifecycle primitives establishing identity as authoritative, versioned, and independent of trust sharing.

**Alpha Choice**  
CARDs use a supersession model for non-mutating edits:
1. Editing a CARD creates a new instance and marks the original as superseded
2. `superseded_by` and `superseded_at` columns track lineage
3. `is_current` boolean enables efficient querying of active CARDs
4. Labels (e.g., "Primary", "Work") can be changed without creating supersession
5. Full lineage is preserved and readable via `tno_get_card_lineage()` RPC

**Implementation**  
- Added `superseded_by`, `superseded_at`, `is_current` to `tno_member_cards`
- `tno_create_member_card()` explicitly creates new CARD instances
- `tno_supersede_member_card()` creates new version, marks old as superseded
- `tno_update_card_label()` changes label without supersession
- `tno_get_card_lineage()` returns full version chain from original to current
- Identity page at `/identity` provides UI for creation, supersession, label editing, and lineage viewing

**Implication**  
Identity data is immutable—edits create new versions. This enables:
- Full audit trail of all identity changes
- Point-in-time queries for shared CARD values
- Clear provenance from original to current
- No ambiguity about what data was shared at what time

**MVP Transition**  
Consider adding:
- Automatic propagation options (notify recipients when CARD is superseded)
- Consent flows for recipients to view updated versions
- Archive/delete capabilities for superseded CARDs after retention period

---

## How to Use This Document

- Each new Alpha shortcut must be recorded as a new Decision (A-016, A-017, …)

- Decisions are never deleted or rewritten

- MVP planning must explicitly reference these decisions when removing Alpha scaffolding

This document is part of the Opn3 system architecture.

---

End of v0.1 + OPN3.011-0
