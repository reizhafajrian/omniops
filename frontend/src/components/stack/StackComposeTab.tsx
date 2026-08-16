import React from 'react';
import { FileCode, Loader2, RefreshCw, AlertOctagon } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/button';

interface StackComposeTabProps {
  composeQuery: any;
}

export const StackComposeTab: React.FC<StackComposeTabProps> = ({ composeQuery }) => {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileCode size={18} className="text-primary" />
            Compose Source
          </h3>
          <p className="text-sm text-muted-foreground">The actual docker-compose.yml file currently deployed.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => composeQuery.refetch()} disabled={composeQuery.isFetching} className="gap-2">
          <RefreshCw size={14} className={clsx(composeQuery.isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {composeQuery.isLoading ? (
        <div className="py-12 flex justify-center text-muted-foreground"><Loader2 className="animate-spin" /></div>
      ) : composeQuery.isError ? (
        <div className="py-12 text-center text-muted-foreground border rounded-xl border-dashed">
          <AlertOctagon size={32} className="mx-auto mb-3 opacity-50" />
          <p className="mb-4">Compose file not found. Ensure the stack has been synced.</p>
        </div>
      ) : (
        <div className="flex-1 bg-black/90 rounded-lg p-4 border overflow-auto text-left">
          <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">{composeQuery.data?.compose_content || 'No compose content found.'}</pre>
        </div>
      )}
    </>
  );
};
