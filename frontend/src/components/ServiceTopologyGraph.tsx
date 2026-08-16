import React, { useState, useEffect, useRef } from 'react';
import { ServiceInfo } from '../types';;
import { Network, Play, Layers, Zap, Terminal, Rocket, Workflow, Box, CheckCircle2, Info } from 'lucide-react';
import { clsx } from 'clsx';

interface ServiceTopologyGraphProps {
  services: ServiceInfo[];
  onOpenLogs?: (serviceName: string) => void;
  onOpenExec?: (serviceName: string) => void;
}

interface ConnectionLine {
  id: string;
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const ServiceTopologyGraph: React.FC<ServiceTopologyGraphProps> = ({
  services,
  onOpenLogs,
  onOpenExec,
}) => {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [hoveredService, setHoveredService] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionLine[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});



  // 1. Build lookup map of incoming & outgoing service dependencies
  const serviceMap = new Map<string, ServiceInfo>();
  const incomingMap = new Map<string, string[]>(); // service -> dependencies it needs
  const outgoingMap = new Map<string, string[]>(); // service -> dependents that rely on it

  services.forEach((s) => {
    serviceMap.set(s.service, s);
    incomingMap.set(s.service, s.depends_on || []);
  });

  services.forEach((s) => {
    (s.depends_on || []).forEach((dep) => {
      const existing = outgoingMap.get(dep) || [];
      if (!existing.includes(s.service)) {
        existing.push(s.service);
        outgoingMap.set(dep, existing);
      }
    });
  });

  // 2. Compute execution layers / stages
  const stage0 = services.filter((s) => !s.depends_on || s.depends_on.length === 0);
  const stage1 = services.filter((s) => s.depends_on && s.depends_on.length > 0 && s.depends_on.every((dep) => stage0.some((p) => p.service === dep)));
  const stage2 = services.filter((s) => !stage0.includes(s) && !stage1.includes(s));

  const stages: { stageName: string; stageDesc: string; services: ServiceInfo[] }[] = [];
  if (stage0.length > 0) {
    stages.push({
      stageName: 'Phase 1: Foundation (Root Prerequisites)',
      stageDesc: 'Independent origin services with no upstream dependencies.',
      services: stage0,
    });
  }
  if (stage1.length > 0) {
    stages.push({
      stageName: 'Phase 2: Core Applications & Workers',
      stageDesc: 'Application services dependent on Phase 1 infrastructure.',
      services: stage1,
    });
  }
  if (stage2.length > 0) {
    stages.push({
      stageName: 'Phase 3: Ingress Gateways & Reverse Proxies',
      stageDesc: 'Proxy gateways dependent on Phase 2 applications.',
      services: stage2,
    });
  }
  if (stages.length === 0) {
    stages.push({ stageName: 'All Services', stageDesc: 'Flat service list', services });
  }

  // 3. Recalculate physical SVG connector lines between cards
  const updateConnections = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newConnections: ConnectionLine[] = [];

    // Root Stack Node to Stage 0 Root Services
    const rootEl = nodeRefs.current['stack-root'];
    if (rootEl) {
      const rootRect = rootEl.getBoundingClientRect();
      const x1 = rootRect.right - containerRect.left;
      const y1 = rootRect.top + rootRect.height / 2 - containerRect.top;

      stage0.forEach((s) => {
        const targetEl = nodeRefs.current[s.service];
        if (targetEl) {
          const targetRect = targetEl.getBoundingClientRect();
          const x2 = targetRect.left - containerRect.left;
          const y2 = targetRect.top + targetRect.height / 2 - containerRect.top;
          newConnections.push({
            id: `root->${s.service}`,
            from: 'stack-root',
            to: s.service,
            x1,
            y1,
            x2,
            y2,
          });
        }
      });
    }

    // Service to Service depends_on connections
    services.forEach((targetSvc) => {
      const targetEl = nodeRefs.current[targetSvc.service];
      if (!targetEl) return;
      const targetRect = targetEl.getBoundingClientRect();
      const x2 = targetRect.left - containerRect.left;
      const y2 = targetRect.top + targetRect.height / 2 - containerRect.top;

      (targetSvc.depends_on || []).forEach((depName) => {
        const sourceEl = nodeRefs.current[depName];
        if (sourceEl) {
          const sourceRect = sourceEl.getBoundingClientRect();
          const x1 = sourceRect.right - containerRect.left;
          const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top;

          newConnections.push({
            id: `${depName}->${targetSvc.service}`,
            from: depName,
            to: targetSvc.service,
            x1,
            y1,
            x2,
            y2,
          });
        }
      });
    });

