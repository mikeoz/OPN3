import { cn } from '@/lib/utils';
import { Card } from '@/lib/types';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Building2, 
  Linkedin, 
  Camera 
} from 'lucide-react';

interface CardBadgeProps {
  card: Card;
  className?: string;
}

const cardIcons: Record<string, typeof User> = {
  'identity.basic': User,
  'contact.email': Mail,
  'contact.phone': Phone,
  'location.city': MapPin,
  'professional.title': Briefcase,
  'professional.company': Building2,
  'social.linkedin': Linkedin,
  'verification.photo': Camera,
};

export function CardBadge({ card, className }: CardBadgeProps) {
  const Icon = cardIcons[card.card_key] || User;
  
  return (
    <div 
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm",
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{card.title}</span>
    </div>
  );
}
