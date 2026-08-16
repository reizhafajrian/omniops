import { fetchApi } from './client';
import { StacksResponse, HistoryResponse, ServicesResponse, ActionResponse, CreateStackInput, UpdateStackInput } from '../types';

export const stacksApi = {
  getStacks: (): Promise<StacksResponse> => fetchApi<StacksResponse>('/api/stacks'),
  getHistory: (stackId: string): Promise<HistoryResponse> => fetchApi<HistoryResponse>(`/api/stacks/${encodeURIComponent(stackId)}/history`),
  getServices: (stackId: string): Promise<ServicesResponse> => fetchApi<ServicesResponse>(`/api/stacks/${encodeURIComponent(stackId)}/services`),
  getCompose: (stackId: string): Promise<{ compose_content: string }> => fetchApi<{ compose_content: string }>(`/api/stacks/${encodeURIComponent(stackId)}/compose`),
  updateServiceLimits: (stackId: string, serviceName: string, limits: { cpus?: string; memory?: string }): Promise<ActionResponse> =>
    fetchApi<ActionResponse>(`/api/stacks/${encodeURIComponent(stackId)}/services/${encodeURIComponent(serviceName)}/limits`, { method: 'POST', body: JSON.stringify(limits) }),
  cleanStack: (stackId: string): Promise<ActionResponse> => fetchApi<ActionResponse>(`/api/stacks/${encodeURIComponent(stackId)}/clean`, { method: 'POST' }),
  triggerSync: (stackId: string): Promise<ActionResponse> => fetchApi<ActionResponse>(`/api/stacks/${encodeURIComponent(stackId)}/sync`, { method: 'POST' }),
  stopStack: (stackId: string): Promise<ActionResponse> => fetchApi<ActionResponse>(`/api/stacks/${encodeURIComponent(stackId)}/stop`, { method: 'POST' }),
  triggerRollback: (stackId: string): Promise<ActionResponse> => fetchApi<ActionResponse>(`/api/stacks/${encodeURIComponent(stackId)}/rollback`, { method: 'POST' }),
  createStack: (input: CreateStackInput): Promise<ActionResponse> => fetchApi<ActionResponse>('/api/stacks', { method: 'POST', body: JSON.stringify(input) }),
  updateStack: (stackId: string, input: UpdateStackInput): Promise<ActionResponse> => fetchApi<ActionResponse>(`/api/stacks/${encodeURIComponent(stackId)}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteStack: (stackId: string): Promise<ActionResponse> => fetchApi<ActionResponse>(`/api/stacks/${encodeURIComponent(stackId)}`, { method: 'DELETE' }),
  verifyStackPin: (stackId: string, pin: string): Promise<{ valid: boolean; error?: string }> => fetchApi<{ valid: boolean; error?: string }>(`/api/stacks/${encodeURIComponent(stackId)}/verify-pin`, { method: 'POST', body: JSON.stringify({ pin }) }),
};
