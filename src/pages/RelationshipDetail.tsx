import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/trust/StatusBadge';
import { CardBadge } from '@/components/trust/CardBadge';
import { SharedCardsSection } from '@/components/trust/SharedCardsSection';
import { RelationshipDangerZone } from '@/components/trust/RelationshipDangerZone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Relationship, Member, SharingScenario, Card as CardType, CardShare } from '@/lib/types';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Users, Calendar, Shield, Heart, Share2 } from 'lucide-react';
import { format } from 'date-fns';

// Shared card with proposal context
interface SharedCard {
  proposalId: string;
  cardId: string;
  card: CardType;
  sharedAt: string;
  revokedAt: string | null;
  isActive: boolean;
}

export default function RelationshipDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [initialCards, setInitialCards] = useState<CardType[]>([]);
  const [cardsIShared, setCardsIShared] = useState<SharedCard[]>([]);
  const [cardsTheyShared, setCardsTheyShared] = useState<SharedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [terminating, setTerminating] = useState(false);
  const [terminateReason, setTerminateReason] = useState('');

  const fetchRelationship = useCallback(async () => {
    if (!id || !user) return;

    const { data } = await supabase
      .from('tno_relationships')
      .select(`
        *,
        scenario:tno_sharing_scenarios(*),
        card_share:tno_card_shares(*)
      `)
      .eq('relationship_id', id)
      .single();

    if (data) {
      // Fetch other member
      const otherMemberId = data.member_a_id === user.id ? data.member_b_id : data.member_a_id;
      const { data: member } = await supabase
        .from('tno_members')
        .select('*')
        .eq('member_id', otherMemberId)
        .single();

      // Fetch initial cards from card share (for reference)
      const { data: shareItems } = await supabase
        .from('tno_card_share_items')
        .select(`
          position,
          card:tno_card_catalog(*)
        `)
        .eq('card_share_id', data.created_from_card_share_id)
        .order('position');

      // Fetch all accepted share proposals for this relationship
      const { data: proposals } = await supabase
        .from('tno_share_proposals')
        .select(`
          proposal_id,
          from_member_id,
          to_member_id,
          created_at,
          status
        `)
        .eq('relationship_id', id)
        .eq('status', 'accepted');

      // Categorize shared cards
      const mySharedCards: SharedCard[] = [];
      const theirSharedCards: SharedCard[] = [];

      if (proposals) {
        for (const proposal of proposals) {
          const { data: items } = await supabase
            .from('tno_share_proposal_items')
            .select(`
              card_id,
              position,
              revoked_at,
              revoked_by_member_id,
              card:tno_card_catalog(*)
            `)
            .eq('proposal_id', proposal.proposal_id)
            .order('position');

          if (items) {
            const mappedCards: SharedCard[] = items.map(item => ({
              proposalId: proposal.proposal_id,
              cardId: item.card_id,
              card: item.card as unknown as CardType,
              sharedAt: proposal.created_at,
              revokedAt: item.revoked_at,
              isActive: !item.revoked_at,
            }));

            if (proposal.from_member_id === user.id) {
              mySharedCards.push(...mappedCards);
            } else {
              theirSharedCards.push(...mappedCards);
            }
          }
        }
      }

      setCardsIShared(mySharedCards);
      setCardsTheyShared(theirSharedCards);

      setRelationship({
        ...data,
        other_member: member as Member,
        scenario: data.scenario as SharingScenario,
        card_share: data.card_share as unknown as CardShare,
      } as Relationship);

      if (shareItems) {
        setInitialCards(shareItems.map(i => i.card as unknown as CardType));
      }
    }

    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    if (id && user) {
      fetchRelationship();
    }
  }, [id, user, fetchRelationship]);

  const handleTerminate = async () => {
    if (!relationship || !user) return;
    setTerminating(true);

    try {
      // Create revocation record
      await supabase.from('tno_revocations').insert({
        relationship_id: relationship.relationship_id,
        card_share_id: relationship.created_from_card_share_id,
        revoked_by_member_id: user.id,
        reason: terminateReason || null,
      });

      // Update relationship status
      await supabase
        .from('tno_relationships')
        .update({ 
          status: 'terminated', 
          terminated_at: new Date().toISOString() 
        })
        .eq('relationship_id', relationship.relationship_id);

      // Update card share status
      await supabase
        .from('tno_card_shares')
        .update({ 
          status: 'revoked', 
          revoked_at: new Date().toISOString() 
        })
        .eq('card_share_id', relationship.created_from_card_share_id);

      // Create audit event
      const otherMemberId = relationship.member_a_id === user.id 
        ? relationship.member_b_id 
        : relationship.member_a_id;

      await supabase.from('tno_audit_events').insert({
        event_type: 'relationship.revoked',
        actor_member_id: user.id,
        subject_member_id: otherMemberId,
        relationship_id: relationship.relationship_id,
        card_share_id: relationship.created_from_card_share_id,
      });

      toast.success('Relationship terminated');
      navigate('/');
    } catch (error) {
      toast.error('Failed to terminate relationship');
    } finally {
      setTerminating(false);
    }
  };

  const otherMember = relationship?.other_member;
  const otherMemberName = useMemo(() => 
    otherMember?.handle || otherMember?.email || 'Unknown',
    [otherMember]
  );
  const isActive = relationship?.status === 'active';

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!relationship) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Relationship not found</p>
          <Button variant="link" onClick={() => navigate('/')}>
            Go back
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to relationships
        </button>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {otherMember?.handle || otherMember?.email || 'Unknown Member'}
              </h1>
              <p className="text-muted-foreground">{otherMember?.email}</p>
            </div>
          </div>
          <StatusBadge status={relationship.status} />
        </div>

        {/* Relationship Type Card */}
        {(relationship.inviter_relationship_label || relationship.invitee_relationship_label) && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Relationship Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                {relationship.inviter_relationship_label && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Inviter's role:</span>
                    <span className="text-primary">{relationship.inviter_relationship_label}</span>
                  </div>
                )}
                {relationship.invitee_relationship_label && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Invitee's role:</span>
                    <span className="text-primary">{relationship.invitee_relationship_label}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* PRIMARY: Shared Cards Section */}
        <SharedCardsSection
          cardsIShared={cardsIShared}
          cardsTheyShared={cardsTheyShared}
          otherMemberName={otherMemberName}
          onRevoke={fetchRelationship}
        />

        {/* Share Back Action */}
        {isActive && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" />
                Propose Share
              </CardTitle>
              <CardDescription>
                Propose additional CARDs to share with {otherMemberName}. 
                Sharing requires their explicit acceptance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full"
                onClick={() => navigate(`/share-back/${relationship.relationship_id}`)}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Propose Share
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Scenario & Initial CARDs (collapsed reference) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Sharing Context
            </CardTitle>
            <CardDescription>
              Original scenario and initial CARDs when this relationship was established.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium">{relationship.scenario?.title}</p>
              <p className="text-sm text-muted-foreground">
                {relationship.scenario?.description}
              </p>
            </div>
            {initialCards.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Initial CARDs (from invitation):</p>
                <div className="flex flex-wrap gap-2">
                  {initialCards.map((card) => (
                    <CardBadge key={card.card_id} card={card} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Established</span>
              <span>{format(new Date(relationship.created_at), 'PPP')}</span>
            </div>
            {relationship.terminated_at && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Terminated</span>
                <span className="text-destructive">
                  {format(new Date(relationship.terminated_at), 'PPP')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone - Only for active relationships */}
        {isActive && (
          <RelationshipDangerZone
            otherMemberName={otherMemberName}
            terminating={terminating}
            terminateReason={terminateReason}
            onTerminateReasonChange={setTerminateReason}
            onTerminate={handleTerminate}
          />
        )}
      </div>
    </AppLayout>
  );
}