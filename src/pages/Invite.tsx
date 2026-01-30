import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CardBadge } from '@/components/trust/CardBadge';
import { supabase } from '@/integrations/supabase/client';
import { Member, SharingScenario, Card as CardType } from '@/lib/types';
import { toast } from 'sonner';
import { Send, Loader2, Users, ChevronRight } from 'lucide-react';

export default function Invite() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [members, setMembers] = useState<Member[]>([]);
  const [scenarios, setScenarios] = useState<SharingScenario[]>([]);
  const [scenarioCards, setScenarioCards] = useState<Record<string, CardType[]>>({});
  
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [message, setMessage] = useState('');
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
    setLoading(false);
  };

  const handleSend = async () => {
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

  const selectedScenarioData = scenarios.find(s => s.scenario_id === selectedScenario);
  const selectedCards = selectedScenario ? scenarioCards[selectedScenario] || [] : [];

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
            Invite a member to establish a trusted relationship
          </p>
        </div>

        {members.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">No other members yet</h2>
              <p className="text-muted-foreground">
                You're the only member. Invite others to join Opn3 first.
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

                {/* Show cards for selected scenario */}
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
              onClick={handleSend}
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
      </div>
    </AppLayout>
  );
}
