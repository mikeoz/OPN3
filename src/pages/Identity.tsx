import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useMemberCards, MemberCardInstance } from '@/hooks/useMemberCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, History, Edit2, User, Mail, Phone } from 'lucide-react';
import { IdentityCardItem } from '@/components/trust/IdentityCardItem';
import { CardEditDialog } from '@/components/trust/CardEditDialog';
import { CardLineageDialog } from '@/components/trust/CardLineageDialog';
import { CardCreateDialog } from '@/components/trust/CardCreateDialog';

const CARD_ICONS: Record<string, typeof User> = {
  'identity.basic': User,
  'contact.email': Mail,
  'contact.phone': Phone,
};

const CARD_TITLES: Record<string, string> = {
  'identity.basic': 'Person',
  'contact.email': 'Email',
  'contact.phone': 'Phone',
};

export default function Identity() {
  const { currentCards, supersededCards, loading, refetch, supersedeCard, updateLabel, getCardLineage, createCard } = useMemberCards();
  const [editingCard, setEditingCard] = useState<MemberCardInstance | null>(null);
  const [lineageCard, setLineageCard] = useState<MemberCardInstance | null>(null);
  const [creatingCardType, setCreatingCardType] = useState<string | null>(null);

  // Group current cards by type
  const cardsByType = currentCards.reduce((acc, card) => {
    const key = card.catalog_card?.card_key || 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(card);
    return acc;
  }, {} as Record<string, MemberCardInstance[]>);

  const handleEdit = (card: MemberCardInstance) => {
    setEditingCard(card);
  };

  const handleViewLineage = (card: MemberCardInstance) => {
    setLineageCard(card);
  };

  const handleSaveEdit = async (cardId: string, newData: Record<string, unknown>, newLabel?: string) => {
    await supersedeCard(cardId, newData, newLabel);
    setEditingCard(null);
  };

  const handleSaveLabel = async (cardId: string, newLabel: string) => {
    await updateLabel(cardId, newLabel);
  };

  const handleCreateCard = async (cardKey: string, cardData: Record<string, unknown>, label: string) => {
    await createCard(cardKey, cardData, label);
    setCreatingCardType(null);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Identity CARDs</h1>
          <p className="text-muted-foreground mt-1">
            Manage your identity data as discrete, authoritative CARDs
          </p>
        </div>

        {/* Current CARDs */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Current CARDs</h2>
          </div>

          {/* Identity Cards */}
          {['identity.basic', 'contact.email', 'contact.phone'].map(cardType => {
            const cardsOfType = cardsByType[cardType] || [];
            const Icon = CARD_ICONS[cardType] || User;
            const title = CARD_TITLES[cardType] || cardType;

            return (
              <Card key={cardType}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">{title}</CardTitle>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setCreatingCardType(cardType)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add {title}
                    </Button>
                  </div>
                  <CardDescription>
                    {cardsOfType.length === 0 
                      ? `No ${title.toLowerCase()} CARDs yet`
                      : `${cardsOfType.length} ${title.toLowerCase()} CARD${cardsOfType.length > 1 ? 's' : ''}`
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {cardsOfType.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Click "Add {title}" to create your first {title.toLowerCase()} CARD
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {cardsOfType.map(card => (
                        <IdentityCardItem
                          key={card.id}
                          card={card}
                          onEdit={() => handleEdit(card)}
                          onViewLineage={() => handleViewLineage(card)}
                          onLabelChange={(newLabel) => handleSaveLabel(card.id, newLabel)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Superseded CARDs (historical) */}
        {supersededCards.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Historical CARDs</h2>
              <span className="text-sm text-muted-foreground">
                ({supersededCards.length} superseded)
              </span>
            </div>
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  These CARDs have been superseded by newer versions. They remain readable for provenance and audit purposes.
                </p>
                <div className="space-y-2">
                  {supersededCards.slice(0, 5).map(card => (
                    <div
                      key={card.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          {(() => {
                            const Icon = CARD_ICONS[card.catalog_card?.card_key || ''] || User;
                            return <Icon className="h-4 w-4 text-muted-foreground" />;
                          })()}
                        </div>
                        <div>
                          <p className="text-sm font-medium line-through text-muted-foreground">
                            {formatCardValue(card)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {card.label} • Superseded {new Date(card.superseded_at!).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewLineage(card)}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {supersededCards.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      +{supersededCards.length - 5} more historical CARDs
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      {editingCard && (
        <CardEditDialog
          card={editingCard}
          open={!!editingCard}
          onOpenChange={(open) => !open && setEditingCard(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Lineage Dialog */}
      {lineageCard && (
        <CardLineageDialog
          card={lineageCard}
          open={!!lineageCard}
          onOpenChange={(open) => !open && setLineageCard(null)}
          getLineage={getCardLineage}
        />
      )}

      {/* Create Dialog */}
      {creatingCardType && (
        <CardCreateDialog
          cardType={creatingCardType}
          open={!!creatingCardType}
          onOpenChange={(open) => !open && setCreatingCardType(null)}
          onCreate={handleCreateCard}
        />
      )}
    </AppLayout>
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
