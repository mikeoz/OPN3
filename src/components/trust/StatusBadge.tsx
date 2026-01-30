import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'active' | 'pending' | 'terminated' | 'accepted' | 'rejected' | 'offered' | 'revoked' | 'cancelled' | 'expired';
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-success/10 text-success border-success/20' },
  pending: { label: 'Pending', className: 'bg-warning/10 text-warning border-warning/20' },
  terminated: { label: 'Terminated', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  accepted: { label: 'Accepted', className: 'bg-success/10 text-success border-success/20' },
  rejected: { label: 'Rejected', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  offered: { label: 'Offered', className: 'bg-primary/10 text-primary border-primary/20' },
  revoked: { label: 'Revoked', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground border-muted' },
  expired: { label: 'Expired', className: 'bg-muted text-muted-foreground border-muted' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span 
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
