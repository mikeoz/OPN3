export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      tno_acceptances: {
        Row: {
          acceptance_id: string
          card_share_id: string
          decided_at: string
          decision: Database["public"]["Enums"]["acceptance_decision"]
          from_member_id: string
          invitation_id: string
          note: string | null
          to_member_id: string
        }
        Insert: {
          acceptance_id?: string
          card_share_id: string
          decided_at?: string
          decision: Database["public"]["Enums"]["acceptance_decision"]
          from_member_id: string
          invitation_id: string
          note?: string | null
          to_member_id: string
        }
        Update: {
          acceptance_id?: string
          card_share_id?: string
          decided_at?: string
          decision?: Database["public"]["Enums"]["acceptance_decision"]
          from_member_id?: string
          invitation_id?: string
          note?: string | null
          to_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tno_acceptances_card_share_id_fkey"
            columns: ["card_share_id"]
            isOneToOne: false
            referencedRelation: "tno_card_shares"
            referencedColumns: ["card_share_id"]
          },
          {
            foreignKeyName: "tno_acceptances_from_member_id_fkey"
            columns: ["from_member_id"]
            isOneToOne: false
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tno_acceptances_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "tno_invitations"
            referencedColumns: ["invitation_id"]
          },
          {
            foreignKeyName: "tno_acceptances_to_member_id_fkey"
            columns: ["to_member_id"]
            isOneToOne: false
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      tno_audit_events: {
        Row: {
          actor_member_id: string | null
          audit_id: string
          card_share_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["audit_event_type"]
          invitation_id: string | null
          metadata: Json | null
          relationship_id: string | null
          share_proposal_id: string | null
          subject_member_id: string | null
        }
        Insert: {
          actor_member_id?: string | null
          audit_id?: string
          card_share_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["audit_event_type"]
          invitation_id?: string | null
          metadata?: Json | null
          relationship_id?: string | null
          share_proposal_id?: string | null
          subject_member_id?: string | null
        }
        Update: {
          actor_member_id?: string | null
          audit_id?: string
          card_share_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["audit_event_type"]
          invitation_id?: string | null
          metadata?: Json | null
          relationship_id?: string | null
          share_proposal_id?: string | null
          subject_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tno_audit_events_actor_member_id_fkey"
            columns: ["actor_member_id"]
            isOneToOne: false
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tno_audit_events_card_share_id_fkey"
            columns: ["card_share_id"]
            isOneToOne: false
            referencedRelation: "tno_card_shares"
            referencedColumns: ["card_share_id"]
          },
          {
            foreignKeyName: "tno_audit_events_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "tno_invitations"
            referencedColumns: ["invitation_id"]
          },
          {
            foreignKeyName: "tno_audit_events_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "tno_relationships"
            referencedColumns: ["relationship_id"]
          },
          {
            foreignKeyName: "tno_audit_events_share_proposal_id_fkey"
            columns: ["share_proposal_id"]
            isOneToOne: false
            referencedRelation: "tno_share_proposals"
            referencedColumns: ["proposal_id"]
          },
          {
            foreignKeyName: "tno_audit_events_subject_member_id_fkey"
            columns: ["subject_member_id"]
            isOneToOne: false
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      tno_card_catalog: {
        Row: {
          card_id: string
          card_key: string
          card_type: Database["public"]["Enums"]["card_type"]
          created_at: string
          issuer_member_id: string | null
          status: Database["public"]["Enums"]["card_status"]
          summary: string
          title: string
        }
        Insert: {
          card_id?: string
          card_key: string
          card_type?: Database["public"]["Enums"]["card_type"]
          created_at?: string
          issuer_member_id?: string | null
          status?: Database["public"]["Enums"]["card_status"]
          summary: string
          title: string
        }
        Update: {
          card_id?: string
          card_key?: string
          card_type?: Database["public"]["Enums"]["card_type"]
          created_at?: string
          issuer_member_id?: string | null
          status?: Database["public"]["Enums"]["card_status"]
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tno_card_catalog_issuer_member_id_fkey"
            columns: ["issuer_member_id"]
            isOneToOne: false
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      tno_card_share_items: {
        Row: {
          card_id: string
          card_share_id: string
          position: number
        }
        Insert: {
          card_id: string
          card_share_id: string
          position?: number
        }
        Update: {
          card_id?: string
          card_share_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "tno_card_share_items_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "tno_card_catalog"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "tno_card_share_items_card_share_id_fkey"
            columns: ["card_share_id"]
            isOneToOne: false
            referencedRelation: "tno_card_shares"
            referencedColumns: ["card_share_id"]
          },
        ]
      }
      tno_card_shares: {
        Row: {
          accepted_at: string | null
          card_share_id: string
          created_at: string
          from_member_id: string
          invitation_id: string
          revoked_at: string | null
          scenario_id: string
          status: Database["public"]["Enums"]["card_share_status"]
          to_member_id: string
        }
        Insert: {
          accepted_at?: string | null
          card_share_id?: string
          created_at?: string
          from_member_id: string
          invitation_id: string
          revoked_at?: string | null
          scenario_id: string
          status?: Database["public"]["Enums"]["card_share_status"]
          to_member_id: string
        }
        Update: {
          accepted_at?: string | null
          card_share_id?: string
          created_at?: string
          from_member_id?: string
          invitation_id?: string
          revoked_at?: string | null
          scenario_id?: string
          status?: Database["public"]["Enums"]["card_share_status"]
          to_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tno_card_shares_from_member_id_fkey"
            columns: ["from_member_id"]
            isOneToOne: false
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tno_card_shares_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "tno_invitations"
            referencedColumns: ["invitation_id"]
          },
          {
            foreignKeyName: "tno_card_shares_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "tno_sharing_scenarios"
            referencedColumns: ["scenario_id"]
          },
          {
            foreignKeyName: "tno_card_shares_to_member_id_fkey"
            columns: ["to_member_id"]
            isOneToOne: false
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      tno_invitations: {
        Row: {
          created_at: string
          from_member_id: string
          invitation_id: string
          invite_link_id: string | null
          message: string | null
          responded_at: string | null
          scenario_id: string
          status: Database["public"]["Enums"]["invitation_status"]
          to_email: string | null
          to_member_id: string | null
        }
        Insert: {
          created_at?: string
          from_member_id: string
          invitation_id?: string
          invite_link_id?: string | null
          message?: string | null
          responded_at?: string | null
          scenario_id: string
          status?: Database["public"]["Enums"]["invitation_status"]
          to_email?: string | null
          to_member_id?: string | null
        }
        Update: {
          created_at?: string
          from_member_id?: string
          invitation_id?: string
          invite_link_id?: string | null
          message?: string | null
          responded_at?: string | null
          scenario_id?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          to_email?: string | null
          to_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tno_invitations_from_member_id_fkey"
            columns: ["from_member_id"]
            isOneToOne: false
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tno_invitations_invite_link_id_fkey"
            columns: ["invite_link_id"]
            isOneToOne: false
            referencedRelation: "tno_invite_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tno_invitations_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "tno_sharing_scenarios"
            referencedColumns: ["scenario_id"]
          },
          {
            foreignKeyName: "tno_invitations_to_member_id_fkey"
            columns: ["to_member_id"]
            isOneToOne: false
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      tno_invite_links: {
        Row: {
          claimed_by_member_id: string | null
          created_at: string
          expires_at: string
          id: string
          invitation_card_json: Json
          invitation_id: string | null
          invitee_email: string
          invitee_name: string | null
          inviter_member_id: string
          relationship_card_json: Json | null
          revoked_at: string | null
          scenario_id: string
          status: Database["public"]["Enums"]["invite_link_status"]
          token: string
        }
        Insert: {
          claimed_by_member_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invitation_card_json: Json
          invitation_id?: string | null
          invitee_email: string
          invitee_name?: string | null
          inviter_member_id: string
          relationship_card_json?: Json | null
          revoked_at?: string | null
          scenario_id: string
          status?: Database["public"]["Enums"]["invite_link_status"]
          token?: string
        }
        Update: {
          claimed_by_member_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invitation_card_json?: Json
          invitation_id?: string | null
          invitee_email?: string
          invitee_name?: string | null
          inviter_member_id?: string
          relationship_card_json?: Json | null
          revoked_at?: string | null
          scenario_id?: string
          status?: Database["public"]["Enums"]["invite_link_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "tno_invite_links_claimed_by_member_id_fkey"
            columns: ["claimed_by_member_id"]
            isOneToOne: false
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tno_invite_links_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "tno_invitations"
            referencedColumns: ["invitation_id"]
          },
          {
            foreignKeyName: "tno_invite_links_inviter_member_id_fkey"
            columns: ["inviter_member_id"]
            isOneToOne: false
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tno_invite_links_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "tno_sharing_scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
      }
      tno_member_cards: {
        Row: {
          card_data: Json
          catalog_card_id: string
          created_at: string
          id: string
          label: string | null
          member_id: string
          updated_at: string
        }
        Insert: {
          card_data: Json
          catalog_card_id: string
          created_at?: string
          id?: string
          label?: string | null
          member_id: string
          updated_at?: string
        }
        Update: {
          card_data?: Json
          catalog_card_id?: string
          created_at?: string
          id?: string
          label?: string | null
          member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tno_member_cards_catalog_card_id_fkey"
            columns: ["catalog_card_id"]
            isOneToOne: false
            referencedRelation: "tno_card_catalog"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "tno_member_cards_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      tno_members: {
        Row: {
          created_at: string
          email: string
          handle: string | null
          member_id: string
          status: Database["public"]["Enums"]["member_status"]
          verification_level: Database["public"]["Enums"]["verification_level"]
        }
        Insert: {
          created_at?: string
          email: string
          handle?: string | null
          member_id: string
          status?: Database["public"]["Enums"]["member_status"]
          verification_level?: Database["public"]["Enums"]["verification_level"]
        }
        Update: {
          created_at?: string
          email?: string
          handle?: string | null
          member_id?: string
          status?: Database["public"]["Enums"]["member_status"]
          verification_level?: Database["public"]["Enums"]["verification_level"]
        }
        Relationships: []
      }
      tno_personal_cards: {
        Row: {
          card_json: Json
          created_at: string
          id: string
          member_id: string
          updated_at: string
        }
        Insert: {
          card_json: Json
          created_at?: string
          id?: string
          member_id: string
          updated_at?: string
        }
        Update: {
          card_json?: Json
          created_at?: string
          id?: string
          member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tno_personal_cards_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      tno_relationships: {
        Row: {
          created_at: string
          created_from_card_share_id: string
          invitee_relationship_label: string | null
          inviter_relationship_label: string | null
          member_a_id: string
          member_b_id: string
          relationship_id: string
          scenario_id: string
          status: Database["public"]["Enums"]["relationship_status"]
          terminated_at: string | null
        }
        Insert: {
          created_at?: string
          created_from_card_share_id: string
          invitee_relationship_label?: string | null
          inviter_relationship_label?: string | null
          member_a_id: string
          member_b_id: string
          relationship_id?: string
          scenario_id: string
          status?: Database["public"]["Enums"]["relationship_status"]
          terminated_at?: string | null
        }
        Update: {
          created_at?: string
          created_from_card_share_id?: string
          invitee_relationship_label?: string | null
          inviter_relationship_label?: string | null
          member_a_id?: string
          member_b_id?: string
          relationship_id?: string
          scenario_id?: string
          status?: Database["public"]["Enums"]["relationship_status"]
          terminated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tno_relationships_created_from_card_share_id_fkey"
            columns: ["created_from_card_share_id"]
            isOneToOne: false
            referencedRelation: "tno_card_shares"
            referencedColumns: ["card_share_id"]
          },
          {
            foreignKeyName: "tno_relationships_member_a_id_fkey"
            columns: ["member_a_id"]
            isOneToOne: false
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tno_relationships_member_b_id_fkey"
            columns: ["member_b_id"]
            isOneToOne: false
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tno_relationships_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "tno_sharing_scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
      }
      tno_revocations: {
        Row: {
          card_share_id: string
          reason: string | null
          relationship_id: string
          revocation_id: string
          revoked_at: string
          revoked_by_member_id: string
        }
        Insert: {
          card_share_id: string
          reason?: string | null
          relationship_id: string
          revocation_id?: string
          revoked_at?: string
          revoked_by_member_id: string
        }
        Update: {
          card_share_id?: string
          reason?: string | null
          relationship_id?: string
          revocation_id?: string
          revoked_at?: string
          revoked_by_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tno_revocations_card_share_id_fkey"
            columns: ["card_share_id"]
            isOneToOne: false
            referencedRelation: "tno_card_shares"
            referencedColumns: ["card_share_id"]
          },
          {
            foreignKeyName: "tno_revocations_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "tno_relationships"
            referencedColumns: ["relationship_id"]
          },
          {
            foreignKeyName: "tno_revocations_revoked_by_member_id_fkey"
            columns: ["revoked_by_member_id"]
            isOneToOne: false
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      tno_scenario_cards: {
        Row: {
          card_id: string
          position: number
          scenario_id: string
        }
        Insert: {
          card_id: string
          position?: number
          scenario_id: string
        }
        Update: {
          card_id?: string
          position?: number
          scenario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tno_scenario_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "tno_card_catalog"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "tno_scenario_cards_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "tno_sharing_scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
      }
      tno_share_proposal_items: {
        Row: {
          card_id: string
          position: number
          proposal_id: string
          revoked_at: string | null
          revoked_by_member_id: string | null
        }
        Insert: {
          card_id: string
          position?: number
          proposal_id: string
          revoked_at?: string | null
          revoked_by_member_id?: string | null
        }
        Update: {
          card_id?: string
          position?: number
          proposal_id?: string
          revoked_at?: string | null
          revoked_by_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tno_share_proposal_items_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "tno_card_catalog"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "tno_share_proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "tno_share_proposals"
            referencedColumns: ["proposal_id"]
          },
          {
            foreignKeyName: "tno_share_proposal_items_revoked_by_member_id_fkey"
            columns: ["revoked_by_member_id"]
            isOneToOne: false
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      tno_share_proposals: {
        Row: {
          created_at: string
          from_member_id: string
          message: string | null
          note: string | null
          proposal_id: string
          relationship_id: string
          responded_at: string | null
          scenario_id: string
          status: Database["public"]["Enums"]["share_proposal_status"]
          to_member_id: string
        }
        Insert: {
          created_at?: string
          from_member_id: string
          message?: string | null
          note?: string | null
          proposal_id?: string
          relationship_id: string
          responded_at?: string | null
          scenario_id: string
          status?: Database["public"]["Enums"]["share_proposal_status"]
          to_member_id: string
        }
        Update: {
          created_at?: string
          from_member_id?: string
          message?: string | null
          note?: string | null
          proposal_id?: string
          relationship_id?: string
          responded_at?: string | null
          scenario_id?: string
          status?: Database["public"]["Enums"]["share_proposal_status"]
          to_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tno_share_proposals_from_member_id_fkey"
            columns: ["from_member_id"]
            isOneToOne: false
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tno_share_proposals_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "tno_relationships"
            referencedColumns: ["relationship_id"]
          },
          {
            foreignKeyName: "tno_share_proposals_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "tno_sharing_scenarios"
            referencedColumns: ["scenario_id"]
          },
          {
            foreignKeyName: "tno_share_proposals_to_member_id_fkey"
            columns: ["to_member_id"]
            isOneToOne: false
            referencedRelation: "tno_members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      tno_sharing_scenarios: {
        Row: {
          created_at: string
          description: string
          scenario_id: string
          scenario_key: string
          status: Database["public"]["Enums"]["scenario_status"]
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          scenario_id?: string
          scenario_key: string
          status?: Database["public"]["Enums"]["scenario_status"]
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          scenario_id?: string
          scenario_key?: string
          status?: Database["public"]["Enums"]["scenario_status"]
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      tno_accept_invite: {
        Args: { p_personal_card_json: Json; p_token: string }
        Returns: string
      }
      tno_accept_share_proposal: {
        Args: { p_note?: string; p_proposal_id: string }
        Returns: boolean
      }
      tno_claim_invite: { Args: { p_token: string }; Returns: Json }
      tno_create_identity_cards: {
        Args: {
          p_email: string
          p_member_id: string
          p_name: string
          p_phone?: string
        }
        Returns: undefined
      }
      tno_create_share_proposal: {
        Args: {
          p_card_ids: string[]
          p_message?: string
          p_relationship_id: string
          p_scenario_id: string
          p_to_member_id: string
        }
        Returns: string
      }
      tno_decline_share_proposal: {
        Args: { p_note?: string; p_proposal_id: string }
        Returns: boolean
      }
      tno_get_member_identity: { Args: { p_member_id: string }; Returns: Json }
      tno_preview_invite: { Args: { p_token: string }; Returns: Json }
      tno_revoke_invite: {
        Args: { p_invite_link_id: string; p_reason?: string }
        Returns: boolean
      }
      tno_revoke_shared_card: {
        Args: { p_card_id: string; p_proposal_id: string; p_reason?: string }
        Returns: boolean
      }
      tno_update_member_card: {
        Args: {
          p_card_data: Json
          p_catalog_card_key: string
          p_label?: string
        }
        Returns: boolean
      }
    }
    Enums: {
      acceptance_decision: "accepted" | "rejected"
      audit_event_type:
        | "member.created"
        | "invitation.sent"
        | "invitation.accepted"
        | "invitation.rejected"
        | "relationship.created"
        | "relationship.revoked"
        | "invite.created"
        | "invite.claimed"
        | "invite.revoked"
        | "personal_card.created"
        | "personal_card.updated"
        | "relationship_card.proposed"
        | "relationship_card.activated"
        | "share_proposal.created"
        | "share_proposal.accepted"
        | "share_proposal.declined"
        | "trust_loop.completed"
        | "shared_card.revoked"
      card_share_status: "offered" | "accepted" | "revoked"
      card_status: "active" | "deprecated"
      card_type: "standard"
      invitation_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "cancelled"
        | "expired"
      invite_link_status:
        | "pending"
        | "claimed"
        | "accepted"
        | "revoked"
        | "expired"
      member_status: "active" | "disabled"
      relationship_status: "active" | "terminated"
      scenario_status: "active" | "deprecated"
      share_proposal_status: "pending" | "accepted" | "declined"
      verification_level: "assumed_verified"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      acceptance_decision: ["accepted", "rejected"],
      audit_event_type: [
        "member.created",
        "invitation.sent",
        "invitation.accepted",
        "invitation.rejected",
        "relationship.created",
        "relationship.revoked",
        "invite.created",
        "invite.claimed",
        "invite.revoked",
        "personal_card.created",
        "personal_card.updated",
        "relationship_card.proposed",
        "relationship_card.activated",
        "share_proposal.created",
        "share_proposal.accepted",
        "share_proposal.declined",
        "trust_loop.completed",
        "shared_card.revoked",
      ],
      card_share_status: ["offered", "accepted", "revoked"],
      card_status: ["active", "deprecated"],
      card_type: ["standard"],
      invitation_status: [
        "pending",
        "accepted",
        "rejected",
        "cancelled",
        "expired",
      ],
      invite_link_status: [
        "pending",
        "claimed",
        "accepted",
        "revoked",
        "expired",
      ],
      member_status: ["active", "disabled"],
      relationship_status: ["active", "terminated"],
      scenario_status: ["active", "deprecated"],
      share_proposal_status: ["pending", "accepted", "declined"],
      verification_level: ["assumed_verified"],
    },
  },
} as const
