import { useState } from 'react';
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
import { Loader2 } from 'lucide-react';

interface CardCreateDialogProps {
  cardType: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (cardKey: string, cardData: Record<string, unknown>, label: string) => Promise<void>;
}

const CARD_INFO: Record<string, { title: string; field: string; fieldLabel: string; placeholder: string }> = {
  'identity.basic': {
    title: 'Person',
    field: 'name',
    fieldLabel: 'Name',
    placeholder: 'Enter your name',
  },
  'contact.email': {
    title: 'Email',
    field: 'email',
    fieldLabel: 'Email Address',
    placeholder: 'name@example.com',
  },
  'contact.phone': {
    title: 'Phone',
    field: 'phone',
    fieldLabel: 'Phone Number',
    placeholder: '+1 (555) 123-4567',
  },
};

const SUGGESTED_LABELS = ['Primary', 'Work', 'Personal', 'Home', 'Mobile'];

export function CardCreateDialog({ cardType, open, onOpenChange, onCreate }: CardCreateDialogProps) {
  const info = CARD_INFO[cardType];
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('Primary');

  if (!info) {
    return null;
  }

  const handleCreate = async () => {
    if (!value.trim()) return;
    
    setSaving(true);
    try {
      await onCreate(cardType, { [info.field]: value.trim() }, label);
    } finally {
      setSaving(false);
    }
  };

  const isValid = value.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create {info.title} CARD</DialogTitle>
          <DialogDescription>
            Create a new {info.title.toLowerCase()} CARD instance for your identity
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="value">{info.fieldLabel}</Label>
            <Input
              id="value"
              type={cardType === 'contact.email' ? 'email' : 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={info.placeholder}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Primary, Work, Personal"
            />
            <div className="flex flex-wrap gap-1 mt-1">
              {SUGGESTED_LABELS.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant={label === suggestion ? "secondary" : "ghost"}
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setLabel(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!isValid || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create CARD'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
