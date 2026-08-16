import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Server, Play, Square, Trash2, Plus, 
  Loader2, AlertCircle, HardDrive, Cpu, MemoryStick
} from 'lucide-react';
import { systemApi,  machinesApi} from '../api';
import { PodmanMachine, CreateMachineInput } from '../types';;

export const PodmanManagerTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newMachine, setNewMachine] = useState<CreateMachineInput>({
    name: '',
    cpus: 2,
    memory: 2048,
    disk_size: 20
  });

  const { data: machines = [], isLoading, isError } = useQuery<PodmanMachine[]>({
    queryKey: ['podman', 'machines'],
    queryFn: () => machinesApi.getMachines(),
    refetchInterval: 3000,
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => systemApi.getSettings(),
  });
  
  const isPodmanActive = settings?.container_engine === 'podman';

  const createMutation = useMutation({
    mutationFn: (input: CreateMachineInput) => machinesApi.createMachine(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['podman', 'machines'] });
      setIsCreating(false);
      setNewMachine({ name: '', cpus: 2, memory: 2048, disk_size: 20 });
      setErrorMsg(null);
    },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to create machine')
  });

  const startMutation = useMutation({
    mutationFn: (name: string) => machinesApi.startMachine(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['podman', 'machines'] });
      queryClient.invalidateQueries({ queryKey: ['docker', 'status'] }); // Refresh global daemon status
      setErrorMsg(null);
    },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to start machine')
  });

  const stopMutation = useMutation({
    mutationFn: (name: string) => machinesApi.stopMachine(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['podman', 'machines'] });
      queryClient.invalidateQueries({ queryKey: ['docker', 'status'] });
      setErrorMsg(null);
    },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to stop machine')
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => machinesApi.deleteMachine(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['podman', 'machines'] });
      setErrorMsg(null);
    },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to delete machine')
  });

  return (
    <div className="flex flex-col h-full">
      {!isPodmanActive && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={18} />
          <div>
            <h4 className="text-sm font-medium text-amber-300">Podman Engine is not active</h4>
            <p className="text-xs text-amber-400/80 mt-1">Your current container engine is set to Docker. You can view existing Podman machines, but they will not be used by the control plane unless you switch the active engine in Settings.</p>
          </div>
        </div>
      )}

      <div className="bg-dark-950 border border-slate-800 rounded-2xl w-full shadow-lg flex flex-col flex-1">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Server className="text-brand-400" size={20} />
              Podman Machines
            </h2>
            <p className="text-sm text-slate-400 mt-1">Manage local VMs for Podman Engine</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="mb-6 bg-rose-500/10 border border-rose-500/20 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-rose-300 whitespace-pre-wrap">{errorMsg}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-brand-500" size={32} />
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-slate-400">
              <p>Failed to load machines. Make sure podman is installed.</p>
            </div>
          ) : (
            <div className="space-y-4">
              
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Installed Machines</h3>
                {!isCreating && (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600/20 hover:bg-brand-600/40 text-brand-300 text-xs font-semibold rounded-lg transition-colors border border-brand-500/30"
                  >
                    <Plus size={14} /> New Machine
                  </button>
                )}
              </div>

              {isCreating && (
                <div className="bg-dark-900 border border-brand-500/30 rounded-xl p-4 mb-4">
                  <h4 className="text-sm font-medium text-white mb-3">Create New Machine</h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Name (required)</label>
                      <input 
                        type="text" 
                        value={newMachine.name}
                        onChange={e => setNewMachine({...newMachine, name: e.target.value})}
                        className="w-full bg-dark-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
                        placeholder="e.g. podman-machine-default"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">CPUs</label>
                      <input 
                        type="number" 
                        value={newMachine.cpus}
                        onChange={e => setNewMachine({...newMachine, cpus: parseInt(e.target.value)})}
                        className="w-full bg-dark-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Memory (MB)</label>
                      <input 
                        type="number" 
                        value={newMachine.memory}
                        onChange={e => setNewMachine({...newMachine, memory: parseInt(e.target.value)})}
                        className="w-full bg-dark-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Disk Size (GB)</label>
                      <input 
                        type="number" 
                        value={newMachine.disk_size}
                        onChange={e => setNewMachine({...newMachine, disk_size: parseInt(e.target.value)})}
                        className="w-full bg-dark-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setIsCreating(false)}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => createMutation.mutate(newMachine)}
                      disabled={!newMachine.name || createMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      {createMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                      Create
                    </button>
                  </div>
                </div>
              )}

              {machines.length === 0 && !isCreating && (
                <div className="text-center py-8 text-slate-500 text-sm bg-dark-900/50 rounded-xl border border-dashed border-slate-800">
                  No machines found.
                </div>
              )}

              {machines.map(machine => (
                <div 
                  key={machine.Name} 
                  onClick={() => { window.location.hash = `#/machines/${encodeURIComponent(machine.Name)}`; }}
                  className="bg-dark-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:border-brand-500/30 hover:bg-dark-800 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-white">{machine.Name}</h4>
                      {machine.Default && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-500/20 text-brand-300">
                          Default
                        </span>
                      )}
                      {machine.Running ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">
                          Running
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-500/20 text-slate-400">
                          Stopped
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1" title="CPUs"><Cpu size={12}/> {machine.CPUs}</span>
                      <span className="flex items-center gap-1" title="Memory"><MemoryStick size={12}/> {machine.Memory ? (parseInt(machine.Memory)/1024/1024).toFixed(0) : 0} MB</span>
                      <span className="flex items-center gap-1" title="Disk"><HardDrive size={12}/> {machine.DiskSize ? (parseInt(machine.DiskSize)/1024/1024/1024).toFixed(0) : 0} GB</span>
                      <span className="text-[10px]">VM: {machine.VMType}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {machine.Running ? (
                      <button 
                        onClick={(e) => { e.stopPropagation(); stopMutation.mutate(machine.Name); }}
                        disabled={stopMutation.isPending || startMutation.isPending}
                        className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg transition-colors disabled:opacity-50"
                        title="Stop Machine"
                      >
                        {stopMutation.isPending && stopMutation.variables === machine.Name ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Square size={16} className="fill-amber-400/20" />
                        )}
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); startMutation.mutate(machine.Name); }}
                        disabled={startMutation.isPending || stopMutation.isPending}
                        className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors disabled:opacity-50"
                        title="Start Machine"
                      >
                        {startMutation.isPending && startMutation.variables === machine.Name ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Play size={16} className="fill-emerald-400/20" />
                        )}
                      </button>
                    )}
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete machine '${machine.Name}'? This will destroy all containers and images inside it.`)) {
                          deleteMutation.mutate(machine.Name);
                        }
                      }}
                      disabled={deleteMutation.isPending || machine.Running}
                      className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition-colors disabled:opacity-50"
                      title={machine.Running ? "Stop machine first to delete" : "Delete Machine"}
                    >
                      {deleteMutation.isPending && deleteMutation.variables === machine.Name ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
