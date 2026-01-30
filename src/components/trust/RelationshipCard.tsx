import { Link } from 'react-router-dom';
import { Relationship } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from './StatusBadge';
import { ChevronRight, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface RelationshipCardProps {
  relationship: Relationship;
}

export function RelationshipCard({ relationship }: RelationshipCardProps) {
  const otherMember = relationship.other_member;
  
  return (
    <Link to={`/relationship/${relationship.relationship_id}`}>
      <Card className="group hover:shadow-md transition-all duration-200 hover:border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {otherMember?.handle || otherMember?.email || 'Unknown Member'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {relationship.scenario?.title || 'Shared scenario'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <StatusBadge status={relationship.status} />
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(relationship.created_at), { addSuffix: true })}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
