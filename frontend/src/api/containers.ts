import { fetchApi } from './client';

export const containersApi = {
  inspectContainer: (containerId: string): Promise<any> => fetchApi<any>(`/api/system/containers/${encodeURIComponent(containerId)}/inspect`),
  getContainerStats: (containerId: string): Promise<{ cpu_percent: string, mem_usage: string, net_io: string, block_io: string }> =>
    fetchApi<{ cpu_percent: string, mem_usage: string, net_io: string, block_io: string }>(`/api/system/containers/${encodeURIComponent(containerId)}/stats`),
  startContainer: (containerId: string): Promise<{ message: string }> => fetchApi<{ message: string }>(`/api/system/containers/${encodeURIComponent(containerId)}/start`, { method: 'POST' }),
  stopContainer: (containerId: string): Promise<{ message: string }> => fetchApi<{ message: string }>(`/api/system/containers/${encodeURIComponent(containerId)}/stop`, { method: 'POST' }),
  restartContainer: (containerId: string): Promise<{ message: string }> => fetchApi<{ message: string }>(`/api/system/containers/${encodeURIComponent(containerId)}/restart`, { method: 'POST' }),
  deleteContainer: (containerId: string): Promise<{ message: string }> => fetchApi<{ message: string }>(`/api/system/containers/${encodeURIComponent(containerId)}`, { method: 'DELETE' }),
  getContainerLogs: (containerId: string): Promise<{ logs: string }> => fetchApi<{ logs: string }>(`/api/system/containers/${encodeURIComponent(containerId)}/logs`),
};
