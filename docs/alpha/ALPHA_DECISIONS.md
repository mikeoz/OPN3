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

## How to Use This Document

- Each new Alpha shortcut must be recorded as a new Decision (A-005, A-006, …)

- Decisions are never deleted or rewritten

- MVP planning must explicitly reference these decisions when removing Alpha scaffolding

This document is part of the Opn3 system architecture.

---

End of v0.1 + OPN3.008
