import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sliders, Cpu, HardDrive, Check, Loader2 } from 'lucide-react';
import { useUpdateServiceLimits } from '@/hooks/useStacks';

interface StackLimitsModalProps {
  stackId: string;
  limitService: string | null;
  setLimitService: (svc: string | null) => void;
}

export const StackLimitsModal: React.FC<StackLimitsModalProps> = ({
  stackId,
  limitService,
  setLimitService
}) => {
  const [cpuLimit, setCpuLimit] = React.useState('');
  const [memLimit, setMemLimit] = React.useState('');
  const [limitSuccessMsg, setLimitSuccessMsg] = React.useState<string | null>(null);
  const [limitErrorMsg, setLimitErrorMsg] = React.useState<string | null>(null);
  
  const updateLimitsMutation = useUpdateServiceLimits();

  React.useEffect(() => {
    if (limitService) {
      setCpuLimit('');
      setMemLimit('');
      setLimitSuccessMsg(null);
      setLimitErrorMsg(null);
    }
  }, [limitService]);

  const handleSaveLimits = (e: React.FormEvent) => {
    e.preventDefault();
    if (!limitService) return;

    setLimitSuccessMsg(null);
    setLimitErrorMsg(null);

    updateLimitsMutation.mutate(
      {
        stackId,
        serviceName: limitService,
        limits: {
          cpus: cpuLimit.trim() || undefined,
          memory: memLimit.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setLimitSuccessMsg(`Updated limits for ${limitService} successfully!`);
          setTimeout(() => {
            setLimitService(null);
          }, 1500);
        },
        onError: (err) => {
          setLimitErrorMsg(err.message || 'Failed to update container limits');
        },
      }
    );
  };

  return (
    <Dialog open={!!limitService} onOpenChange={(open) => !open && setLimitService(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sliders size={18} className="text-indigo-400" /> Container Limits ({limitService})</DialogTitle>
          <DialogDescription>Update CPU and RAM limits dynamically via docker update.</DialogDescription>
        </DialogHeader>
        {limitSuccessMsg && <Alert className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><Check className="h-4 w-4" /><AlertDescription>{limitSuccessMsg}</AlertDescription></Alert>}
        {limitErrorMsg && <Alert variant="destructive"><AlertDescription>{limitErrorMsg}</AlertDescription></Alert>}
        <form onSubmit={handleSaveLimits} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Cpu size={14} className="text-primary" /> CPU Cores Limit</Label>
            <Input value={cpuLimit} onChange={(e) => setCpuLimit(e.target.value)} placeholder="e.g. 0.5, 1.0" className="font-mono" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><HardDrive size={14} className="text-emerald-500" /> Max RAM Limit</Label>
            <Input value={memLimit} onChange={(e) => setMemLimit(e.target.value)} placeholder="e.g. 256m, 1g" className="font-mono" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setLimitService(null)}>Cancel</Button>
            <Button type="submit" disabled={updateLimitsMutation.isPending} className="gap-2">
              {updateLimitsMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Apply Limits
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
