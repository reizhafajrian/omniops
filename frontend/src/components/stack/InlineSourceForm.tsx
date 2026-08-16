import React from 'react';
import { Terminal } from 'lucide-react';

export interface InlineSourceFormProps {
  inlineCompose: string;
  setInlineCompose: (val: string) => void;
}

export const InlineSourceForm: React.FC<InlineSourceFormProps> = ({
  inlineCompose, setInlineCompose,
}) => {
  return (
    <div className="space-y-4 p-5 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
      <h3 className="text-sm font-semibold text-indigo-400 flex items-center gap-2 mb-4">
        <Terminal size={16} /> docker-compose.yml
      </h3>
      
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Inline Compose YAML</label>
        <textarea
          required
          rows={12}
          value={inlineCompose}
          onChange={(e) => setInlineCompose(e.target.value)}
          className="w-full px-4 py-3 bg-dark-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono resize-y"
          placeholder="version: '3.8'..."
        />
      </div>
    </div>
  );
};
