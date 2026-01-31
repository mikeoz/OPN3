import { useState } from 'react';
import { Card as CardType, SharedCardItem } from '@/lib/types';
import { CardBadge } from './CardBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ShieldX, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface SharedCardsListProps {
  proposalId: string;
  cards: SharedCardItem[];
  isSharer: boolean;  // Can only sharer revoke
  otherMemberName: string;
  onRevoke?: () => void;
}

export function SharedCardsList({ 
  proposalId, 
  cards, 
  isSharer, 
  otherMemberName,
  onRevoke 
}: SharedCardsListProps) {
  const [revokingCardId, setRevokingCardId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  const handleRevoke = async (cardId: string) => {
    setRevokingCardId(cardId);
    
    try {
      const { error } = await supabase.rpc('tno_revoke_shared_card', {
        p_proposal_id: proposalId,
        p_card_id: cardId,
        p_reason: revokeReason || null,
      });

      if (error) throw error;

      toast.success('CARD access revoked');
      setRevokeReason('');
      onRevoke?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to revoke CARD';
      toast.error(message);
    } finally {
      setRevokingCardId(null);
    }
  };

  const activeCards = cards.filter(c => !c.revoked_at);
  const revokedCards = cards.filter(c => c.revoked_at);

  return (
    <div className="space-y-4">
      {/* Active shared cards */}
      {activeCards.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            Shared CARDs ({activeCards.length})
          </p>
          <div className="space-y-2">
            {activeCards.map((item) => (
              <div 
                key={item.card_id}
                className="flex items-center justify-between p-3 rounded-lg border bg-success/5 border-success/20"
              >
                <div className="flex items-center gap-3">
                  <CardBadge card={item.card} />
                  <span className="text-sm text-muted-foreground">Active</span>
                </div>

                {isSharer && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <ShieldX className="h-4 w-4 mr-1" />
                        Revoke
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke CARD Access?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will immediately remove <strong>{otherMemberName}</strong>'s 
                          access to your <strong>{item.card.title}</strong> CARD. 
                          The relationship will remain active.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-2 py-2">
                        <Label htmlFor={`reason-${item.card_id}`}>Reason (optional)</Label>
                        <Textarea
                          id={`reason-${item.card_id}`}
                          placeholder="Explain why you're revoking access..."
                          value={revokeReason}
                          onChange={(e) => setRevokeReason(e.target.value)}
                          maxLength={500}
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setRevokeReason('')}>
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRevoke(item.card_id)}
                          disabled={revokingCardId === item.card_id}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {revokingCardId === item.card_id && (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          )}
                          Revoke Access
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revoked cards */}
      {revokedCards.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            Revoked CARDs ({revokedCards.length})
          </p>
          <div className="space-y-2">
            {revokedCards.map((item) => (
              <div 
                key={item.card_id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  "bg-destructive/5 border-destructive/20 opacity-70"
                )}
              >
                <div className="flex items-center gap-3">
                  <CardBadge card={item.card} />
                  <span className="text-sm text-destructive">Revoked</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {item.revoked_at && format(new Date(item.revoked_at), 'PPP')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cards.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No CARDs have been shared in this proposal yet.
        </p>
      )}
    </div>
  );
}