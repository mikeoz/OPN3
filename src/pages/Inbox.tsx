import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { InvitationCard } from '@/components/trust/InvitationCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Invitation, Card as CardType, Member, SharingScenario } from '@/lib/types';
import { Inbox as InboxIcon, Loader2, Send } from 'lucide-react';

export default function Inbox() {
  const { user } = useAuth();
  const [receivedInvitations, setReceivedInvitations] = useState<Invitation[]>([]);
  const [sentInvitations, setSentInvitations] = useState<Invitation[]>([]);
  const [invitationCards, setInvitationCards] = useState<Record<string, CardType[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchInvitations();
    }
  }, [user]);

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
    setLoading(false);
  };

  const pendingReceived = receivedInvitations.filter(i => i.status === 'pending');
  const otherReceived = receivedInvitations.filter(i => i.status !== 'pending');

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
          <p className="text-muted-foreground mt-1">
            Manage your invitations
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
                {pendingReceived.length > 0 && (
                  <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                    {pendingReceived.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="sent" className="gap-2">
                <Send className="h-4 w-4" />
                Sent
              </TabsTrigger>
            </TabsList>

            <TabsContent value="received" className="space-y-6">
              {receivedInvitations.length === 0 ? (
                <div className="text-center py-12">
                  <InboxIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-lg font-semibold mb-2">No invitations</h2>
                  <p className="text-muted-foreground">
                    When someone invites you, it will appear here.
                  </p>
                </div>
              ) : (
                <>
                  {pendingReceived.length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                        Pending ({pendingReceived.length})
                      </h2>
                      <div className="grid gap-4">
                        {pendingReceived.map((invitation) => (
                          <InvitationCard
                            key={invitation.invitation_id}
                            invitation={invitation}
                            cards={invitationCards[invitation.invitation_id] || []}
                            onAction={fetchInvitations}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {otherReceived.length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-lg font-semibold text-muted-foreground">
                        History ({otherReceived.length})
                      </h2>
                      <div className="grid gap-4 opacity-60">
                        {otherReceived.map((invitation) => (
                          <InvitationCard
                            key={invitation.invitation_id}
                            invitation={invitation}
                            cards={invitationCards[invitation.invitation_id] || []}
                            onAction={fetchInvitations}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="sent" className="space-y-4">
              {sentInvitations.length === 0 ? (
                <div className="text-center py-12">
                  <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-lg font-semibold mb-2">No sent invitations</h2>
                  <p className="text-muted-foreground">
                    Invitations you send will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {sentInvitations.map((invitation) => (
                    <InvitationCard
                      key={invitation.invitation_id}
                      invitation={{
                        ...invitation,
                        from_member: invitation.to_member, // swap for display
                      }}
                      cards={invitationCards[invitation.invitation_id] || []}
                      onAction={fetchInvitations}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
