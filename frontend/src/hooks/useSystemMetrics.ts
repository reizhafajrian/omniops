import { useQuery } from '@tanstack/react-query';
import { systemApi } from '../api';
import { SystemMetricsResponse } from '../types';

export const SYSTEM_METRICS_QUERY_KEY = ['system', 'metrics'];

/**
 * Hook to poll `/api/system/metrics` using TanStack Query.
 */
export function useSystemMetrics(pollInterval = 5000) {
  return useQuery<SystemMetricsResponse, Error>({
    queryKey: SYSTEM_METRICS_QUERY_KEY,
    queryFn: () => systemApi.getSystemMetrics(),
    refetchInterval: pollInterval,
    refetchOnWindowFocus: true,
  });
}
