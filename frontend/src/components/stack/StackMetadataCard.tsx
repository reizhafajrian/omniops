import React from 'react';
import { ExternalLink, GitBranch, FileCode } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StackMetadataCardProps {
  stack: any;
}

export const StackMetadataCard: React.FC<StackMetadataCardProps> = ({ stack }) => {
  const { config, last_synced_commit } = stack;

  return (
    <Card>
      <CardContent className="p-0 grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
        <div className="p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium">Git Repository URL</span>
          <a
            href={config.repo_url}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline text-sm font-medium flex items-center gap-1.5 truncate"
            title={config.repo_url}
          >
            <span className="truncate">{config.repo_url}</span>
            <ExternalLink size={12} className="shrink-0" aria-hidden="true" />
          </a>
        </div>
        <div className="p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium">Tracked Branch</span>
          <span className="text-foreground text-sm font-semibold flex items-center gap-1.5">
            <GitBranch size={14} className="text-primary" aria-hidden="true" />
            {config.branch}
          </span>
        </div>
        <div className="p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium">Compose File Path</span>
          <span className="text-foreground text-sm font-semibold flex items-center gap-1.5">
            <FileCode size={14} className="text-indigo-400" aria-hidden="true" />
            {config.compose_path}
          </span>
        </div>
        <div className="p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium">Last Synced Commit</span>
          <span className="text-foreground text-sm font-mono font-semibold">
            {last_synced_commit ? last_synced_commit.slice(0, 7) : 'None'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
