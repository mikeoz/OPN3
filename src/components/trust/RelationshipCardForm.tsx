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
  stepNumber?: number; // Optional step indicator
}

// Alpha preset relationship types - informal labels ("what I call you")
// Friend is the default option
const INFORMAL_PRESETS: { inviter: string; invitee: string; label: string }[] = [
  { inviter: 'Friend', invitee: 'Friend', label: 'Friend' },
  { inviter: 'Colleague', invitee: 'Colleague', label: 'Colleague' },
  { inviter: 'Acquaintance', invitee: 'Acquaintance', label: 'Acquaintance' },
];

// Family roles offered via dropdown
const FAMILY_PRESETS: { inviter: string; invitee: string; label: string }[] = [
  { inviter: 'Parent of', invitee: 'Child of', label: 'Parent / Child' },
  { inviter: 'Child of', invitee: 'Parent of', label: 'Child / Parent' },
  { inviter: 'Sibling of', invitee: 'Sibling of', label: 'Sibling' },
  { inviter: 'Spouse of', invitee: 'Spouse of', label: 'Spouse' },
  { inviter: 'Grandparent of', invitee: 'Grandchild of', label: 'Grandparent / Grandchild' },
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
  stepNumber,
}: RelationshipCardFormProps) {
  const [customMode, setCustomMode] = useState(false);
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false);

  // Set default to Friend when enabled
  const handleEnabledChange = (newEnabled: boolean) => {
    onEnabledChange(newEnabled);
    if (newEnabled && !inviterLabel && !inviteeLabel) {
      // Default to Friend
      onInviterLabelChange('Friend');
      onInviteeLabelChange('Friend');
    }
  };

  const handlePresetSelect = (preset: { inviter: string; invitee: string }) => {
    onInviterLabelChange(preset.inviter);
    onInviteeLabelChange(preset.invitee);
    setCustomMode(false);
    setShowFamilyDropdown(false);
  };

  const handleFamilySelect = (preset: { inviter: string; invitee: string }) => {
    onInviterLabelChange(preset.inviter);
    onInviteeLabelChange(preset.invitee);
    setCustomMode(false);
    setShowFamilyDropdown(false);
  };

  const handleCustomMode = () => {
    setCustomMode(true);
    setShowFamilyDropdown(false);
  };

  const isPresetSelected = (preset: { inviter: string; invitee: string }) => 
    inviterLabel === preset.inviter && inviteeLabel === preset.invitee && !customMode;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {stepNumber && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {stepNumber}
              </span>
            )}
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              What I Call You
            </CardTitle>
            <span className="text-xs font-normal text-muted-foreground">(optional)</span>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleEnabledChange}
            aria-label="Enable relationship declaration"
          />
        </div>
        <CardDescription>
          How would you describe your relationship with this person?
        </CardDescription>
      </CardHeader>
      
      {enabled && (
        <CardContent className="space-y-4">
          {/* Informal Preset Buttons */}
          <div className="flex flex-wrap gap-2">
            {INFORMAL_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className={`px-4 py-2 text-sm rounded-full border transition-all ${
                  isPresetSelected(preset)
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {preset.label}
              </button>
            ))}
            
            {/* Family Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFamilyDropdown(!showFamilyDropdown)}
                className={`px-4 py-2 text-sm rounded-full border transition-all ${
                  FAMILY_PRESETS.some(p => isPresetSelected(p))
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                Family ▾
              </button>
              {showFamilyDropdown && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-popover border rounded-md shadow-lg z-10">
                  {FAMILY_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleFamilySelect(preset)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${
                        isPresetSelected(preset) ? 'bg-accent text-primary' : ''
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button
              type="button"
              onClick={handleCustomMode}
              className={`px-4 py-2 text-sm rounded-full border transition-all ${
                customMode
                  ? 'border-primary bg-primary/10 text-primary font-medium'
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
                  placeholder="e.g., Mentor to"
                  value={inviterLabel}
                  onChange={(e) => onInviterLabelChange(e.target.value)}
                  className="flex-1"
                />
              ) : (
                <span className="text-primary font-medium">
                  {inviterLabel || <em className="text-muted-foreground">Select above</em>}
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
                  placeholder="e.g., Mentee of"
                  value={inviteeLabel}
                  onChange={(e) => onInviteeLabelChange(e.target.value)}
                  className="flex-1"
                />
              ) : (
                <span className="text-primary font-medium">
                  {inviteeLabel || <em className="text-muted-foreground">Select above</em>}
                </span>
              )}
            </div>
          </div>

          {(inviterLabel || inviteeLabel) && (
            <p className="text-xs text-muted-foreground">
              This is how you'll describe each other. {inviteeName} will see this proposal and can accept or decline.
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
