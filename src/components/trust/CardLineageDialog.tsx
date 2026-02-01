import { useState, useEffect } from 'react';
import { MemberCardInstance, CardLineageItem } from '@/hooks/useMemberCards';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowDown, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardLineageDialogProps {
  card: MemberCardInstance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getLineage: (cardId: string) => Promise<{ error: Error | null; lineage: CardLineageItem[] }>;
}

export function CardLineageDialog({ card, open, onOpenChange, getLineage }: CardLineageDialogProps) {
  const [loading, setLoading] = useState(true);
  const [lineage, setLineage] = useState<CardLineageItem[]>([]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getLineage(card.id).then(({ lineage }) => {
        setLineage(lineage);
        setLoading(false);
      });
    }
  }, [open, card.id, getLineage]);

  const formatValue = (data: Record<string, unknown>) => {
    const cardKey = card.catalog_card?.card_key;
    if (cardKey === 'identity.basic') return data.name as string || '(no name)';
    if (cardKey === 'contact.email') return data.email as string || '(no email)';
    if (cardKey === 'contact.phone') return data.phone as string || '(no phone)';
    return JSON.stringify(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>CARD History</DialogTitle>
          <DialogDescription>
            {card.catalog_card?.title} lineage showing all versions from original to current
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : lineage.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No lineage data available
            </p>
          ) : (
            <div className="space-y-2">
              {lineage.map((item, index) => (
                <div key={item.id}>
                  <div
                    className={cn(
                      "p-3 rounded-lg border transition-colors",
                      item.is_current 
                        ? "bg-primary/5 border-primary/30" 
                        : "bg-muted/30 border-border/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-muted-foreground">
                            v{item.position_in_chain}
                          </span>
                          <Badge variant={item.is_current ? "default" : "secondary"} className="text-xs">
                            {item.label || 'Unlabeled'}
                          </Badge>
                          {item.is_current && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className={cn(
                          "font-medium",
                          !item.is_current && "text-muted-foreground line-through"
                        )}>
                          {formatValue(item.card_data)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created {new Date(item.created_at).toLocaleString()}
                          {item.superseded_at && (
                            <> • Superseded {new Date(item.superseded_at).toLocaleString()}</>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {index < lineage.length - 1 && (
                    <div className="flex justify-center py-1">
                      <ArrowDown className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
