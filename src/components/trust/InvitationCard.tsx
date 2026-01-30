import { useState } from 'react';
import { Invitation, Card as CardType } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import { CardBadge } from './CardBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Send, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface InvitationCardProps {
  invitation: Invitation;
  cards: CardType[];
  onAction: () => void;
}

export function InvitationCard({ invitation, cards, onAction }: InvitationCardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  
  const isRecipient = user?.id === invitation.to_member_id;
  const fromMember = invitation.from_member;

  const handleAccept = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get the card share for this invitation
      const { data: cardShare } = await supabase
        .from('tno_card_shares')
        .select('*')
        .eq('invitation_id', invitation.invitation_id)
        .single();

      if (!cardShare) throw new Error('Card share not found');

      // Create acceptance
      await supabase.from('tno_acceptances').insert({
        invitation_id: invitation.invitation_id,
        card_share_id: cardShare.card_share_id,
        from_member_id: invitation.from_member_id,
        to_member_id: invitation.to_member_id,
        decision: 'accepted',
      });

      // Update invitation status
      await supabase
        .from('tno_invitations')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('invitation_id', invitation.invitation_id);

      // Update card share status
      await supabase
        .from('tno_card_shares')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('card_share_id', cardShare.card_share_id);

      // Create relationship with canonical member ordering
      const [member_a_id, member_b_id] = 
        invitation.from_member_id < invitation.to_member_id
          ? [invitation.from_member_id, invitation.to_member_id]
          : [invitation.to_member_id, invitation.from_member_id];

      const { data: relationship } = await supabase
        .from('tno_relationships')
        .insert({
          member_a_id,
          member_b_id,
          created_from_card_share_id: cardShare.card_share_id,
          scenario_id: invitation.scenario_id,
        })
        .select()
        .single();

      // Create audit events
      await supabase.from('tno_audit_events').insert([
        {
          event_type: 'invitation.accepted',
          actor_member_id: user.id,
          subject_member_id: invitation.from_member_id,
          invitation_id: invitation.invitation_id,
          card_share_id: cardShare.card_share_id,
        },
        {
          event_type: 'relationship.created',
          actor_member_id: user.id,
          subject_member_id: invitation.from_member_id,
          relationship_id: relationship?.relationship_id,
          card_share_id: cardShare.card_share_id,
        },
      ]);

      toast.success('Invitation accepted! Relationship created.');
      onAction();
    } catch (error) {
      toast.error('Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data: cardShare } = await supabase
        .from('tno_card_shares')
        .select('*')
        .eq('invitation_id', invitation.invitation_id)
        .single();

      if (!cardShare) throw new Error('Card share not found');

      // Create rejection
      await supabase.from('tno_acceptances').insert({
        invitation_id: invitation.invitation_id,
        card_share_id: cardShare.card_share_id,
        from_member_id: invitation.from_member_id,
        to_member_id: invitation.to_member_id,
        decision: 'rejected',
      });

      // Update invitation status
      await supabase
        .from('tno_invitations')
        .update({ status: 'rejected', responded_at: new Date().toISOString() })
        .eq('invitation_id', invitation.invitation_id);

      // Create audit event
      await supabase.from('tno_audit_events').insert({
        event_type: 'invitation.rejected',
        actor_member_id: user.id,
        subject_member_id: invitation.from_member_id,
        invitation_id: invitation.invitation_id,
        card_share_id: cardShare.card_share_id,
      });

      toast.success('Invitation rejected.');
      onAction();
    } catch (error) {
      toast.error('Failed to reject invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold">
                {fromMember?.handle || fromMember?.email || 'Unknown'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          <StatusBadge status={invitation.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Sharing Scenario</p>
          <p className="font-medium">{invitation.scenario?.title}</p>
          <p className="text-sm text-muted-foreground">{invitation.scenario?.description}</p>
        </div>

        {invitation.message && (
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-sm italic">"{invitation.message}"</p>
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {expanded ? 'Hide' : 'Show'} {cards.length} CARDs
        </button>

        {expanded && (
          <div className="flex flex-wrap gap-2 pt-2">
            {cards.map((card) => (
              <CardBadge key={card.card_id} card={card} />
            ))}
          </div>
        )}
      </CardContent>

      {isRecipient && invitation.status === 'pending' && (
        <CardFooter className="gap-2">
          <Button onClick={handleAccept} disabled={loading} className="flex-1">
            Accept
          </Button>
          <Button variant="outline" onClick={handleReject} disabled={loading} className="flex-1">
            Reject
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
