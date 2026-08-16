import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from './pages/Dashboard';
import { StackDetailPage } from './pages/StackDetailPage';
import { CreateStackPage } from './pages/CreateStackPage';
import { PodmanMachineDetailPage } from './pages/PodmanMachineDetailPage';
import { ContainerDetailPage } from './pages/ContainerDetailPage';
import { LocalProjectDetailPage } from './pages/LocalProjectDetailPage';
import { Login } from './pages/Login';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 2000,
    },
  },
});

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('gitops_admin_logged_in') === 'true';
  });

  const [currentHash, setCurrentHash] = useState<string>(() => window.location.hash || '#/');

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || '#/');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('gitops_admin_logged_in');
    setIsAuthenticated(false);
  };




  // Parse route from hash, and also extract query parameters
  const hashParts = currentHash.split('?');
  const hashPath = hashParts[0];
  const queryParams = new URLSearchParams(hashParts[1] || '');
  const sourceProject = queryParams.get('project');

  const stackDetailMatch = hashPath.match(/^#\/stacks\/(.+)$/);
  const isNewStack = hashPath === '#/stacks/new';
  
  const machineDetailMatch = hashPath.match(/^#\/machines\/(.+)$/);
  const containerDetailMatch = hashPath.match(/^#\/machines\/(.+)\/containers\/(.+)$/);
  const localProjectMatch = hashPath.match(/^#\/machines\/(.+)\/projects\/(.+)$/);
  
  let machineName = null;
  let containerId = null;
  let localProjectName = null;
  
  if (containerDetailMatch) {
    machineName = decodeURIComponent(containerDetailMatch[1]);
    containerId = decodeURIComponent(containerDetailMatch[2]);
  } else if (localProjectMatch) {
    machineName = decodeURIComponent(localProjectMatch[1]);
    localProjectName = decodeURIComponent(localProjectMatch[2]);
  } else if (machineDetailMatch) {
    machineName = decodeURIComponent(machineDetailMatch[1]);
  }

  // Only extract detail ID if it's NOT the new stack route
  const detailStackId = stackDetailMatch && !isNewStack ? decodeURIComponent(stackDetailMatch[1]) : null;

  return (
    <QueryClientProvider client={queryClient}>
      {!isAuthenticated ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : isNewStack ? (
        <CreateStackPage
          onBack={() => { window.location.hash = '#/?mainTab=stacks'; }}
          onLogout={handleLogout}
        />
      ) : detailStackId ? (
        <StackDetailPage
          stackId={detailStackId}
          onBack={() => { window.location.hash = '#/?mainTab=stacks'; }}
          onLogout={handleLogout}
        />
      ) : localProjectName && machineName ? (
        <LocalProjectDetailPage
          machineName={machineName}
          projectName={localProjectName}
          onBack={() => { window.location.hash = `#/machines/${encodeURIComponent(machineName!)}`; }}
          onLogout={handleLogout}
        />
      ) : containerId && machineName ? (
        <ContainerDetailPage
          machineName={machineName}
          containerId={containerId}
          onBack={() => {
            if (sourceProject) {
              window.location.hash = `#/machines/${encodeURIComponent(machineName!)}/projects/${encodeURIComponent(sourceProject)}`;
            } else {
              window.location.hash = `#/machines/${encodeURIComponent(machineName!)}`;
            }
          }}
          onLogout={handleLogout}
        />
      ) : machineName ? (
        <PodmanMachineDetailPage
          machineName={machineName}
          onBack={() => { window.location.hash = '#/?mainTab=podman'; }}
          onLogout={handleLogout}
        />
      ) : (
        <Dashboard onLogout={handleLogout} />
      )}
    </QueryClientProvider>
  );
};

export default App;
