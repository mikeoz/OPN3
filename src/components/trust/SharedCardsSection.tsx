import { useState } from 'react';
import { Card as CardType, SharedCardItem } from '@/lib/types';
import { CardBadge } from './CardBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Loader2, ShieldX, FileKey2, Send, Download } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface SharedCard {
  proposalId: string;
  cardId: string;
  memberCardId: string | null;
  card: CardType;
  cardData: Record<string, unknown> | null;
  sharedAt: string;
  revokedAt: string | null;
  isActive: boolean;
}

interface SharedCardsSectionProps {
  cardsIShared: SharedCard[];
  cardsTheyShared: SharedCard[];
  otherMemberName: string;
  onRevoke: () => void;
}

interface CardRowProps {
  card: SharedCard;
  canRevoke: boolean;
  otherMemberName: string;
  onRevoke: () => void;
}

function CardRow({ card, canRevoke, otherMemberName, onRevoke }: CardRowProps) {
  const [revoking, setRevoking] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

  const handleRevoke = async () => {
    setRevoking(true);
    
    try {
      const { error } = await supabase.rpc('tno_revoke_shared_card', {
        p_proposal_id: card.proposalId,
        p_card_id: card.cardId,
        p_reason: revokeReason || null,
      });

      if (error) throw error;

      toast.success('CARD access revoked');
      setRevokeReason('');
      onRevoke();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to revoke CARD';
      toast.error(message);
    } finally {
      setRevoking(false);
    }
  };

  // Get display value from card data
  const getCardDisplayValue = (): string | null => {
    if (!card.cardData) return null;
    const cardKey = card.card?.card_key;
    if (cardKey === 'identity.basic') return card.cardData.name as string || null;
    if (cardKey === 'contact.email') return card.cardData.email as string || null;
    if (cardKey === 'contact.phone') return card.cardData.phone as string || null;
    return null;
  };

  const displayValue = getCardDisplayValue();

  return (
    <div 
      className={cn(
        "flex items-center justify-between p-4 rounded-lg border",
        card.isActive 
          ? "bg-card border-border" 
          : "bg-muted/30 border-muted opacity-70"
      )}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <CardBadge card={card.card} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge 
              variant={card.isActive ? "default" : "secondary"}
              className={cn(
                card.isActive 
                  ? "bg-success/10 text-success border-success/20 hover:bg-success/20" 
                  : "bg-destructive/10 text-destructive border-destructive/20"
              )}
            >
              {card.isActive ? 'Active' : 'Revoked'}
            </Badge>
            {displayValue && (
              <span className="text-sm text-primary font-medium">{displayValue}</span>
            )}
          </div>
          
          <div className="text-xs text-muted-foreground mt-1 space-x-3">
            <span>Shared {format(new Date(card.sharedAt), 'MMM d, yyyy')}</span>
            {card.revokedAt && (
              <span className="text-destructive">
                Revoked {format(new Date(card.revokedAt), 'MMM d, yyyy')}
              </span>
            )}
          </div>
        </div>
      </div>

      {canRevoke && card.isActive && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
            >
              <ShieldX className="h-4 w-4 mr-1" />
              Revoke Access
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke CARD Access?</AlertDialogTitle>
              <AlertDialogDescription>
                This will immediately remove <strong>{otherMemberName}</strong>'s 
                access to your <strong>{card.card.title}</strong> CARD. 
                The relationship will remain active.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor={`reason-${card.cardId}`}>Reason (optional)</Label>
              <Textarea
                id={`reason-${card.cardId}`}
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
                onClick={handleRevoke}
                disabled={revoking}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {revoking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Revoke Access
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

export function SharedCardsSection({ 
  cardsIShared, 
  cardsTheyShared, 
  otherMemberName,
  onRevoke 
}: SharedCardsSectionProps) {
  const hasSharedCards = cardsIShared.length > 0 || cardsTheyShared.length > 0;

  if (!hasSharedCards) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileKey2 className="h-5 w-5 text-primary" />
            Shared CARDs
          </CardTitle>
          <CardDescription>
            No CARDs have been shared in this relationship yet.
            Use "Propose Share" to share CARDs with {otherMemberName}.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const activeCardsIShared = cardsIShared.filter(c => c.isActive).length;
  const activeCardsTheyShared = cardsTheyShared.filter(c => c.isActive).length;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileKey2 className="h-5 w-5 text-primary" />
          Shared CARDs
        </CardTitle>
        <CardDescription>
          CARDs shared through accepted Share proposals. You control access to CARDs you've shared.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cards I Shared */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Send className="h-4 w-4 text-muted-foreground" />
            CARDs I Shared
            <Badge variant="secondary" className="ml-auto">
              {activeCardsIShared} active / {cardsIShared.length} total
            </Badge>
          </div>
          
          {cardsIShared.length > 0 ? (
            <div className="space-y-2">
              {cardsIShared.map((card) => (
                <CardRow
                  key={`${card.proposalId}-${card.cardId}`}
                  card={card}
                  canRevoke={true}
                  otherMemberName={otherMemberName}
                  onRevoke={onRevoke}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-3 text-center border rounded-lg bg-muted/20">
              You haven't shared any CARDs with {otherMemberName} yet.
            </p>
          )}
        </div>

        {/* Cards They Shared */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Download className="h-4 w-4 text-muted-foreground" />
            CARDs {otherMemberName} Shared
            <Badge variant="secondary" className="ml-auto">
              {activeCardsTheyShared} active / {cardsTheyShared.length} total
            </Badge>
          </div>
          
          {cardsTheyShared.length > 0 ? (
            <div className="space-y-2">
              {cardsTheyShared.map((card) => (
                <CardRow
                  key={`${card.proposalId}-${card.cardId}`}
                  card={card}
                  canRevoke={false}
                  otherMemberName={otherMemberName}
                  onRevoke={onRevoke}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-3 text-center border rounded-lg bg-muted/20">
              {otherMemberName} hasn't shared any CARDs with you yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}