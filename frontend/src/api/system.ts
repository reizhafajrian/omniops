import { fetchApi } from './client';
import { AppSettings, DockerStatusResponse, SystemMetricsResponse, ActionResponse } from '../types';

export const systemApi = {
  getSettings: (): Promise<AppSettings> => fetchApi<AppSettings>('/api/settings'),
  updateSettings: (settings: AppSettings): Promise<AppSettings> => fetchApi<AppSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  getSystemMetrics: (): Promise<SystemMetricsResponse> => fetchApi<SystemMetricsResponse>('/api/system/metrics'),
  getDockerStatus: (): Promise<DockerStatusResponse> => fetchApi<DockerStatusResponse>('/api/system/docker/status'),
  startDockerDaemon: (): Promise<{ message: string }> => fetchApi<{ message: string }>('/api/system/docker/start', { method: 'POST' }),
  pruneSystem: (): Promise<ActionResponse> => fetchApi<ActionResponse>('/api/system/prune', { method: 'POST' }),
};
