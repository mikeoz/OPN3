import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { RelationshipCard } from '@/components/trust/RelationshipCard';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Relationship, Member, SharingScenario } from '@/lib/types';
import { Users, Send, Loader2 } from 'lucide-react';

export default function Home() {
  const { user } = useAuth();
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRelationships();
    }
  }, [user]);

  const fetchRelationships = async () => {
    if (!user) return;
    
    // Fetch relationships where user is either member_a or member_b
    const { data } = await supabase
      .from('tno_relationships')
      .select(`
        *,
        scenario:tno_sharing_scenarios(*)
      `)
      .or(`member_a_id.eq.${user.id},member_b_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (data) {
      // Fetch other member info for each relationship
      const relationshipsWithMembers = await Promise.all(
        data.map(async (rel) => {
          const otherMemberId = rel.member_a_id === user.id ? rel.member_b_id : rel.member_a_id;
          const { data: member } = await supabase
            .from('tno_members')
            .select('*')
            .eq('member_id', otherMemberId)
            .single();
          
          return {
            ...rel,
            other_member: member as Member,
            scenario: rel.scenario as SharingScenario,
          } as Relationship;
        })
      );
      
      setRelationships(relationshipsWithMembers);
    }
    setLoading(false);
  };

  const activeRelationships = relationships.filter(r => r.status === 'active');
  const terminatedRelationships = relationships.filter(r => r.status === 'terminated');

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Relationships</h1>
            <p className="text-muted-foreground mt-1">
              Your trusted connections
            </p>
          </div>
          <Link to="/invite">
            <Button>
              <Send className="h-4 w-4 mr-2" />
              Invite
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : activeRelationships.length === 0 && terminatedRelationships.length === 0 ? (
          /* Empty state */
          <div className="text-center py-16 px-4">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-6">
              <Users className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No relationships yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Start building your trust network by inviting someone to share with you.
            </p>
            <Link to="/invite">
              <Button size="lg">
                <Send className="h-4 w-4 mr-2" />
                Send your first invitation
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Active relationships */}
            {activeRelationships.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  Active ({activeRelationships.length})
                </h2>
                <div className="grid gap-3">
                  {activeRelationships.map((relationship) => (
                    <RelationshipCard 
                      key={relationship.relationship_id} 
                      relationship={relationship} 
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Terminated relationships */}
            {terminatedRelationships.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-destructive" />
                  Terminated ({terminatedRelationships.length})
                </h2>
                <div className="grid gap-3 opacity-60">
                  {terminatedRelationships.map((relationship) => (
                    <RelationshipCard 
                      key={relationship.relationship_id} 
                      relationship={relationship} 
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
