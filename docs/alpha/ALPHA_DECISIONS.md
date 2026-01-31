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

## How to Use This Document

- Each new Alpha shortcut must be recorded as a new Decision (A-007, A-008, …)

- Decisions are never deleted or rewritten

- MVP planning must explicitly reference these decisions when removing Alpha scaffolding

This document is part of the Opn3 system architecture.

---

End of v0.1 + OPN3.008-3
