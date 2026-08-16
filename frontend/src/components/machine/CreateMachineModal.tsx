import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Server, Loader2, X, AlertCircle } from 'lucide-react';
import { machinesApi } from '../../api';
import { PodmanMachine, CreateMachineInput } from '../../types';

interface CreateMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (machineName: string) => void;
  machines: PodmanMachine[];
}

type Step = 'idle' | 'creating' | 'stopping' | 'starting';

export const CreateMachineModal: React.FC<CreateMachineModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  machines,
}) => {
  const queryClient = useQueryClient();
  const [newMachine, setNewMachine] = useState<CreateMachineInput>({
    name: '',
    cpus: 2,
    memory: 2048,
    disk_size: 20,
  });

  const [step, setStep] = useState<Step>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMachine.name.trim()) return;

    setErrorMsg(null);
    const machineName = newMachine.name.trim();

    try {
      // 1. Create Machine
      setStep('creating');
      await machinesApi.createMachine(newMachine);

      // 2. Stop running machines
      const runningMachines = machines.filter((m) => m.Running);
      if (runningMachines.length > 0) {
        setStep('stopping');
        for (const m of runningMachines) {
          await machinesApi.stopMachine(m.Name);
        }
      }

      // 3. Start new machine
      setStep('starting');
      await machinesApi.startMachine(machineName);

      // Success
      queryClient.invalidateQueries({ queryKey: ['podman', 'machines'] });
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      onSuccess(machineName);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during machine setup.');
      setStep('idle');
    }
  };

  const isWorking = step !== 'idle';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-dark-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-dark-950/50">
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Server size={18} className="text-brand-400" />
            Create Podman Machine
          </h3>
          <button
            onClick={onClose}
            disabled={isWorking}
            className="text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300 flex items-start gap-3">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-400" />
              <p className="whitespace-pre-wrap">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Machine Name</label>
              <input
                type="text"
                required
                disabled={isWorking}
                value={newMachine.name}
                onChange={(e) => setNewMachine({ ...newMachine, name: e.target.value })}
                className="w-full px-3 py-2 bg-dark-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-brand-500 disabled:opacity-50"
                placeholder="e.g. podman-machine-default"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">CPUs</label>
                <input
                  type="number"
                  required
                  min={1}
                  disabled={isWorking}
                  value={newMachine.cpus}
                  onChange={(e) => setNewMachine({ ...newMachine, cpus: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-dark-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-brand-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Memory (MB)</label>
                <input
                  type="number"
                  required
                  min={512}
                  disabled={isWorking}
                  value={newMachine.memory}
                  onChange={(e) => setNewMachine({ ...newMachine, memory: parseInt(e.target.value) || 512 })}
                  className="w-full px-3 py-2 bg-dark-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-brand-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Disk (GB)</label>
                <input
                  type="number"
                  required
                  min={1}
                  disabled={isWorking}
                  value={newMachine.disk_size}
                  onChange={(e) => setNewMachine({ ...newMachine, disk_size: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-dark-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-brand-500 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-slate-800 mt-6">
              <button
                type="button"
                onClick={onClose}
                disabled={isWorking}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isWorking || !newMachine.name.trim()}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isWorking ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {step === 'creating' && 'Creating...'}
                    {step === 'stopping' && 'Stopping Old...'}
                    {step === 'starting' && 'Starting New...'}
                  </>
                ) : (
                  'Create & Start'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
