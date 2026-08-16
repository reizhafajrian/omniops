import { fetchApi } from './client';
import { PodmanMachine, CreateMachineInput, MachineDetailsResponse, ActionResponse } from '../types';

export const machinesApi = {
  getMachines: (): Promise<PodmanMachine[]> => fetchApi<PodmanMachine[]>('/api/system/machines'),
  createMachine: (input: CreateMachineInput): Promise<ActionResponse> => fetchApi<ActionResponse>('/api/system/machines', { method: 'POST', body: JSON.stringify(input) }),
  startMachine: (name: string): Promise<ActionResponse> => fetchApi<ActionResponse>(`/api/system/machines/${encodeURIComponent(name)}/start`, { method: 'POST' }),
  stopMachine: (name: string): Promise<ActionResponse> => fetchApi<ActionResponse>(`/api/system/machines/${encodeURIComponent(name)}/stop`, { method: 'POST' }),
  deleteMachine: (name: string): Promise<ActionResponse> => fetchApi<ActionResponse>(`/api/system/machines/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  inspectMachine: (name: string): Promise<MachineDetailsResponse> => fetchApi<MachineDetailsResponse>(`/api/system/machines/${encodeURIComponent(name)}/inspect`),
};
