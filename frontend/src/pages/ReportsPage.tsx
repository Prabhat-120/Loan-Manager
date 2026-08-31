import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { FileText } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-400" /> Reports Module
          </h2>
          <p className="text-sm text-slate-400">Financial Reports & Data Export</p>
        </div>
        <Badge variant="neutral">Planned Feature</Badge>
      </div>

      <Card title="Module Foundation Established" subtitle="Architectural route initialized">
        <p className="text-sm text-slate-300">
          This feature module is scheduled for implementation in a dedicated feature branch. All route layout structures, state management wrappers, and navigation hooks are configured.
        </p>
      </Card>
    </div>
  );
};
