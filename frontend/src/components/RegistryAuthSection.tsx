import React, { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';

export interface RegistryAuthValue {
  registry_host: string;
  registry_user: string;
  registry_pass: string;
}

interface RegistryAuthSectionProps {
  value: RegistryAuthValue;
  onChange: (val: RegistryAuthValue) => void;
}

type ProviderKey = 'none' | 'gcr' | 'gar' | 'ghcr' | 'ecr' | 'dockerhub' | 'custom';

interface Provider {
  key: ProviderKey;
  label: string;
  logo: string; // emoji/text logo
  logoColor: string;
  defaultHost: string;
  userLabel: string;
  userPlaceholder: string;
  passLabel: string;
  passPlaceholder: string;
  passType: 'password' | 'textarea';
  helpText: React.ReactNode;
}

const PROVIDERS: Provider[] = [
  {
    key: 'none',
    label: 'No Private Registry',
    logo: '🔓',
    logoColor: 'text-slate-400',
    defaultHost: '',
    userLabel: '',
    userPlaceholder: '',
    passLabel: '',
    passPlaceholder: '',
    passType: 'password',
    helpText: null,
  },
  {
    key: 'gcr',
    label: 'Google Container Registry (GCR)',
    logo: 'G',
    logoColor: 'text-blue-400',
    defaultHost: 'gcr.io',
    userLabel: 'Auth Method',
    userPlaceholder: '_json_key',
    passLabel: 'Service Account JSON Key',
    passPlaceholder: '{"type": "service_account", "project_id": "...", ...}',
    passType: 'textarea',
    helpText: (
      <span>
        Use <code className="bg-dark-900 px-1 rounded text-blue-300">_json_key</code> as username and paste the full{' '}
        <strong>Service Account JSON</strong> as password. 
        Registry host: <code className="bg-dark-900 px-1 rounded text-blue-300">gcr.io</code>
      </span>
    ),
  },
  {
    key: 'gar',
    label: 'Google Artifact Registry (GAR)',
    logo: 'G',
    logoColor: 'text-blue-400',
    defaultHost: 'asia-docker.pkg.dev',
    userLabel: 'Auth Method',
    userPlaceholder: '_json_key',
    passLabel: 'Service Account JSON Key',
    passPlaceholder: '{"type": "service_account", "project_id": "...", ...}',
    passType: 'textarea',
    helpText: (
      <span>
        Use <code className="bg-dark-900 px-1 rounded text-blue-300">_json_key</code> as username.
        Host format: <code className="bg-dark-900 px-1 rounded text-blue-300">REGION-docker.pkg.dev</code> (e.g.{' '}
        <code className="text-blue-300">asia-docker.pkg.dev</code>).
      </span>
    ),
  },
  {
    key: 'ghcr',
    label: 'GitHub Container Registry (GHCR)',
    logo: '⬡',
    logoColor: 'text-slate-300',
    defaultHost: 'ghcr.io',
    userLabel: 'GitHub Username or Org',
    userPlaceholder: 'your-github-username',
    passLabel: 'GitHub Personal Access Token (PAT)',
    passPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    passType: 'password',
    helpText: (
      <span>
        Create a PAT at <strong>GitHub → Settings → Developer settings → Personal Access Tokens</strong>.
        Required scopes: <code className="bg-dark-900 px-1 rounded text-slate-300">read:packages</code>
      </span>
    ),
  },
  {
    key: 'ecr',
    label: 'Amazon ECR (AWS)',
    logo: '▲',
    logoColor: 'text-orange-400',
    defaultHost: '123456789.dkr.ecr.us-east-1.amazonaws.com',
    userLabel: 'AWS Access Key ID',
    userPlaceholder: 'AKIAIOSFODNN7EXAMPLE',
    passLabel: 'AWS Secret Access Key',
    passPlaceholder: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    passType: 'password',
    helpText: (
      <span>
        ECR registry URL format:{' '}
        <code className="bg-dark-900 px-1 rounded text-orange-300">
          ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com
        </code>
        . The engine will call <code className="text-orange-300">aws ecr get-login-password</code> using your credentials.
      </span>
    ),
  },
  {
    key: 'dockerhub',
    label: 'Docker Hub',
    logo: '🐳',
    logoColor: 'text-sky-400',
    defaultHost: 'docker.io',
    userLabel: 'Docker Hub Username',
    userPlaceholder: 'your-dockerhub-username',
    passLabel: 'Docker Hub Access Token or Password',
    passPlaceholder: 'dckr_pat_xxxxxxxxxxxx',
    passType: 'password',
    helpText: (
      <span>
        Create a token at <strong>Docker Hub → Account Settings → Security → Access Tokens</strong>.{' '}
        Use <code className="bg-dark-900 px-1 rounded text-sky-300">docker.io</code> as the registry host.
      </span>
    ),
  },
  {
    key: 'custom',
    label: 'Custom / Self-Hosted Registry',
    logo: '⚙',
    logoColor: 'text-purple-400',
    defaultHost: '',
    userLabel: 'Registry Username',
    userPlaceholder: 'username',
    passLabel: 'Registry Password or Token',
    passPlaceholder: 'password or token',
    passType: 'password',
    helpText: (
      <span>
        Works with any OCI-compatible registry (Harbor, Gitea, Nexus, etc.).
        Set the full hostname of your private registry.
      </span>
    ),
  },
];

export const RegistryAuthSection: React.FC<RegistryAuthSectionProps> = ({ value, onChange }) => {
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey>(() => {
    if (!value.registry_host) return 'none';
    if (value.registry_host.includes('gcr.io')) return 'gcr';
    if (value.registry_host.includes('pkg.dev')) return 'gar';
    if (value.registry_host === 'ghcr.io') return 'ghcr';
    if (value.registry_host.includes('amazonaws.com')) return 'ecr';
    if (value.registry_host === 'docker.io') return 'dockerhub';
    if (value.registry_host) return 'custom';
    return 'none';
  });
  const [isOpen, setIsOpen] = useState(false);

  const provider = PROVIDERS.find((p) => p.key === selectedProvider)!;

  const handleProviderSelect = (p: Provider) => {
    setSelectedProvider(p.key);
    setIsOpen(false);
    if (p.key === 'none') {
      onChange({ registry_host: '', registry_user: '', registry_pass: '' });
    } else {
      onChange({
        registry_host: p.defaultHost,
        registry_user: p.key === 'gcr' || p.key === 'gar' ? '_json_key' : value.registry_user,
        registry_pass: value.registry_pass,
      });
    }
  };

  const nonNoneProviders = PROVIDERS.filter((p) => p.key !== 'none');

  return (
    <div className="space-y-3">
      {/* Provider Selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            'w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-medium rounded-xl border transition-all',
            selectedProvider !== 'none'
              ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-200'
              : 'bg-dark-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
          )}
        >
          <div className="flex items-center gap-2.5">
            <span className={clsx('font-bold text-sm', provider.logoColor)}>{provider.logo}</span>
            <span className="font-semibold">{provider.label}</span>
          </div>
          <ChevronDown size={14} className={clsx('transition-transform', isOpen && 'rotate-180')} />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-dark-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            {/* No registry option */}
            <button
              type="button"
              onClick={() => handleProviderSelect(PROVIDERS[0])}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 transition-colors border-b border-slate-800"
            >
              <span className="text-slate-500">🔓</span>
              <span className="font-medium">No Private Registry (Public Images Only)</span>
            </button>

            {/* Provider options */}
            <div className="max-h-52 overflow-y-auto">
              {nonNoneProviders.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handleProviderSelect(p)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3.5 py-2.5 text-xs hover:bg-slate-800/60 transition-colors',
                    selectedProvider === p.key ? 'bg-indigo-500/10 text-indigo-200' : 'text-slate-300'
                  )}
                >
                  <span className={clsx('font-bold text-sm w-5 text-center', p.logoColor)}>{p.logo}</span>
                  <span className="font-medium">{p.label}</span>
                  {selectedProvider === p.key && (
                    <span className="ml-auto text-indigo-400 text-[10px] font-mono">active</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Per-Provider Auth Fields */}
      {selectedProvider !== 'none' && (
        <div className="space-y-3 p-3.5 rounded-xl bg-dark-950 border border-slate-800 animate-in fade-in slide-in-from-top-1">
          {/* Registry Host */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Registry Host / URL</label>
            <input
              type="text"
              value={value.registry_host}
              onChange={(e) => onChange({ ...value, registry_host: e.target.value })}
              placeholder={provider.defaultHost || 'registry.example.com'}
              className="w-full px-3 py-2 text-xs font-mono bg-dark-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Username */}
          {provider.userLabel && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">{provider.userLabel}</label>
              <input
                type="text"
                value={value.registry_user}
                onChange={(e) => onChange({ ...value, registry_user: e.target.value })}
                placeholder={provider.userPlaceholder}
                readOnly={provider.key === 'gcr' || provider.key === 'gar'}
                className={clsx(
                  'w-full px-3 py-2 text-xs font-mono bg-dark-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500',
                  (provider.key === 'gcr' || provider.key === 'gar') && 'opacity-60 cursor-not-allowed'
                )}
              />
              {(provider.key === 'gcr' || provider.key === 'gar') && (
                <p className="text-[10px] text-slate-500 mt-1">Auto-set to <code>_json_key</code> for GCP registries.</p>
              )}
            </div>
          )}

          {/* Password / Secret */}
          {provider.passLabel && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">{provider.passLabel}</label>
              {provider.passType === 'textarea' ? (
                <textarea
                  rows={5}
                  value={value.registry_pass}
                  onChange={(e) => onChange({ ...value, registry_pass: e.target.value })}
                  placeholder={provider.passPlaceholder}
                  className="w-full px-3 py-2 text-xs font-mono bg-dark-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500 leading-relaxed resize-y"
                />
              ) : (
                <input
                  type="password"
                  value={value.registry_pass}
                  onChange={(e) => onChange({ ...value, registry_pass: e.target.value })}
                  placeholder={provider.passPlaceholder}
                  className="w-full px-3 py-2 text-xs font-mono bg-dark-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500"
                />
              )}
            </div>
          )}

          {/* Provider-specific help text */}
          {provider.helpText && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-indigo-500/5 border border-indigo-500/20 text-[10px] text-slate-400 leading-relaxed">
              <ExternalLink size={11} className="text-indigo-400 mt-0.5 shrink-0" />
              <div>{provider.helpText}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
