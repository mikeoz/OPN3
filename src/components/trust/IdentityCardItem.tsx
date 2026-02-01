import { useState } from 'react';
import { MemberCardInstance } from '@/hooks/useMemberCards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Edit2, History, Check, X, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IdentityCardItemProps {
  card: MemberCardInstance;
  onEdit: () => void;
  onViewLineage: () => void;
  onLabelChange: (newLabel: string) => Promise<void>;
}

export function IdentityCardItem({ card, onEdit, onViewLineage, onLabelChange }: IdentityCardItemProps) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(card.label || '');
  const [saving, setSaving] = useState(false);

  const cardValue = formatCardValue(card);
  
  const handleSaveLabel = async () => {
    if (labelValue.trim() && labelValue !== card.label) {
      setSaving(true);
      await onLabelChange(labelValue.trim());
      setSaving(false);
    }
    setEditingLabel(false);
  };

  const handleCancelLabel = () => {
    setLabelValue(card.label || '');
    setEditingLabel(false);
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {editingLabel ? (
            <div className="flex items-center gap-1">
              <Input
                value={labelValue}
                onChange={(e) => setLabelValue(e.target.value)}
                className="h-7 w-32 text-xs"
                placeholder="Label"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveLabel();
                  if (e.key === 'Escape') handleCancelLabel();
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleSaveLabel}
                disabled={saving}
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCancelLabel}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Badge 
              variant="secondary" 
              className="cursor-pointer hover:bg-secondary/80 transition-colors"
              onClick={() => setEditingLabel(true)}
            >
              <Tag className="h-3 w-3 mr-1" />
              {card.label || 'Unlabeled'}
            </Badge>
          )}
        </div>
        <p className="font-medium truncate">{cardValue}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Created {new Date(card.created_at).toLocaleDateString()}
          {card.updated_at !== card.created_at && (
            <> • Updated {new Date(card.updated_at).toLocaleDateString()}</>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1 ml-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onViewLineage}
          title="View history"
        >
          <History className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onEdit}
          title="Edit (creates new version)"
        >
          <Edit2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function formatCardValue(card: MemberCardInstance): string {
  const data = card.card_data;
  const cardKey = card.catalog_card?.card_key;

  if (cardKey === 'identity.basic') return data.name as string || '(no name)';
  if (cardKey === 'contact.email') return data.email as string || '(no email)';
  if (cardKey === 'contact.phone') return data.phone as string || '(no phone)';

  return JSON.stringify(data);
}
