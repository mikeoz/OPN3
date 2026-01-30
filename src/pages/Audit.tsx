import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuditEventItem } from '@/components/trust/AuditEventItem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { AuditEvent, Member } from '@/lib/types';
import { History, Loader2 } from 'lucide-react';

export default function Audit() {
  const { user } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchEvents();
    }
  }, [user]);

  const fetchEvents = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('tno_audit_events')
      .select('*')
      .or(`actor_member_id.eq.${user.id},subject_member_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      // Fetch member info for each event
      const eventsWithMembers = await Promise.all(
        data.map(async (event) => {
          let actor_member: Member | undefined;
          let subject_member: Member | undefined;

          if (event.actor_member_id) {
            const { data: actor } = await supabase
              .from('tno_members')
              .select('*')
              .eq('member_id', event.actor_member_id)
              .single();
            actor_member = actor as Member;
          }

          if (event.subject_member_id && event.subject_member_id !== event.actor_member_id) {
            const { data: subject } = await supabase
              .from('tno_members')
              .select('*')
              .eq('member_id', event.subject_member_id)
              .single();
            subject_member = subject as Member;
          }

          return {
            ...event,
            actor_member,
            subject_member: subject_member || actor_member,
          } as AuditEvent;
        })
      );

      setEvents(eventsWithMembers);
    }

    setLoading(false);
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity</h1>
          <p className="text-muted-foreground mt-1">
            Your trust network audit trail
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">No activity yet</h2>
            <p className="text-muted-foreground">
              Your trust network activity will appear here.
            </p>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {events.map((event) => (
                  <AuditEventItem key={event.audit_id} event={event} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
