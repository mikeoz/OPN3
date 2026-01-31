import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Loader2, AlertTriangle, ChevronDown, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RelationshipDangerZoneProps {
  otherMemberName: string;
  terminating: boolean;
  terminateReason: string;
  onTerminateReasonChange: (reason: string) => void;
  onTerminate: () => void;
}

export function RelationshipDangerZone({
  otherMemberName,
  terminating,
  terminateReason,
  onTerminateReasonChange,
  onTerminate,
}: RelationshipDangerZoneProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-destructive/20">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">Advanced / Danger Zone</CardTitle>
              </div>
              <ChevronDown className={cn(
                "h-5 w-5 text-muted-foreground transition-transform",
                isOpen && "rotate-180"
              )} />
            </div>
            <CardDescription>
              Relationship termination and other irreversible actions
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20 space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-destructive flex items-center gap-2">
                  <Unlink className="h-4 w-4" />
                  Terminate Relationship
                </h4>
                <p className="text-sm text-muted-foreground">
                  This is different from revoking CARD access. Terminating the relationship will:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                  <li>End the trust connection with {otherMemberName}</li>
                  <li>Revoke all shared CARDs in both directions</li>
                  <li>Prevent future sharing without a new invitation</li>
                  <li>Create an audit trail of the termination</li>
                </ul>
                <p className="text-sm text-destructive font-medium mt-2">
                  This action is permanent and cannot be undone.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="terminate-reason">Reason (optional)</Label>
                <Textarea
                  id="terminate-reason"
                  placeholder="Explain why you're terminating this relationship..."
                  value={terminateReason}
                  onChange={(e) => onTerminateReasonChange(e.target.value)}
                  maxLength={500}
                />
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Unlink className="h-4 w-4 mr-2" />
                    Terminate Relationship
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Terminate this relationship?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently end your relationship with{' '}
                      <strong>{otherMemberName}</strong> and revoke all shared CARDs. 
                      This action will be recorded in the audit log.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onTerminate}
                      disabled={terminating}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {terminating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Terminate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}