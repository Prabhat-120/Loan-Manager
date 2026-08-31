import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth, fetchReadiness } from '../../api/health-api';
import { Badge } from '../ui/Badge';
import { Activity, Database } from 'lucide-react';

export const Header: React.FC = () => {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 15000
  });

  const { data: readiness } = useQuery({
    queryKey: ['readiness'],
    queryFn: fetchReadiness,
    refetchInterval: 15000
  });

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center space-x-4">
        <h1 className="text-lg font-semibold text-slate-100">Loan Management SaaS</h1>
        <span className="text-xs px-2 py-0.5 rounded bg-brand-900/50 text-brand-400 border border-brand-800">
          Module 1 Foundation
        </span>
      </div>

      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 text-xs">
          <Activity className="w-4 h-4 text-slate-400" />
          <span className="text-slate-400">App:</span>
          {health?.status === 'ok' ? (
            <Badge variant="success">Online</Badge>
          ) : (
            <Badge variant="neutral">Connecting...</Badge>
          )}
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <Database className="w-4 h-4 text-slate-400" />
          <span className="text-slate-400">DB:</span>
          {readiness?.status === 'ready' ? (
            <Badge variant="success">Connected</Badge>
          ) : (
            <Badge variant="warning">Disconnected</Badge>
          )}
        </div>
      </div>
    </header>
  );
};
