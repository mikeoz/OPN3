import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CardBadge } from '@/components/trust/CardBadge';
import { supabase } from '@/integrations/supabase/client';
import { Card as CardType, PersonalCardData, RelationshipCardData } from '@/lib/types';
import { toast } from 'sonner';
import { Loader2, UserPlus, Shield, ArrowRight, CheckCircle2, AlertCircle, Heart, LogIn, Info } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

// Preview data fetched before claiming (no auth required)
interface InvitePreview {
  inviter_handle: string | null;
  inviter_email: string;
  invitee_name: string | null;
  invitee_email: string;
  scenario_title: string;
  is_valid: boolean;
  error_message?: string;
}

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
  const { user, member, loading: authLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const isAlphaSwitch = searchParams.get('alpha_switch') === 'true';

  const [step, setStep] = useState<JoinStep>('loading');
  const [error, setError] = useState<string>('');
  const [claimData, setClaimData] = useState<ClaimResult | null>(null);
  const [scenarioCards, setScenarioCards] = useState<CardType[]>([]);
  const [relationshipId, setRelationshipId] = useState<string | null>(null);
  
  // OPN3.008-5: Invite preview for prefilling auth forms
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  // Personal card form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formOrg, setFormOrg] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [processing, setProcessing] = useState(false);

  // Auth form state - OPN3.008-4
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authHandle, setAuthHandle] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [activeAuthTab, setActiveAuthTab] = useState<string>('signup');

  // OPN3.008-5: Fetch invite preview to prefill auth forms (no auth required)
  const fetchInvitePreview = useCallback(async () => {
    if (!token || previewLoaded) return;
    
    try {
      const { data, error: previewError } = await (supabase.rpc('tno_preview_invite' as never, {
        p_token: token,
      } as never)) as { data: unknown; error: Error | null };

      if (previewError) {
        console.error('Preview error:', previewError);
        return;
      }

      const preview = data as InvitePreview;
      setInvitePreview(preview);
      
      // Prefill auth form with inviter-provided data
      if (preview.is_valid) {
        setAuthEmail(preview.invitee_email || '');
        setAuthHandle(preview.invitee_name || '');
      } else {
        setError(preview.error_message || 'Invalid invitation');
        setStep('error');
      }
    } catch (err) {
      console.error('Failed to fetch invite preview:', err);
    } finally {
      setPreviewLoaded(true);
    }
  }, [token, previewLoaded]);

  // OPN3.008-5: Ensure member record exists before claiming
  const ensureMemberExists = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    
    // Check if member already exists
    const { data: existingMember } = await supabase
      .from('tno_members')
      .select('member_id')
      .eq('member_id', user.id)
      .maybeSingle();
    
    if (existingMember) {
      return true;
    }
    
    // Create member if missing (edge case: auth succeeded but member creation failed)
    const { error: insertError } = await supabase
      .from('tno_members')
      .insert({
        member_id: user.id,
        email: user.email || '',
        handle: invitePreview?.invitee_name || null,
      });
    
    if (insertError) {
      // If insert fails due to duplicate, that's fine - member exists
      if (!insertError.message.includes('duplicate')) {
        console.error('Failed to create member:', insertError);
        return false;
      }
    }
    
    return true;
  }, [user, invitePreview]);

  // Initial effect: fetch preview when no user
  useEffect(() => {
    if (!token) {
      setError('No invitation token provided');
      setStep('error');
      return;
    }

    if (authLoading) {
      return;
    }

    // Fetch preview for prefilling (runs before auth)
    if (!previewLoaded) {
      fetchInvitePreview();
    }

    if (!user) {
      setStep('auth');
      return;
    }

    // User is authenticated, ensure member exists then claim
    const tryClaimWithMember = async () => {
      setStep('loading');
      const memberExists = await ensureMemberExists();
      if (memberExists) {
        claimInvite();
      } else {
        setError('Failed to create member profile. Please try again.');
        setStep('error');
      }
    };
    
    tryClaimWithMember();
  }, [token, user, authLoading, previewLoaded, fetchInvitePreview, ensureMemberExists]);

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

  // Inline auth handlers - OPN3.008-4
  const handleInlineSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(authEmail);
      passwordSchema.parse(authPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setAuthSubmitting(true);
    const { error } = await signIn(authEmail, authPassword);
    setAuthSubmitting(false);

    if (error) {
      toast.error(error.message);
    }
    // After successful sign-in, the useEffect will detect user and trigger claimInvite
  };

  // OPN3.008-5: Improved signup with graceful "already exists" handling
  const handleInlineSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(authEmail);
      passwordSchema.parse(authPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setAuthSubmitting(true);
    const { error } = await signUp(authEmail, authPassword, authHandle || undefined);
    setAuthSubmitting(false);

    if (error) {
      // OPN3.008-5: Graceful handling of existing accounts
      if (error.message.includes('already registered') || error.message.includes('User already registered')) {
        toast.error(
          <div className="space-y-2">
            <p>This account already exists.</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => {
                setActiveAuthTab('signin');
                toast.dismiss();
              }}
            >
              Switch to Sign In
            </Button>
          </div>,
          { duration: 8000 }
        );
        // Auto-switch to sign in tab
        setActiveAuthTab('signin');
      } else {
        toast.error(error.message);
      }
    }
    // After successful signup (with auto-confirm), user will be signed in and useEffect triggers claim
  };

  // Screen 8: Join Invitation (Auth step) - OPN3.008-2/3/4/5
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
              You are joining as the <strong>invited person</strong>.
            </CardDescription>
            {/* OPN3.008-5: Show inviter context */}
            {invitePreview?.is_valid && (
              <p className="text-sm text-muted-foreground mt-2">
                Invited by <strong>{invitePreview.inviter_handle || invitePreview.inviter_email}</strong>
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* OPN3.008-3: Alpha persona switch notice */}
            {isAlphaSwitch && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  <strong>Persona Switch Complete:</strong> You have been signed out of the inviter account.
                </p>
              </div>
            )}

            {/* OPN3.008-5: Alpha tip about prefilled data */}
            {invitePreview?.is_valid && (invitePreview.invitee_name || invitePreview.invitee_email) && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>The inviter has provided starting information for you.</strong> You can accept the relationship now and update your own information later.
                </p>
              </div>
            )}

            {/* Inline Auth Tabs - OPN3.008-4 */}
            <Tabs value={activeAuthTab} onValueChange={setActiveAuthTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signup">Create Account</TabsTrigger>
                <TabsTrigger value="signin">Sign In</TabsTrigger>
              </TabsList>

              <TabsContent value="signup" className="mt-4">
                <form onSubmit={handleInlineSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-handle">Display Name (optional)</Label>
                    <Input
                      id="signup-handle"
                      type="text"
                      placeholder="Your name"
                      value={authHandle}
                      onChange={(e) => setAuthHandle(e.target.value)}
                      maxLength={50}
                    />
                    {invitePreview?.invitee_name && authHandle === invitePreview.invitee_name && (
                      <p className="text-xs text-muted-foreground">Pre-filled from invitation</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      required
                    />
                    {invitePreview?.invitee_email && authEmail === invitePreview.invitee_email && (
                      <p className="text-xs text-muted-foreground">Pre-filled from invitation</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="At least 6 characters"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={authSubmitting}>
                    {authSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create Account & Continue
                  </Button>
                </form>
                {/* OPN3.008-4: Inline copy update */}
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Your account will be created and you will continue automatically.
                </p>
              </TabsContent>

              <TabsContent value="signin" className="mt-4">
                <form onSubmit={handleInlineSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={authSubmitting}>
                    {authSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In & Continue
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            
            {/* Alpha Test Tip */}
            <div className="p-3 bg-primary/5 border border-primary/30 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Alpha Test Tip:</strong> {isAlphaSwitch 
                  ? 'Create a new account to act as the invited person, or sign in if you already have an invitee test account.'
                  : 'If you have not created the invitee test account, choose Create Account. Otherwise, choose Sign In.'}
              </p>
            </div>
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
            
            {/* Alpha next step: Lifecycle Management (OPN3.011) - OPN3.010-C boundary */}
            <div className="p-4 bg-primary/5 border border-primary/30 rounded-lg space-y-3">
              <p className="text-sm font-medium text-center">OPN3.010 Complete — Next Phase</p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/invite')}
              >
                Begin OPN3.011 (Placeholder)
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Trust Revocation is now complete.
                Lifecycle management will be part of the next thread.
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