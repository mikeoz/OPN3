import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { InvitationCard } from '@/components/trust/InvitationCard';
import { ShareProposalCard } from '@/components/trust/ShareProposalCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Invitation, Card as CardType, Member, SharingScenario, ShareProposal } from '@/lib/types';
import { Inbox as InboxIcon, Loader2, Send, Share2 } from 'lucide-react';

export default function Inbox() {
  const { user } = useAuth();
  const [receivedInvitations, setReceivedInvitations] = useState<Invitation[]>([]);
  const [sentInvitations, setSentInvitations] = useState<Invitation[]>([]);
  const [invitationCards, setInvitationCards] = useState<Record<string, CardType[]>>({});
  const [receivedProposals, setReceivedProposals] = useState<ShareProposal[]>([]);
  const [sentProposals, setSentProposals] = useState<ShareProposal[]>([]);
  const [proposalCards, setProposalCards] = useState<Record<string, CardType[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    await Promise.all([fetchInvitations(), fetchShareProposals()]);
    setLoading(false);
  };

  const fetchInvitations = async () => {
    if (!user) return;

    // Fetch received invitations
    const { data: received } = await supabase
      .from('tno_invitations')
      .select(`
        *,
        from_member:tno_members!tno_invitations_from_member_id_fkey(*),
        scenario:tno_sharing_scenarios(*)
      `)
      .eq('to_member_id', user.id)
      .order('created_at', { ascending: false });

    // Fetch sent invitations
    const { data: sent } = await supabase
      .from('tno_invitations')
      .select(`
        *,
        to_member:tno_members!tno_invitations_to_member_id_fkey(*),
        scenario:tno_sharing_scenarios(*)
      `)
      .eq('from_member_id', user.id)
      .order('created_at', { ascending: false });

    // Fetch cards for each invitation's card share
    const allInvitations = [...(received || []), ...(sent || [])];
    const cardsMap: Record<string, CardType[]> = {};

    for (const inv of allInvitations) {
      const { data: cardShare } = await supabase
        .from('tno_card_shares')
        .select('card_share_id')
        .eq('invitation_id', inv.invitation_id)
        .maybeSingle();

      if (cardShare) {
        const { data: items } = await supabase
          .from('tno_card_share_items')
          .select(`
            position,
            card:tno_card_catalog(*)
          `)
          .eq('card_share_id', cardShare.card_share_id)
          .order('position');

        if (items) {
          cardsMap[inv.invitation_id] = items.map(i => i.card as unknown as CardType);
        }
      }
    }

    setReceivedInvitations((received || []).map(inv => ({
      ...inv,
      from_member: inv.from_member as Member,
      scenario: inv.scenario as SharingScenario,
    })) as Invitation[]);
    
    setSentInvitations((sent || []).map(inv => ({
      ...inv,
      to_member: inv.to_member as Member,
      scenario: inv.scenario as SharingScenario,
    })) as Invitation[]);
    
    setInvitationCards(cardsMap);
  };

  const fetchShareProposals = async () => {
    if (!user) return;

    // Fetch received proposals
    const { data: received } = await supabase
      .from('tno_share_proposals')
      .select(`
        *,
        from_member:tno_members!tno_share_proposals_from_member_id_fkey(*),
        to_member:tno_members!tno_share_proposals_to_member_id_fkey(*),
        scenario:tno_sharing_scenarios(*)
      `)
      .eq('to_member_id', user.id)
      .order('created_at', { ascending: false });

    // Fetch sent proposals
    const { data: sent } = await supabase
      .from('tno_share_proposals')
      .select(`
        *,
        from_member:tno_members!tno_share_proposals_from_member_id_fkey(*),
        to_member:tno_members!tno_share_proposals_to_member_id_fkey(*),
        scenario:tno_sharing_scenarios(*)
      `)
      .eq('from_member_id', user.id)
      .order('created_at', { ascending: false });

    // Fetch cards for each proposal
    const allProposals = [...(received || []), ...(sent || [])];
    const cardsMap: Record<string, CardType[]> = {};

    for (const proposal of allProposals) {
      const { data: items } = await supabase
        .from('tno_share_proposal_items')
        .select(`
          position,
          card:tno_card_catalog(*)
        `)
        .eq('proposal_id', proposal.proposal_id)
        .order('position');

      if (items) {
        cardsMap[proposal.proposal_id] = items.map(i => i.card as unknown as CardType);
      }
    }

    setReceivedProposals((received || []).map(p => ({
      ...p,
      from_member: p.from_member as Member,
      to_member: p.to_member as Member,
      scenario: p.scenario as SharingScenario,
    })) as ShareProposal[]);

    setSentProposals((sent || []).map(p => ({
      ...p,
      from_member: p.from_member as Member,
      to_member: p.to_member as Member,
      scenario: p.scenario as SharingScenario,
    })) as ShareProposal[]);

    setProposalCards(cardsMap);
  };

  const pendingReceived = receivedInvitations.filter(i => i.status === 'pending');
  const otherReceived = receivedInvitations.filter(i => i.status !== 'pending');
  const pendingProposals = receivedProposals.filter(p => p.status === 'pending');
  const otherProposals = receivedProposals.filter(p => p.status !== 'pending');

  const totalPending = pendingReceived.length + pendingProposals.length;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
          <p className="text-muted-foreground mt-1">
            Manage your invitations and share proposals
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="received" className="space-y-6">
            <TabsList>
              <TabsTrigger value="received" className="gap-2">
                <InboxIcon className="h-4 w-4" />
                Received
                {totalPending > 0 && (
                  <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                    {totalPending}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="sent" className="gap-2">
                <Send className="h-4 w-4" />
                Sent
              </TabsTrigger>
            </TabsList>

            <TabsContent value="received" className="space-y-8">
              {receivedInvitations.length === 0 && receivedProposals.length === 0 ? (
                <div className="text-center py-12">
                  <InboxIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-lg font-semibold mb-2">No items</h2>
                  <p className="text-muted-foreground">
                    When someone invites you or proposes sharing, it will appear here.
                  </p>
                </div>
              ) : (
                <>
                  {/* Pending Share Proposals */}
                  {pendingProposals.length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Share2 className="h-4 w-4 text-primary" />
                        <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                        Pending Share Proposals ({pendingProposals.length})
                      </h2>
                      <div className="grid gap-4">
                        {pendingProposals.map((proposal) => (
                          <ShareProposalCard
                            key={proposal.proposal_id}
                            proposal={proposal}
                            cards={proposalCards[proposal.proposal_id] || []}
                            isReceived={true}
                            onAction={fetchData}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pending Invitations */}
                  {pendingReceived.length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                        Pending Invitations ({pendingReceived.length})
                      </h2>
                      <div className="grid gap-4">
                        {pendingReceived.map((invitation) => (
                          <InvitationCard
                            key={invitation.invitation_id}
                            invitation={invitation}
                            cards={invitationCards[invitation.invitation_id] || []}
                            onAction={fetchData}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* History - Share Proposals */}
                  {otherProposals.length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
                        <Share2 className="h-4 w-4" />
                        Share Proposal History ({otherProposals.length})
                      </h2>
                      <div className="grid gap-4 opacity-60">
                        {otherProposals.map((proposal) => (
                          <ShareProposalCard
                            key={proposal.proposal_id}
                            proposal={proposal}
                            cards={proposalCards[proposal.proposal_id] || []}
                            isReceived={true}
                            onAction={fetchData}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* History - Invitations */}
                  {otherReceived.length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-lg font-semibold text-muted-foreground">
                        Invitation History ({otherReceived.length})
                      </h2>
                      <div className="grid gap-4 opacity-60">
                        {otherReceived.map((invitation) => (
                          <InvitationCard
                            key={invitation.invitation_id}
                            invitation={invitation}
                            cards={invitationCards[invitation.invitation_id] || []}
                            onAction={fetchData}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="sent" className="space-y-8">
              {sentInvitations.length === 0 && sentProposals.length === 0 ? (
                <div className="text-center py-12">
                  <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-lg font-semibold mb-2">No sent items</h2>
                  <p className="text-muted-foreground">
                    Invitations and share proposals you send will appear here.
                  </p>
                </div>
              ) : (
                <>
                  {/* Sent Share Proposals */}
                  {sentProposals.length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Share2 className="h-4 w-4 text-primary" />
                        Sent Share Proposals ({sentProposals.length})
                      </h2>
                      <div className="grid gap-4">
                        {sentProposals.map((proposal) => (
                          <ShareProposalCard
                            key={proposal.proposal_id}
                            proposal={proposal}
                            cards={proposalCards[proposal.proposal_id] || []}
                            isReceived={false}
                            onAction={fetchData}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sent Invitations */}
                  {sentInvitations.length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-lg font-semibold">
                        Sent Invitations ({sentInvitations.length})
                      </h2>
                      <div className="grid gap-4">
                        {sentInvitations.map((invitation) => (
                          <InvitationCard
                            key={invitation.invitation_id}
                            invitation={{
                              ...invitation,
                              from_member: invitation.to_member, // swap for display
                            }}
                            cards={invitationCards[invitation.invitation_id] || []}
                            onAction={fetchData}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
