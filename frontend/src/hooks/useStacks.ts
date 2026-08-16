import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stacksApi, systemApi } from '../api';
import { Stack, SyncEvent, CreateStackInput, UpdateStackInput } from '../types';

export const STACKS_QUERY_KEY = ['stacks'];
export const HISTORY_QUERY_KEY = (stackId: string) => ['stacks', stackId, 'history'];
export const SETTINGS_QUERY_KEY = ['settings'];

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: async () => systemApi.getSettings(),
    staleTime: Infinity,
  });
}

/**
 * Hook to poll `/api/stacks` using TanStack Query.
 * Automatically keeps UI state synchronized with the reconciliation engine.
 */
export function useStacks(pollInterval = 3000) {
  return useQuery<Stack[], Error>({
    queryKey: STACKS_QUERY_KEY,
    queryFn: async () => {
      const data = await stacksApi.getStacks();
      return data.stacks;
    },
    refetchInterval: pollInterval,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch sync event history for a stack.
 */
export function useStackHistory(stackId: string | null) {
  return useQuery<SyncEvent[], Error>({
    queryKey: HISTORY_QUERY_KEY(stackId || ''),
    queryFn: async () => {
      if (!stackId) return [];
      const data = await stacksApi.getHistory(stackId);
      return data.events;
    },
    enabled: !!stackId,
    refetchInterval: 5000,
  });
}

/**
 * Mutation hook for manually triggering a sync.
 */
export function useSyncStack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (stackId: string) => stacksApi.triggerSync(stackId),
    onSuccess: (_, stackId) => {
      // Invalidate queries so the UI immediately updates
      queryClient.invalidateQueries({ queryKey: STACKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY(stackId) });
    },
  });
}

/**
 * Mutation hook for triggering a rollback.
 */
export function useRollbackStack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (stackId: string) => stacksApi.triggerRollback(stackId),
    onSuccess: (_, stackId) => {
      queryClient.invalidateQueries({ queryKey: STACKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY(stackId) });
    },
  });
}

/**
 * Mutation hook for registering a new stack dynamically.
 */
export function useCreateStack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStackInput) => stacksApi.createStack(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STACKS_QUERY_KEY });
    },
  });
}

/**
 * Mutation hook for deleting a stack.
 */
export function useDeleteStack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (stackId: string) => stacksApi.deleteStack(stackId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STACKS_QUERY_KEY });
    },
  });
}

export const SERVICES_QUERY_KEY = (stackId: string) => ['stacks', stackId, 'services'];

/**
 * Hook to fetch individual container services belonging to a stack.
 */
export function useStackServices(stackId: string | null) {
  return useQuery({
    queryKey: SERVICES_QUERY_KEY(stackId || ''),
    queryFn: () => stacksApi.getServices(stackId!),
    enabled: !!stackId,
    refetchInterval: 4000,
  });
}

export function useStackCompose(stackId: string | null) {
  return useQuery({
    queryKey: ['compose', stackId],
    queryFn: () => stacksApi.getCompose(stackId!),
    enabled: !!stackId,
  });
}

/**
 * Mutation hook for updating stack configuration.
 */
export function useUpdateStack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stackId, input }: { stackId: string; input: UpdateStackInput }) =>
      stacksApi.updateStack(stackId, input),
    onSuccess: (_, { stackId }) => {
      queryClient.invalidateQueries({ queryKey: STACKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY(stackId) });
    },
  });
}

/**
 * Mutation hook to clean stack containers AND persistent volumes (down -v).
 */
export function useCleanStack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (stackId: string) => stacksApi.cleanStack(stackId),
    onSuccess: (_, stackId) => {
      queryClient.invalidateQueries({ queryKey: STACKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY(stackId) });
    },
  });
}

/**
 * Mutation hook to stop stack containers and networks.
 */
export function useStopStack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (stackId: string) => stacksApi.stopStack(stackId),
    onSuccess: (_, stackId) => {
      queryClient.invalidateQueries({ queryKey: STACKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY(stackId) });
    },
  });
}

/**
 * Mutation hook for system-wide volume and network prune.
 */
export function usePruneSystem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => systemApi.pruneSystem(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STACKS_QUERY_KEY });
    },
  });
}

/**
 * Mutation hook for updating CPU & RAM container limits at runtime.
 */
export function useUpdateServiceLimits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      stackId,
      serviceName,
      limits,
    }: {
      stackId: string;
      serviceName: string;
      limits: { cpus?: string; memory?: string };
    }) => stacksApi.updateServiceLimits(stackId, serviceName, limits),
    onSuccess: (_, { stackId }) => {
      queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY(stackId) });
    },
  });
}
