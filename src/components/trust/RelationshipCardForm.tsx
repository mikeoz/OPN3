import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Heart, ArrowRightLeft } from 'lucide-react';
import { RelationshipCardData } from '@/lib/types';

interface RelationshipCardFormProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  inviterLabel: string;
  inviteeLabel: string;
  onInviterLabelChange: (label: string) => void;
  onInviteeLabelChange: (label: string) => void;
  inviterName?: string;
  inviteeName?: string;
}

// Alpha preset relationship types for quick selection
const RELATIONSHIP_PRESETS: { inviter: string; invitee: string; label: string }[] = [
  { inviter: 'Parent of', invitee: 'Child of', label: 'Parent / Child' },
  { inviter: 'Manager of', invitee: 'Reports to', label: 'Manager / Report' },
  { inviter: 'Mentor to', invitee: 'Mentee of', label: 'Mentor / Mentee' },
  { inviter: 'Partner with', invitee: 'Partner with', label: 'Partner (symmetric)' },
  { inviter: 'Sponsor of', invitee: 'Sponsored by', label: 'Sponsor / Sponsored' },
];

export function RelationshipCardForm({
  enabled,
  onEnabledChange,
  inviterLabel,
  inviteeLabel,
  onInviterLabelChange,
  onInviteeLabelChange,
  inviterName = 'You',
  inviteeName = 'Invitee',
}: RelationshipCardFormProps) {
  const [customMode, setCustomMode] = useState(false);

  const handlePresetSelect = (preset: typeof RELATIONSHIP_PRESETS[0]) => {
    onInviterLabelChange(preset.inviter);
    onInviteeLabelChange(preset.invitee);
    setCustomMode(false);
  };

  const handleCustomMode = () => {
    setCustomMode(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              Relationship CARD
            </CardTitle>
            <span className="text-xs font-normal text-muted-foreground">(optional)</span>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
            aria-label="Enable relationship card"
          />
        </div>
        <CardDescription>
          Declare the nature of your relationship with this person
        </CardDescription>
      </CardHeader>
      
      {enabled && (
        <CardContent className="space-y-4">
          {/* Preset Buttons */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {RELATIONSHIP_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className={`px-3 py-2 text-sm rounded-md border transition-all ${
                  inviterLabel === preset.inviter && inviteeLabel === preset.invitee && !customMode
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleCustomMode}
              className={`px-3 py-2 text-sm rounded-md border transition-all ${
                customMode
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              Custom...
            </button>
          </div>

          {/* Relationship Preview / Custom Input */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium min-w-[60px]">{inviterName}:</span>
              {customMode ? (
                <Input
                  placeholder="e.g., Parent of"
                  value={inviterLabel}
                  onChange={(e) => onInviterLabelChange(e.target.value)}
                  className="flex-1"
                />
              ) : (
                <span className="text-muted-foreground">
                  {inviterLabel || <em>Select a relationship type above</em>}
                </span>
              )}
            </div>
            
            <div className="flex justify-center">
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            </div>
            
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium min-w-[60px]">{inviteeName}:</span>
              {customMode ? (
                <Input
                  placeholder="e.g., Child of"
                  value={inviteeLabel}
                  onChange={(e) => onInviteeLabelChange(e.target.value)}
                  className="flex-1"
                />
              ) : (
                <span className="text-muted-foreground">
                  {inviteeLabel || <em>Select a relationship type above</em>}
                </span>
              )}
            </div>
          </div>

          {(inviterLabel || inviteeLabel) && (
            <p className="text-xs text-muted-foreground">
              This relationship will be proposed to {inviteeName}. It becomes active only when they accept the invitation.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function buildRelationshipCardJson(
  enabled: boolean,
  inviterLabel: string,
  inviteeLabel: string
): RelationshipCardData | null {
  if (!enabled || (!inviterLabel && !inviteeLabel)) {
    return null;
  }
  return {
    inviter_label: inviterLabel,
    invitee_label: inviteeLabel,
  };
}
