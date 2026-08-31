import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { AlertTriangle } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <AlertTriangle className="w-16 h-16 text-amber-500 animate-pulse" />
      <h2 className="text-3xl font-bold text-slate-100">404 - Page Not Found</h2>
      <p className="text-slate-400 max-w-md">
        The route you are trying to access does not exist or has been moved.
      </p>
      <Link to="/">
        <Button variant="primary">Return to Dashboard</Button>
      </Link>
    </div>
  );
};
