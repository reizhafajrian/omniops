import React from 'react';
import { GitBranch, Key, Eye, EyeOff, Copy, Check, ClipboardPaste } from 'lucide-react';

export interface GitSourceFormProps {
  repoUrl: string;
  setRepoUrl: (val: string) => void;
  branch: string;
  setBranch: (val: string) => void;
  composePath: string;
  setComposePath: (val: string) => void;
  patToken: string;
  setPatToken: (val: string) => void;
  showPatToken: boolean;
  setShowPatToken: (val: boolean) => void;
  copiedPatToken: boolean;
  setCopiedPatToken: (val: boolean) => void;
}

export const GitSourceForm: React.FC<GitSourceFormProps> = ({
  repoUrl, setRepoUrl,
  branch, setBranch,
  composePath, setComposePath,
  patToken, setPatToken,
  showPatToken, setShowPatToken,
  copiedPatToken, setCopiedPatToken,
}) => {
  return (
    <div className="space-y-4 p-5 rounded-xl border border-brand-500/20 bg-brand-500/5">
      <h3 className="text-sm font-semibold text-brand-400 flex items-center gap-2 mb-4">
        <GitBranch size={16} /> Git Repository Details
      </h3>
      
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Repository URL</label>
        <input
          type="text"
          required
          placeholder="https://github.com/org/repo.git"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          className="w-full px-4 py-2.5 bg-dark-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tracked Branch</label>
          <input
            type="text"
            required
            placeholder="main"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="w-full px-4 py-2.5 bg-dark-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Compose File Path</label>
          <input
            type="text"
            required
            placeholder="docker-compose.yml"
            value={composePath}
            onChange={(e) => setComposePath(e.target.value)}
            className="w-full px-4 py-2.5 bg-dark-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Personal Access Token (for private repos)</label>
        <div className="relative">
          <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type={showPatToken ? "text" : "password"}
            placeholder="ghp_... (optional)"
            value={patToken}
            onChange={(e) => setPatToken(e.target.value)}
            className="w-full pl-9 pr-24 py-2.5 bg-dark-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors font-mono"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setShowPatToken(!showPatToken)}
              className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
              title={showPatToken ? "Hide token" : "Show token"}
            >
              {showPatToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(patToken);
                setCopiedPatToken(true);
                setTimeout(() => setCopiedPatToken(false), 2000);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
              title="Copy token"
            >
              {copiedPatToken ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  setPatToken(text);
                } catch (err) {
                  console.error('Failed to paste', err);
                }
              }}
              className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
              title="Paste token"
            >
              <ClipboardPaste size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
