import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/trust/StatusBadge';
import { CardBadge } from '@/components/trust/CardBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Relationship, Member, SharingScenario, Card as CardType, CardShare } from '@/lib/types';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Users, Unlink, Calendar, Shield } from 'lucide-react';
import { format } from 'date-fns';

export default function RelationshipDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

  useEffect(() => {
    if (id && user) {
      fetchRelationship();
    }
  }, [id, user]);

  const fetchRelationship = async () => {
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

      // Fetch cards from card share
      const { data: shareItems } = await supabase
        .from('tno_card_share_items')
        .select(`
          position,
          card:tno_card_catalog(*)
        `)
        .eq('card_share_id', data.created_from_card_share_id)
        .order('position');

      setRelationship({
        ...data,
        other_member: member as Member,
        scenario: data.scenario as SharingScenario,
        card_share: data.card_share as unknown as CardShare,
      } as Relationship);

      if (shareItems) {
        setCards(shareItems.map(i => i.card as unknown as CardType));
      }
    }

    setLoading(false);
  };

  const handleRevoke = async () => {
    if (!relationship || !user) return;
    setRevoking(true);

    try {
      // Create revocation
      await supabase.from('tno_revocations').insert({
        relationship_id: relationship.relationship_id,
        card_share_id: relationship.created_from_card_share_id,
        revoked_by_member_id: user.id,
        reason: revokeReason || null,
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
      toast.error('Failed to revoke relationship');
    } finally {
      setRevoking(false);
    }
  };

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

  const otherMember = relationship.other_member;
  const isActive = relationship.status === 'active';

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

        {/* Details */}
        <div className="grid gap-6">
          {/* Scenario Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Sharing Scenario
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium">{relationship.scenario?.title}</p>
                <p className="text-sm text-muted-foreground">
                  {relationship.scenario?.description}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Shared CARDs:</p>
                <div className="flex flex-wrap gap-2">
                  {cards.map((card) => (
                    <CardBadge key={card.card_id} card={card} />
                  ))}
                </div>
              </div>
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

          {/* Actions */}
          {isActive && (
            <Card className="border-destructive/20">
              <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                  <Unlink className="h-5 w-5" />
                  Terminate Relationship
                </CardTitle>
                <CardDescription>
                  Revoking this relationship will end the trust connection. This action is permanent and auditable.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Textarea
                    id="reason"
                    placeholder="Explain why you're terminating this relationship..."
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    maxLength={500}
                  />
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Unlink className="h-4 w-4 mr-2" />
                      Revoke Relationship
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently terminate your relationship with{' '}
                        <strong>{otherMember?.handle || otherMember?.email}</strong>. 
                        This action will be recorded in the audit log.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleRevoke}
                        disabled={revoking}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {revoking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Revoke
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
