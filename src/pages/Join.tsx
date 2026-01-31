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
  const isAlphaSwitch = searchParams.get('alpha_switch') === 'true';

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

  // Screen 8: Join Invitation (Auth step) - OPN3.008-2/3
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
              You are joining as the <strong>invited person</strong>. To continue, sign in or create a new account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* OPN3.008-3: Alpha persona switch notice */}
            {isAlphaSwitch && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  <strong>Persona Switch Complete:</strong> You have been signed out of the inviter account. You are no longer signed in as the person who created this invitation.
                </p>
              </div>
            )}

            {/* Two clear buttons: Sign In and Create Account */}
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline"
                className="w-full" 
                onClick={() => navigate(`/auth?redirect=/join?token=${token}${isAlphaSwitch ? '&alpha_switch=true' : ''}&mode=signin`)}
              >
                Sign In
              </Button>
              <Button 
                className="w-full" 
                onClick={() => navigate(`/auth?redirect=/join?token=${token}${isAlphaSwitch ? '&alpha_switch=true' : ''}&mode=signup`)}
              >
                Create Account
              </Button>
            </div>
            
            {/* Alpha Test Tip */}
            <div className="p-3 bg-primary/5 border border-primary/30 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Alpha Test Tip:</strong> {isAlphaSwitch 
                  ? 'Sign in as your invitee test account, or create a new account to act as the invited person.'
                  : 'If you have not created the invitee test account, choose Create Account. Otherwise, choose Sign In.'}
              </p>
            </div>
            
            <p className="text-xs text-center text-muted-foreground">
              Once authenticated, you'll be able to review and accept this invitation.
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

  // Screen 9 Success: Completion panel with next steps - OPN3.008-2
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
          <CardContent className="space-y-4">
            {/* Primary action: View relationship */}
            <Button className="w-full" onClick={handleGoToRelationship}>
              View Relationship
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            
            {/* Alpha next step: Share back */}
            <div className="p-4 bg-primary/5 border border-primary/30 rounded-lg space-y-3">
              <p className="text-sm font-medium text-center">What's Next?</p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/invite')}
              >
                Continue to Share Back (Alpha)
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                In the full app, you would share CARDs back to complete the trust loop.
              </p>
            </div>
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

        {/* Proposed Relationship - Clarified wording (OPN3.008-1) */}
        {claimData?.relationship_card_json && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Review Proposed Relationship
              </CardTitle>
              <CardDescription>
                {claimData?.inviter.handle || claimData?.inviter.email} wants to call you:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-background rounded-lg border space-y-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    They call you
                  </p>
                  <p className="text-lg font-semibold text-primary">
                    {claimData.relationship_card_json.invitee_label}
                  </p>
                </div>
                <div className="border-t pt-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    You call them
                  </p>
                  <p className="text-lg font-semibold text-primary">
                    {claimData.relationship_card_json.inviter_label}
                  </p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>What this means:</strong> Accepting creates a visible relationship between you and {claimData?.inviter.handle || claimData?.inviter.email}. 
                  This is a mutual acknowledgment of how you know each other — it does not grant access to your personal data.
                </p>
              </div>
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

        {/* Accept Button - Clarified wording (OPN3.008-1) */}
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
          {claimData?.relationship_card_json 
            ? 'Accept Relationship' 
            : 'Accept Invitation'}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          {claimData?.relationship_card_json 
            ? `By accepting, you confirm this relationship with ${claimData?.inviter.handle || claimData?.inviter.email}. No data is shared until you explicitly choose to share.`
            : `By accepting, you create a connection with ${claimData?.inviter.handle || claimData?.inviter.email}.`}
        </p>
      </div>
    </div>
  );
}