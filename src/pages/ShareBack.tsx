import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import type { Relationship, Member, SharingScenario, MemberCard } from '@/lib/types';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Share2, Send, Users, CheckCircle } from 'lucide-react';

// Member's owned CARD instance for selection
interface OwnedCardInstance {
  id: string;
  catalogCardId: string;
  title: string;
  summary: string;
  cardKey: string;
  cardData: Record<string, unknown>;
  label: string | null;
}

export default function ShareBack() {
  const { relationshipId } = useParams<{ relationshipId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [myCards, setMyCards] = useState<OwnedCardInstance[]>([]);
  const [scenarios, setScenarios] = useState<SharingScenario[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (relationshipId && user) {
      fetchData();
    }
  }, [relationshipId, user]);

  const fetchData = async () => {
    if (!relationshipId || !user) return;

    // Fetch relationship
    const { data: rel } = await supabase
      .from('tno_relationships')
      .select(`
        *,
        scenario:tno_sharing_scenarios(*)
      `)
      .eq('relationship_id', relationshipId)
      .single();

    if (!rel) {
      toast.error('Relationship not found');
      navigate('/');
      return;
    }

    // Fetch other member
    const otherMemberId = rel.member_a_id === user.id ? rel.member_b_id : rel.member_a_id;
    const { data: member } = await supabase
      .from('tno_members')
      .select('*')
      .eq('member_id', otherMemberId)
      .single();

    setRelationship({
      ...rel,
      other_member: member as Member,
      scenario: rel.scenario as SharingScenario,
    } as Relationship);

    // Fetch MY owned card instances (from tno_member_cards, not catalog)
    const { data: memberCards } = await supabase
      .from('tno_member_cards')
      .select(`
        id,
        catalog_card_id,
        card_data,
        label,
        catalog_card:tno_card_catalog(card_id, card_key, title, summary)
      `)
      .eq('member_id', user.id)
      .eq('label', 'Primary');

    if (memberCards) {
      const ownedCards: OwnedCardInstance[] = memberCards.map((mc: any) => ({
        id: mc.id,
        catalogCardId: mc.catalog_card_id,
        title: mc.catalog_card?.title || 'Unknown',
        summary: mc.catalog_card?.summary || '',
        cardKey: mc.catalog_card?.card_key || '',
        cardData: mc.card_data || {},
        label: mc.label,
      }));
      setMyCards(ownedCards);
    }

    // Fetch active scenarios
    const { data: scenariosData } = await supabase
      .from('tno_sharing_scenarios')
      .select('*')
      .eq('status', 'active')
      .order('title');

    if (scenariosData) {
      setScenarios(scenariosData as SharingScenario[]);
      // Pre-select the relationship's scenario
      if (rel.scenario_id) {
        setSelectedScenario(rel.scenario_id);
      } else if (scenariosData.length > 0) {
        setSelectedScenario(scenariosData[0].scenario_id);
      }
    }

    setLoading(false);
  };

  const toggleCard = (cardId: string) => {
    setSelectedCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  // Get display value from card data
  const getCardDisplayValue = (card: OwnedCardInstance): string => {
    if (card.cardKey === 'identity.basic') return card.cardData.name as string || '';
    if (card.cardKey === 'contact.email') return card.cardData.email as string || '';
    if (card.cardKey === 'contact.phone') return card.cardData.phone as string || '';
    return '';
  };

  const handleSubmit = async () => {
    if (!relationship || !user || selectedCardIds.length === 0 || !selectedScenario) {
      toast.error('Please select at least one CARD to share');
      return;
    }

    setSubmitting(true);
    try {
      const otherMemberId =
        relationship.member_a_id === user.id
          ? relationship.member_b_id
          : relationship.member_a_id;

      // Pass member_card_ids (instance IDs), not catalog card IDs
      const { error } = await supabase.rpc('tno_create_share_proposal', {
        p_relationship_id: relationship.relationship_id,
        p_to_member_id: otherMemberId,
        p_scenario_id: selectedScenario,
        p_member_card_ids: selectedCardIds,
        p_message: message || null,
      });

      if (error) throw error;

      setSuccess(true);
      toast.success('Share proposal sent!');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create share proposal';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
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

  // Success state
  if (success) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto space-y-8">
          <Card className="border-success/30">
            <CardHeader className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mb-4">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <CardTitle>Share Proposal Sent!</CardTitle>
              <CardDescription>
                Your CARD sharing proposal has been sent to{' '}
                <strong>{otherMember?.handle || otherMember?.email}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                They will see your proposal in their Inbox. Once accepted, the trust loop will be complete.
              </p>

              {/* Alpha context */}
              <div className="p-4 bg-primary/5 border border-primary/30 rounded-lg space-y-2">
                <p className="text-sm font-medium text-center">Alpha Test: Switch Persona</p>
                <p className="text-xs text-muted-foreground text-center">
                  To continue testing, sign out and sign in as the other member to accept this proposal.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={() => navigate(`/relationship/${relationship.relationship_id}`)}>
                  View Relationship
                </Button>
                <Button variant="outline" onClick={() => navigate('/')}>
                  Back to Relationships
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Back button */}
        <button
          onClick={() => navigate(`/relationship/${relationshipId}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to relationship
        </button>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Share2 className="h-6 w-6 text-primary" />
            Share Back
          </h1>
          <p className="text-muted-foreground mt-1">
            Propose CARDs to share with {otherMember?.handle || otherMember?.email}
          </p>
        </div>

        {/* Relationship context */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Sharing within relationship
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">{otherMember?.handle || otherMember?.email}</p>
                <p className="text-sm text-muted-foreground">
                  {relationship.scenario?.title}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Your CARDs to Share</CardTitle>
            <CardDescription>
              Choose which of your owned CARDs you want to propose sharing. The recipient must accept.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {myCards.length === 0 ? (
              <p className="text-sm text-muted-foreground">No CARDs available to share. Please set up your identity CARDs first.</p>
            ) : (
              <div className="space-y-3">
                {myCards.map((card) => {
                  const displayValue = getCardDisplayValue(card);
                  return (
                  <div
                    key={card.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      selectedCardIds.includes(card.id)
                        ? 'bg-primary/5 border-primary/30'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleCard(card.id)}
                  >
                    <Checkbox
                      checked={selectedCardIds.includes(card.id)}
                      onCheckedChange={() => toggleCard(card.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{card.title}</p>
                      <p className="text-sm text-muted-foreground">{card.summary}</p>
                      {displayValue && (
                        <p className="text-sm text-primary mt-1">Your value: {displayValue}</p>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message */}
        <Card>
          <CardHeader>
            <CardTitle>Add a Message (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Include a personal message with your share proposal..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
            />
          </CardContent>
        </Card>

        {/* Alpha context */}
        <div className="p-4 bg-muted/50 border rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Alpha Note:</strong> Share Back is the second trust act. Relationship alone does not grant 
            data access. The recipient must explicitly accept this proposal to complete the trust loop.
          </p>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || selectedCardIds.length === 0}
          className="w-full"
          size="lg"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Send Share Proposal
        </Button>
      </div>
    </AppLayout>
  );
}
