import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Users } from 'lucide-react';

export const PersonsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-sky-400" /> Borrower Profiles (Persons)
          </h2>
          <p className="text-sm text-slate-400">Borrower Identity & KYC Records</p>
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