    setConnections(newConnections);
  };

  useEffect(() => {
    updateConnections();
    window.addEventListener('resize', updateConnections);
    const timer = setTimeout(updateConnections, 300);
    return () => {
      window.removeEventListener('resize', updateConnections);
      clearTimeout(timer);
    };
  }, [services, stages]);

  const selectedServiceObj = selectedService ? serviceMap.get(selectedService) : null;

  if (!services || services.length === 0) {
    return (
      <div className="p-8 text-center glass-panel border border-slate-800 rounded-2xl bg-dark-900/60">
        <Network size={32} className="mx-auto text-slate-600 mb-2" />
        <p className="text-sm font-semibold text-slate-300">No Services Registered in Topology</p>
        <p className="text-xs text-slate-500 mt-1">Start containers or check docker-compose.yml configuration.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Topology Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-dark-900 border border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-sans">
            <Workflow size={16} className="text-brand-400" />
            <span>Service Architecture</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Visual representation of service dependencies (<code>Root ➔ Prerequisites ➔ Dependent Applications</code>).
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{services.filter((s) => s.status.toLowerCase().includes('running') || s.status.toLowerCase().includes('up')).length} Healthy</span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-dark-950 border border-slate-800 text-slate-300">
            Total Services: <b>{services.length}</b>
          </span>
        </div>
      </div>

      {/* SVG Canvas Overlay + Grid Layout */}
      <div className="relative min-h-[480px] p-6 rounded-3xl bg-dark-950/90 border border-slate-800 overflow-x-auto shadow-2xl">
        {/* Node Cards Column Canvas (Root -> Stage 0 -> Stage 1 -> Stage 2) */}
        <div className="relative z-10 flex items-stretch gap-12 min-w-max" ref={containerRef}>
          {/* SVG Path Connectors Overlay (Now inside the scrollable content) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <defs>
              {/* Standard Arrow Marker */}
              <marker
                id="arrow-default"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#475569" />
              </marker>

              {/* Active Highlight Arrow Marker */}
              <marker
                id="arrow-active"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#38bdf8" />
              </marker>

              {/* Glowing Gradient Line Filter */}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Render Physical Connecting Lines (Elbow / Right-Angle Curves) */}
            {connections.map((conn) => {
              const isHighlighted =
                hoveredService === conn.from ||
                hoveredService === conn.to ||
                selectedService === conn.from ||
                selectedService === conn.to;

              const midX = conn.x1 + (conn.x2 - conn.x1) / 2;
              const pathData = `M ${conn.x1} ${conn.y1} H ${midX} V ${conn.y2} H ${conn.x2}`;

              return (
                <g key={conn.id}>
                  {/* Background Shadow Line */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={isHighlighted ? '#38bdf8' : '#334155'}
                    strokeWidth={isHighlighted ? 3 : 2}
                    strokeDasharray={conn.from === 'stack-root' ? '4 4' : 'none'}
                    markerEnd={isHighlighted ? 'url(#arrow-active)' : 'url(#arrow-default)'}
                    className="transition-all duration-300"
                    filter={isHighlighted ? 'url(#glow)' : undefined}
                  />
                </g>
              );
            })}
          </svg>

          {/* Column 0: Root Compose Stack Node (ArgoCD Style Octopus/Compose Root) */}
          <div className="flex flex-col justify-center w-56 shrink-0 space-y-3 z-10 relative">
            <div className="text-center pb-2 border-b border-slate-800">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-bold">
                GitOps Stack Root
              </span>
            </div>

            <div
              ref={(el) => (nodeRefs.current['stack-root'] = el)}
              className="glass-panel p-4 rounded-2xl border border-brand-500/40 bg-dark-900/95 shadow-xl shadow-brand-500/10 text-center space-y-2 group hover:border-brand-400 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-brand-500/15 border border-brand-500/30 text-brand-400 flex items-center justify-center mx-auto shadow-lg shadow-brand-500/20 group-hover:scale-110 transition-transform">
                <Box size={24} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100 font-mono">Docker Compose Stack</h4>
                <p className="text-[10px] text-brand-300 font-mono font-semibold">Origin Root Node</p>
              </div>
              <div className="pt-1">
                <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 inline-flex items-center gap-1">
                  <CheckCircle2 size={10} /> Active Stack
                </span>
              </div>
            </div>
          </div>

          {/* Stage Columns */}
          {stages.map((stage, sIdx) => (
            <div key={sIdx} className="flex flex-col justify-around w-72 shrink-0 space-y-4 relative z-10">
              {/* Column Title */}
              <div className="pb-2 border-b border-slate-800">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-4 h-4 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/40 text-[9px] font-bold font-mono flex items-center justify-center">
                    {sIdx + 1}
                  </span>
                  <h4 className="text-xs font-bold text-slate-100 font-sans truncate">
                    {stage.stageName}
                  </h4>
                </div>
                <p className="text-[10px] text-slate-500 font-sans truncate">{stage.stageDesc}</p>
              </div>

              {/* Service Cards */}
              <div className="space-y-4 flex-1 flex flex-col justify-center">
                {stage.services.map((svc) => {
                  const isSelected = selectedService === svc.service;
                  const isHovered = hoveredService === svc.service;
                  const isRunning = svc.status.toLowerCase().includes('running') || svc.status.toLowerCase().includes('up');
                  const inc = incomingMap.get(svc.service) || [];
                  const outg = outgoingMap.get(svc.service) || [];
                  const isRoot = inc.length === 0;

                  return (
                    <div
                      key={svc.service}
                      ref={(el) => (nodeRefs.current[svc.service] = el)}
                      onClick={() => setSelectedService(svc.service)}
                      onMouseEnter={() => setHoveredService(svc.service)}
                      onMouseLeave={() => setHoveredService(null)}
                      className={clsx(
                        'glass-panel p-4 rounded-2xl border transition-all cursor-pointer relative group',
                        isSelected
                          ? 'border-brand-400 bg-brand-500/15 shadow-xl shadow-brand-500/25 scale-[1.03] z-20'
                          : isHovered
                          ? 'border-brand-500/70 bg-dark-900 shadow-lg shadow-brand-500/10 z-20'
                          : 'border-slate-800 hover:border-slate-700 bg-dark-900/95'
                      )}
                    >
                      {/* Node Header */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={clsx(
                              'w-2.5 h-2.5 rounded-full shrink-0',
                              isRunning ? 'bg-emerald-400 shadow-md shadow-emerald-400/50 animate-pulse' : 'bg-rose-400'
                            )}
                          />
                          <span className="font-bold text-xs text-slate-100 font-mono truncate" title={svc.service}>
                            {svc.service}
                          </span>
                        </div>

                        {isRoot ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 shrink-0 font-semibold">
                            <Rocket size={10} className="text-amber-400" /> Origin
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 shrink-0 font-semibold">
                            <Workflow size={10} className="text-indigo-400" /> Child Node
                          </span>
                        )}
                      </div>

                      {/* Live Telemetry */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-300 mb-2.5 bg-dark-950 p-2 rounded-xl border border-slate-800/80">
                        <div>
                          <span className="text-slate-500 block text-[8px] uppercase">CPU</span>
                          <span className="text-brand-400 font-bold">{svc.cpu_perc || '0.00%'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[8px] uppercase">RAM</span>
                          <span className="text-purple-400 font-bold truncate block">{svc.mem_usage || '0B'}</span>
                        </div>
                      </div>

                      {/* Connection Badges */}
                      <div className="space-y-1.5 text-[10px] font-mono">
                        {inc.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 text-indigo-300">
                            <span className="text-indigo-400 font-bold">Depends:</span>
                            {inc.map((dep) => (
                              <span key={dep} className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                                {dep}
                              </span>
                            ))}
                          </div>
                        )}

                        {outg.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 text-emerald-300">
                            <span className="text-emerald-400 font-bold">Feeds:</span>
                            {outg.map((child) => (
                              <span key={child} className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                {child}
                              </span>
                            ))}
                          </div>
                        )}

                        {svc.ports && svc.ports !== 'None' && (
                          <div className="flex items-center gap-1 text-amber-300 text-[10px]">
                            <Zap size={10} className="text-amber-400" />
                            <span>{svc.ports}</span>
                          </div>
                        )}
                      </div>

                      {/* Quick Actions */}
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenLogs) onOpenLogs(svc.service);
                          }}
                          className="text-[10px] text-brand-400 hover:text-brand-300 font-mono hover:underline flex items-center gap-1"
                        >
                          <Terminal size={10} /> Logs
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenExec) onOpenExec(svc.service);
                          }}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono hover:underline flex items-center gap-1"
                        >
                          <Play size={10} /> Exec
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.hash = `#/machines/podman-machine-default/containers/${svc.container_id}`;
                          }}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-mono hover:underline flex items-center gap-1"
                        >
                          <Info size={10} /> Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Node Details Drawer */}
      {selectedServiceObj && (
        <div className="p-5 rounded-2xl bg-dark-900 border border-slate-800 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-brand-400" />
              <h4 className="text-sm font-bold text-slate-100 font-sans">
                Node Topology Details: <span className="text-brand-300 font-mono">{selectedServiceObj.service}</span>
              </h4>
            </div>
            <button
              onClick={() => setSelectedService(null)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3 rounded-xl bg-dark-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px] uppercase mb-1">Container Name / ID</span>
              <a 
                href={`#/machines/podman-machine-default/containers/${selectedServiceObj.container_id}`}
                className="text-brand-400 hover:text-brand-300 font-bold block truncate hover:underline"
              >
                {selectedServiceObj.name}
              </a>
              <span className="text-slate-500 text-[10px]">{selectedServiceObj.container_id.slice(0, 12)}</span>
            </div>

            <div className="p-3 rounded-xl bg-dark-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px] uppercase mb-1">Incoming Prerequisites (Needs to start 1st)</span>
              {selectedServiceObj.depends_on && selectedServiceObj.depends_on.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedServiceObj.depends_on.map((dep) => (
                    <span key={dep} className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                      {dep}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-amber-400 italic">🚀 Independent Root Service (Starts First)</span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-dark-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px] uppercase mb-1">Mounted Storage Volumes</span>
              {selectedServiceObj.volumes && selectedServiceObj.volumes.length > 0 ? (
                <div className="space-y-1 text-[10px]">
                  {selectedServiceObj.volumes.map((v, idx) => (
                    <div key={idx} className="text-slate-300 truncate" title={v}>
                      {v}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-slate-500 italic">No persistent volume mounts</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
