-- OPN3.010-5: Allow recipients to view shared CARD instances
-- Add RLS policy for recipients to see member_cards shared with them via accepted proposals

CREATE POLICY "Recipients can view shared member cards"
ON public.tno_member_cards
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM tno_share_proposal_items spi
    JOIN tno_share_proposals sp ON sp.proposal_id = spi.proposal_id
    WHERE spi.member_card_id = tno_member_cards.id
      AND sp.to_member_id = auth.uid()
      AND sp.status = 'accepted'
      AND spi.revoked_at IS NULL
  )
);