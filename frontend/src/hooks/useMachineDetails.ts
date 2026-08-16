import { useQuery } from '@tanstack/react-query';
import { machinesApi } from '../api';
import { MachineDetailsResponse } from '../types';

export function useMachineDetails(machineName: string | null) {
  return useQuery<MachineDetailsResponse, Error>({
    queryKey: ['podman', 'machine-details', machineName],
    queryFn: () => {
      if (!machineName) throw new Error("Machine name is required");
      return machinesApi.inspectMachine(machineName);
    },
    enabled: !!machineName,
    refetchInterval: 5000,
  });
}
