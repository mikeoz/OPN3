import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CardBadge } from '@/components/trust/CardBadge';
import { RelationshipCardForm, buildRelationshipCardJson } from '@/components/trust/RelationshipCardForm';
import { supabase } from '@/integrations/supabase/client';
import { Member, SharingScenario, Card as CardType, PersonalCardData } from '@/lib/types';
import { toast } from 'sonner';
import { Send, Loader2, Users, ChevronRight, Copy, Mail, ExternalLink, Info, Play } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Invite() {
  const { user, member } = useAuth();
  const navigate = useNavigate();
  
  const [members, setMembers] = useState<Member[]>([]);
  const [scenarios, setScenarios] = useState<SharingScenario[]>([]);
  const [scenarioCards, setScenarioCards] = useState<Record<string, CardType[]>>({});
  
  // Member invite state
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [message, setMessage] = useState('');
  
  // Email invite state
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [inviteeName, setInviteeName] = useState('');
  const [inviteePhone, setInviteePhone] = useState('');
  // Removed: inviteeOrg, inviteeTitle - deferred per OPN3.008-1
  const [emailScenario, setEmailScenario] = useState<string>('');
  const [emailMessage, setEmailMessage] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string>('');
  
  // Relationship CARD state (OPN3.008)
  const [relationshipEnabled, setRelationshipEnabled] = useState(false);
  const [inviterRelLabel, setInviterRelLabel] = useState('');
  const [inviteeRelLabel, setInviteeRelLabel] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    // Fetch other members
    const { data: membersData } = await supabase
      .from('tno_members')
      .select('*')
      .neq('member_id', user.id)
      .eq('status', 'active');

    // Fetch scenarios
    const { data: scenariosData } = await supabase
      .from('tno_sharing_scenarios')
      .select('*')
      .eq('status', 'active');

    // Fetch cards for each scenario
    if (scenariosData) {
      const cardsMap: Record<string, CardType[]> = {};
      
      for (const scenario of scenariosData) {
        const { data: scenarioCardsData } = await supabase
          .from('tno_scenario_cards')
          .select(`
            position,
            card:tno_card_catalog(*)
          `)
          .eq('scenario_id', scenario.scenario_id)
          .order('position');
        
        if (scenarioCardsData) {
          cardsMap[scenario.scenario_id] = scenarioCardsData.map(sc => sc.card as unknown as CardType);
        }
      }
      
      setScenarioCards(cardsMap);
    }

    setMembers((membersData || []) as Member[]);
    setScenarios((scenariosData || []) as SharingScenario[]);
    // Auto-select first scenario for Alpha (sharing scenario is disabled)
    if (scenariosData && scenariosData.length > 0) {
      setEmailScenario(scenariosData[0].scenario_id);
    }
    setLoading(false);
  };

  const handleSendMember = async () => {
    if (!user || !selectedMember || !selectedScenario) {
      toast.error('Please select a recipient and scenario');
      return;
    }

    setSending(true);

    try {
      // Create invitation
      const { data: invitation, error: invError } = await supabase
        .from('tno_invitations')
        .insert({
          from_member_id: user.id,
          to_member_id: selectedMember,
          scenario_id: selectedScenario,
          message: message || null,
        })
        .select()
        .single();

      if (invError) throw invError;

      // Create card share
      const { data: cardShare, error: shareError } = await supabase
        .from('tno_card_shares')
        .insert({
          invitation_id: invitation.invitation_id,
          from_member_id: user.id,
          to_member_id: selectedMember,
          scenario_id: selectedScenario,
        })
        .select()
        .single();

      if (shareError) throw shareError;

      // Copy cards from scenario to card share items
      const cards = scenarioCards[selectedScenario] || [];
      if (cards.length > 0) {
        const shareItems = cards.map((card, index) => ({
          card_share_id: cardShare.card_share_id,
          card_id: card.card_id,
          position: index + 1,
        }));

        await supabase.from('tno_card_share_items').insert(shareItems);
      }

      // Create audit event
      await supabase.from('tno_audit_events').insert({
        event_type: 'invitation.sent',
        actor_member_id: user.id,
        subject_member_id: selectedMember,
        invitation_id: invitation.invitation_id,
        card_share_id: cardShare.card_share_id,
      });

      toast.success('Invitation sent!');
      navigate('/');
    } catch (error) {
      toast.error('Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const handleSendEmail = async () => {
    if (!user || !inviteeEmail || !emailScenario) {
      toast.error('Please enter an email and select a scenario');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteeEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSending(true);

    try {
      const invitationCardJson: PersonalCardData = {
        name: inviteeName || '',
        email: inviteeEmail,
        phone: inviteePhone || undefined,
        // Removed org/title fields per OPN3.008-1
      };

      // Build relationship card if enabled (OPN3.008)
      const relationshipCardJson = buildRelationshipCardJson(
        relationshipEnabled,
        inviterRelLabel,
        inviteeRelLabel
      );

      // Create invite link with relationship_card_json
      const { data: inviteLink, error: linkError } = await (supabase
        .from('tno_invite_links' as 'tno_members')
        .insert({
          inviter_member_id: user.id,
          invitee_email: inviteeEmail,
          invitee_name: inviteeName || null,
          scenario_id: emailScenario,
          invitation_card_json: invitationCardJson,
          relationship_card_json: relationshipCardJson,
        } as never)
        .select()
        .single()) as { data: { id: string; token: string; invitation_id: string | null } | null; error: Error | null };

      if (linkError) throw linkError;

      // Create invitation (with to_email, without to_member_id)
      const { data: invitation, error: invError } = await supabase
        .from('tno_invitations')
        .insert({
          from_member_id: user.id,
          to_email: inviteeEmail,
          scenario_id: emailScenario,
          message: emailMessage || null,
          invite_link_id: inviteLink.id,
        })
        .select()
        .single();

      if (invError) throw invError;

      // Update invite link with invitation_id
      await supabase
        .from('tno_invite_links')
        .update({ invitation_id: invitation.invitation_id })
        .eq('id', inviteLink.id);

      // Create card share (to_member_id will be set when claimed)
      const { data: cardShare, error: shareError } = await supabase
        .from('tno_card_shares')
        .insert({
          invitation_id: invitation.invitation_id,
          from_member_id: user.id,
          to_member_id: user.id, // Temporarily set to inviter, will be updated on claim
          scenario_id: emailScenario,
        })
        .select()
        .single();

      if (shareError) throw shareError;

      // Copy cards from scenario to card share items
      const cards = scenarioCards[emailScenario] || [];
      if (cards.length > 0) {
        const shareItems = cards.map((card, index) => ({
          card_share_id: cardShare.card_share_id,
          card_id: card.card_id,
          position: index + 1,
        }));

        await supabase.from('tno_card_share_items').insert(shareItems);
      }

      // Create audit event
      await supabase.from('tno_audit_events').insert({
        event_type: 'invite.created',
        actor_member_id: user.id,
        metadata: { 
          invite_link_id: inviteLink.id,
          invitee_email: inviteeEmail,
        },
      });

      // If relationship card was proposed, create audit event (OPN3.008)
      if (relationshipCardJson) {
        await supabase.from('tno_audit_events').insert({
          event_type: 'relationship_card.proposed' as const,
          actor_member_id: user.id,
          metadata: relationshipCardJson as unknown as Record<string, unknown>,
        } as never);
      }

      // Generate the join link
      const joinLink = `${window.location.origin}/join?token=${inviteLink.token}`;
      setGeneratedLink(joinLink);

      toast.success('Invite link created!');
    } catch (error) {
      console.error('Error creating invite:', error);
      toast.error('Failed to create invite link');
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink);
      toast.success('Link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleOpenAsInvitee = () => {
    window.open(generatedLink, '_blank');
  };

  // OPN3.008-2: Continue as invitee in same session for Alpha testing
  const handleContinueAsInvitee = () => {
    // Navigate to join link in same window for persona switch
    window.location.href = generatedLink;
  };

  const handleResetEmailForm = () => {
    setInviteeEmail('');
    setInviteeName('');
    setInviteePhone('');
    // emailScenario stays auto-selected
    setEmailMessage('');
    setGeneratedLink('');
    // Reset relationship CARD state (OPN3.008)
    setRelationshipEnabled(false);
    setInviterRelLabel('');
    setInviteeRelLabel('');
  };

  const selectedScenarioData = scenarios.find(s => s.scenario_id === selectedScenario);
  const selectedCards = selectedScenario ? scenarioCards[selectedScenario] || [] : [];
  const emailScenarioData = scenarios.find(s => s.scenario_id === emailScenario);
  const emailCards = emailScenario ? scenarioCards[emailScenario] || [] : [];

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Send Invitation</h1>
          <p className="text-muted-foreground mt-1">
            Invite someone to establish a trusted relationship
          </p>
        </div>

        <Tabs defaultValue="member" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="member" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Invite Member
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Invite by Email
            </TabsTrigger>
          </TabsList>

          {/* Member Invite Tab */}
          <TabsContent value="member" className="space-y-6">
            {members.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-lg font-semibold mb-2">No other members yet</h2>
                  <p className="text-muted-foreground">
                    Use the "Invite by Email" tab to invite new people to join.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Step 1: Select Recipient */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                      Select Recipient
                    </CardTitle>
                    <CardDescription>Choose who you want to invite</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Select value={selectedMember} onValueChange={setSelectedMember}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a member..." />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((member) => (
                          <SelectItem key={member.member_id} value={member.member_id}>
                            {member.handle || member.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {/* Step 2: Select Scenario */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                      Select Sharing Scenario
                    </CardTitle>
                    <CardDescription>What would you like to share?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3">
                      {scenarios.map((scenario) => (
                        <button
                          key={scenario.scenario_id}
                          type="button"
                          onClick={() => setSelectedScenario(scenario.scenario_id)}
                          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                            selectedScenario === scenario.scenario_id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{scenario.title}</p>
                              <p className="text-sm text-muted-foreground">{scenario.description}</p>
                            </div>
                            <ChevronRight className={`h-5 w-5 transition-transform ${
                              selectedScenario === scenario.scenario_id ? 'rotate-90 text-primary' : 'text-muted-foreground'
                            }`} />
                          </div>
                        </button>
                      ))}
                    </div>

                    {selectedScenarioData && (
                      <div className="pt-4 border-t">
                        <p className="text-sm font-medium mb-3">CARDs in this scenario:</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedCards.map((card) => (
                            <CardBadge key={card.card_id} card={card} />
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Step 3: Optional Message */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold">3</span>
                      Add a Message
                      <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Add a personal message to your invitation..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={500}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground mt-2">{message.length}/500</p>
                  </CardContent>
                </Card>

                {/* Send Button */}
                <Button 
                  size="lg" 
                  className="w-full"
                  onClick={handleSendMember}
                  disabled={!selectedMember || !selectedScenario || sending}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Invitation
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Email Invite Tab */}
          <TabsContent value="email" className="space-y-6">
            {generatedLink ? (
              // Screen 7: Invite Link Ready (OPN3.008-2)
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="text-lg text-primary">Invite Link Ready!</CardTitle>
                  <CardDescription>
                    Share this link with {inviteeName || inviteeEmail} to invite them to join
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-muted rounded-lg break-all font-mono text-sm">
                    {generatedLink}
                  </div>
                  
                  {/* Primary action: Continue as Invitee for Alpha testing */}
                  <Button onClick={handleContinueAsInvitee} className="w-full" size="lg">
                    <Play className="h-4 w-4 mr-2" />
                    Continue as Invitee (Alpha Test)
                  </Button>

                  {/* Alpha Test Tip */}
                  <Alert className="border-primary/30 bg-primary/5">
                    <Info className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-sm">
                      <strong>Alpha Test Tip:</strong> Click "Continue as Invitee" above to complete the invitation flow as the receiving person. You will switch to the invitee perspective.
                    </AlertDescription>
                  </Alert>

                  {/* Secondary actions */}
                  <div className="flex gap-2">
                    <Button onClick={handleCopyLink} variant="outline" className="flex-1">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Link
                    </Button>
                    <Button variant="outline" onClick={handleOpenAsInvitee}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in New Tab
                    </Button>
                  </div>

                  {/* Disabled Create Another Invite for Alpha */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="w-full">
                          <Button 
                            variant="ghost" 
                            className="w-full opacity-50 cursor-not-allowed" 
                            disabled
                          >
                            Create Another Invite
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Available in MVP / later</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Section 1: Personal Information (CARDs) */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                      Personal Information
                    </CardTitle>
                    <CardDescription>Who are you inviting?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          placeholder="Jane Smith"
                          value={inviteeName}
                          onChange={(e) => setInviteeName(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="person@example.com"
                          value={inviteeEmail}
                          onChange={(e) => setInviteeEmail(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+1 (555) 123-4567"
                          value={inviteePhone}
                          onChange={(e) => setInviteePhone(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Section 2: Relationship (OPN3.008-1 - moved up) */}
                <RelationshipCardForm
                  enabled={relationshipEnabled}
                  onEnabledChange={setRelationshipEnabled}
                  inviterLabel={inviterRelLabel}
                  inviteeLabel={inviteeRelLabel}
                  onInviterLabelChange={setInviterRelLabel}
                  onInviteeLabelChange={setInviteeRelLabel}
                  inviterName={member?.handle || 'You'}
                  inviteeName={inviteeName || 'Invitee'}
                  stepNumber={2}
                />

                {/* Section 3: Sharing Scenario - Visually disabled for Alpha */}
                <Card className="opacity-50 pointer-events-none">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold">3</span>
                      Sharing Scenario
                      <span className="text-xs font-normal text-muted-foreground ml-2 bg-muted px-2 py-0.5 rounded">Coming later</span>
                    </CardTitle>
                    <CardDescription>What information will you share?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3">
                      {scenarios.slice(0, 1).map((scenario) => (
                        <div
                          key={scenario.scenario_id}
                          className="w-full text-left p-4 rounded-lg border-2 border-primary bg-primary/5"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{scenario.title}</p>
                              <p className="text-sm text-muted-foreground">{scenario.description}</p>
                            </div>
                            <ChevronRight className="h-5 w-5 rotate-90 text-primary" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      In this Alpha version, all invitations use the default sharing scenario.
                    </p>
                  </CardContent>
                </Card>

                {/* Generate Link Button */}
                <Button 
                  size="lg" 
                  className="w-full"
                  onClick={handleSendEmail}
                  disabled={!inviteeEmail || !emailScenario || sending}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Generate Invite Link
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}