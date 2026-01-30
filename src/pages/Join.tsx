import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CardBadge } from '@/components/trust/CardBadge';
import { supabase } from '@/integrations/supabase/client';
import { Card as CardType, PersonalCardData, RelationshipCardData } from '@/lib/types';
import { toast } from 'sonner';
import { Loader2, UserPlus, Shield, ArrowRight, CheckCircle2, AlertCircle, Heart } from 'lucide-react';

interface ClaimResult {
  invite_link_id: string;
  inviter: {
    member_id: string;
    handle: string | null;
    email: string;
  };
  scenario: {
    scenario_id: string;
    title: string;
    description: string;
  };
  invitation_card_json: PersonalCardData;
  relationship_card_json: RelationshipCardData | null;
  invitee_name: string | null;
  invitee_email: string;
}

type JoinStep = 'loading' | 'auth' | 'claim' | 'edit' | 'success' | 'error';

export default function Join() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [step, setStep] = useState<JoinStep>('loading');
  const [error, setError] = useState<string>('');
  const [claimData, setClaimData] = useState<ClaimResult | null>(null);
  const [scenarioCards, setScenarioCards] = useState<CardType[]>([]);
  const [relationshipId, setRelationshipId] = useState<string | null>(null);

  // Personal card form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formOrg, setFormOrg] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided');
      setStep('error');
      return;
    }

    if (authLoading) {
      return;
    }

    if (!user) {
      setStep('auth');
      return;
    }

    // User is authenticated, try to claim the invite
    claimInvite();
  }, [token, user, authLoading]);

  const claimInvite = async () => {
    if (!token) return;

    setStep('loading');

    try {
      const { data, error: claimError } = await (supabase.rpc('tno_claim_invite' as never, {
        p_token: token,
      } as never)) as { data: unknown; error: Error | null };

      if (claimError) {
        throw new Error(claimError.message);
      }

      const result = data as unknown as ClaimResult;
      setClaimData(result);

      // Pre-fill form with invitation card data
      setFormName(result.invitation_card_json.name || result.invitee_name || '');
      setFormEmail(result.invitation_card_json.email || result.invitee_email || '');
      setFormPhone(result.invitation_card_json.phone || '');
      setFormOrg(result.invitation_card_json.organization || '');
      setFormTitle(result.invitation_card_json.title || '');

      // Fetch scenario cards
      const { data: cardsData } = await supabase
        .from('tno_scenario_cards')
        .select(`
          position,
          card:tno_card_catalog(*)
        `)
        .eq('scenario_id', result.scenario.scenario_id)
        .order('position');

      if (cardsData) {
        setScenarioCards(cardsData.map(sc => sc.card as unknown as CardType));
      }

      setStep('edit');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim invitation');
      setStep('error');
    }
  };

  const handleAccept = async () => {
    if (!token || !claimData) return;

    setProcessing(true);

    try {
      const personalCardJson: PersonalCardData = {
        name: formName,
        email: formEmail,
        phone: formPhone || undefined,
        organization: formOrg || undefined,
        title: formTitle || undefined,
      };

      const { data, error: acceptError } = await (supabase.rpc('tno_accept_invite' as never, {
        p_token: token,
        p_personal_card_json: personalCardJson,
      } as never)) as { data: string | null; error: Error | null };

      if (acceptError) {
        throw new Error(acceptError.message);
      }

      setRelationshipId(data as string);
      setStep('success');
      toast.success('Relationship created!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setProcessing(false);
    }
  };

  const handleGoToRelationship = () => {
    if (relationshipId) {
      navigate(`/relationship/${relationshipId}`);
    } else {
      navigate('/');
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Processing invitation...</p>
        </div>
      </div>
    );
  }

  if (step === 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-4">
              <UserPlus className="h-6 w-6" />
            </div>
            <CardTitle>Join Invitation</CardTitle>
            <CardDescription>
              You've been invited to join Opn3. Please sign in or create an account to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full" 
              onClick={() => navigate(`/auth?redirect=/join?token=${token}`)}
            >
              Sign In or Sign Up
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              After signing in, you'll be able to accept this invitation and establish a trusted relationship.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mx-auto mb-4">
              <AlertCircle className="h-6 w-6" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/')}>
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-600 mx-auto mb-4">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <CardTitle>Relationship Created!</CardTitle>
            <CardDescription>
              You're now connected with {claimData?.inviter.handle || claimData?.inviter.email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={handleGoToRelationship}>
              View Relationship
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Edit step
  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-4">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Accept Invitation</h1>
          <p className="text-muted-foreground mt-1">
            {claimData?.inviter.handle || claimData?.inviter.email} invited you to connect
          </p>
        </div>

        {/* Proposed Relationship CARD (OPN3.008) */}
        {claimData?.relationship_card_json && (
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Proposed Relationship
              </CardTitle>
              <CardDescription>
                {claimData?.inviter.handle || claimData?.inviter.email} has proposed the following relationship
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{claimData?.inviter.handle || 'Inviter'}:</span>
                  <span className="text-primary">{claimData.relationship_card_json.inviter_label}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">You:</span>
                  <span className="text-primary">{claimData.relationship_card_json.invitee_label}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                By accepting, you agree to this relationship declaration.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Invitation Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sharing Scenario</CardTitle>
            <CardDescription>{claimData?.scenario.title}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {claimData?.scenario.description}
            </p>
            <p className="text-sm font-medium mb-2">CARDs in this scenario:</p>
            <div className="flex flex-wrap gap-2">
              {scenarioCards.map((card) => (
                <CardBadge key={card.card_id} card={card} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Personal Card Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Personal CARD</CardTitle>
            <CardDescription>
              Review and edit your information before accepting
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="Your name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="org">Organization</Label>
                  <Input
                    id="org"
                    placeholder="Company"
                    value={formOrg}
                    onChange={(e) => setFormOrg(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Role"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accept Button */}
        <Button 
          size="lg" 
          className="w-full"
          onClick={handleAccept}
          disabled={!formName || !formEmail || processing}
        >
          {processing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          Accept & Create Relationship
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          By accepting, you agree to share the specified CARDs with {claimData?.inviter.handle || claimData?.inviter.email}
        </p>
      </div>
    </div>
  );
}