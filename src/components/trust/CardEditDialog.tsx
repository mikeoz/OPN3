import { useState } from 'react';
import { MemberCardInstance } from '@/hooks/useMemberCards';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CardEditDialogProps {
  card: MemberCardInstance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (cardId: string, newData: Record<string, unknown>, newLabel?: string) => Promise<void>;
}

export function CardEditDialog({ card, open, onOpenChange, onSave }: CardEditDialogProps) {
  const cardKey = card.catalog_card?.card_key || '';
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const data: Record<string, string> = {};
    if (cardKey === 'identity.basic') {
      data.name = (card.card_data.name as string) || '';
    } else if (cardKey === 'contact.email') {
      data.email = (card.card_data.email as string) || '';
    } else if (cardKey === 'contact.phone') {
      data.phone = (card.card_data.phone as string) || '';
    }
    return data;
  });
  const [label, setLabel] = useState(card.label || 'Primary');

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(card.id, formData, label !== card.label ? label : undefined);
    } finally {
      setSaving(false);
    }
  };

  const getFieldLabel = () => {
    if (cardKey === 'identity.basic') return 'Name';
    if (cardKey === 'contact.email') return 'Email Address';
    if (cardKey === 'contact.phone') return 'Phone Number';
    return 'Value';
  };

  const getFieldKey = () => {
    if (cardKey === 'identity.basic') return 'name';
    if (cardKey === 'contact.email') return 'email';
    if (cardKey === 'contact.phone') return 'phone';
    return 'value';
  };

  const fieldKey = getFieldKey();
  const currentValue = formData[fieldKey] || '';
  const originalValue = (card.card_data[fieldKey] as string) || '';
  const hasChanges = currentValue !== originalValue || label !== card.label;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {card.catalog_card?.title || 'CARD'}</DialogTitle>
          <DialogDescription>
            Editing creates a new version. The original CARD is preserved for history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="default" className="bg-muted/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Non-mutating edit:</strong> This will create a new CARD instance and mark the current one as superseded.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Primary, Work, Personal"
            />
            <p className="text-xs text-muted-foreground">
              Labels help organize multiple CARDs of the same type
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">{getFieldLabel()}</Label>
            <Input
              id="value"
              type={cardKey === 'contact.email' ? 'email' : 'text'}
              value={currentValue}
              onChange={(e) => setFormData({ ...formData, [fieldKey]: e.target.value })}
              placeholder={`Enter ${getFieldLabel().toLowerCase()}`}
            />
          </div>

          {currentValue !== originalValue && (
            <div className="text-sm text-muted-foreground">
              <span className="line-through">{originalValue || '(empty)'}</span>
              <span className="mx-2">→</span>
              <span className="font-medium text-foreground">{currentValue || '(empty)'}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating new version...
              </>
            ) : (
              'Save as New Version'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
