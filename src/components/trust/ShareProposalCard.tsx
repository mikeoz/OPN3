import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import { CardBadge } from './CardBadge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Share2, Check, X, Loader2, Users, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import type { ShareProposal, Card as CardType, Member, SharingScenario } from '@/lib/types';

interface ShareProposalCardProps {
  proposal: ShareProposal;
  cards: CardType[];
  isReceived: boolean;
  onAction?: () => void;
}

export function ShareProposalCard({ proposal, cards, isReceived, onAction }: ShareProposalCardProps) {
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [showDeclineNote, setShowDeclineNote] = useState(false);
  const [note, setNote] = useState('');

  const otherMember = isReceived ? proposal.from_member : proposal.to_member;
  const isPending = proposal.status === 'pending';

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const { error } = await supabase.rpc('tno_accept_share_proposal', {
        p_proposal_id: proposal.proposal_id,
        p_note: null,
      });
      if (error) throw error;
      toast.success('Share accepted! Trust loop completed.');
      onAction?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to accept proposal';
      toast.error(message);
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      const { error } = await supabase.rpc('tno_decline_share_proposal', {
        p_proposal_id: proposal.proposal_id,
        p_note: note || null,
      });
      if (error) throw error;
      toast.success('Share proposal declined');
      setShowDeclineNote(false);
      onAction?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to decline proposal';
      toast.error(message);
    } finally {
      setDeclining(false);
    }
  };

  return (
    <Card className={`transition-all ${isPending && isReceived ? 'border-primary/50 shadow-md' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">
                {isReceived ? 'Share Proposal from' : 'You proposed to'}{' '}
                {otherMember?.handle || otherMember?.email || 'Unknown'}
              </CardTitle>
              <CardDescription>
                {format(new Date(proposal.created_at), 'PPp')}
              </CardDescription>
            </div>
          </div>
          <StatusBadge status={proposal.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Scenario */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>Under: {proposal.scenario?.title || 'Unknown scenario'}</span>
        </div>

        {/* Message */}
        {proposal.message && (
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <p className="text-sm">{proposal.message}</p>
          </div>
        )}

        {/* Cards being shared */}
        <div>
          <p className="text-sm font-medium mb-2">CARDs {isReceived ? 'being offered' : 'you offered'}:</p>
          <div className="flex flex-wrap gap-2">
            {cards.map((card) => (
              <CardBadge key={card.card_id} card={card} />
            ))}
            {cards.length === 0 && (
              <span className="text-sm text-muted-foreground">No CARDs</span>
            )}
          </div>
        </div>

        {/* Response note if declined */}
        {proposal.status === 'declined' && proposal.note && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm font-medium text-destructive mb-1">Decline reason:</p>
            <p className="text-sm">{proposal.note}</p>
          </div>
        )}

        {/* Actions for pending received proposals */}
        {isPending && isReceived && (
          <div className="space-y-3 pt-2">
            {showDeclineNote ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="decline-note">Reason (optional)</Label>
                  <Textarea
                    id="decline-note"
                    placeholder="Explain why you're declining..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeclineNote(false)}
                    disabled={declining}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDecline}
                    disabled={declining}
                  >
                    {declining && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Confirm Decline
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={handleAccept}
                  disabled={accepting || declining}
                >
                  {accepting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Check className="h-4 w-4 mr-2" />
                  Accept
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDeclineNote(true)}
                  disabled={accepting || declining}
                >
                  <X className="h-4 w-4 mr-2" />
                  Decline
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Trust loop completed indicator */}
        {proposal.status === 'accepted' && (
          <div className="p-3 bg-success/10 border border-success/20 rounded-lg flex items-center gap-2">
            <Check className="h-4 w-4 text-success" />
            <span className="text-sm font-medium text-success">Trust loop completed</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
