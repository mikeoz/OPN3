import { AuditEvent } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { 
  UserPlus, 
  Send, 
  Check, 
  X, 
  Link2, 
  Unlink 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditEventItemProps {
  event: AuditEvent;
}

const eventConfig = {
  'member.created': {
    icon: UserPlus,
    label: 'Account created',
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  'invitation.sent': {
    icon: Send,
    label: 'Invitation sent',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  'invitation.accepted': {
    icon: Check,
    label: 'Invitation accepted',
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  'invitation.rejected': {
    icon: X,
    label: 'Invitation rejected',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  'relationship.created': {
    icon: Link2,
    label: 'Relationship established',
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  'relationship.revoked': {
    icon: Unlink,
    label: 'Relationship terminated',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
};

export function AuditEventItem({ event }: AuditEventItemProps) {
  const { user } = useAuth();
  const config = eventConfig[event.event_type];
  const Icon = config.icon;

  const isActor = event.actor_member_id === user?.id;
  const actorName = event.actor_member?.handle || event.actor_member?.email || 'Unknown';
  const subjectName = event.subject_member?.handle || event.subject_member?.email || 'Unknown';

  const getDescription = () => {
    switch (event.event_type) {
      case 'member.created':
        return isActor ? 'You joined Opn3' : `${actorName} joined`;
      case 'invitation.sent':
        return isActor 
          ? `You sent an invitation to ${subjectName}` 
          : `${actorName} sent you an invitation`;
      case 'invitation.accepted':
        return isActor 
          ? `You accepted ${subjectName}'s invitation` 
          : `${actorName} accepted your invitation`;
      case 'invitation.rejected':
        return isActor 
          ? `You rejected ${subjectName}'s invitation` 
          : `${actorName} rejected your invitation`;
      case 'relationship.created':
        return isActor 
          ? `Relationship with ${subjectName} established` 
          : `Relationship with ${actorName} established`;
      case 'relationship.revoked':
        return isActor 
          ? `You terminated relationship with ${subjectName}` 
          : `${actorName} terminated your relationship`;
      default:
        return 'Unknown event';
    }
  };

  return (
    <div className="flex gap-4 py-4 border-b last:border-0">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", config.bgColor)}>
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{config.label}</p>
        <p className="text-sm text-muted-foreground">{getDescription()}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}
