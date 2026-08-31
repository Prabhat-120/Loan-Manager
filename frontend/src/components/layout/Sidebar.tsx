import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CreditCard,
  Banknote,
  Users,
  Building2,
  UserCheck,
  FileText,
  Bell,
  ShieldCheck
} from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/loans', label: 'Loans', icon: CreditCard },
  { path: '/payments', label: 'Payments', icon: Banknote },
  { path: '/persons', label: 'Borrowers', icon: Users },
  { path: '/tenants', label: 'Tenants', icon: Building2 },
  { path: '/users', label: 'Users', icon: UserCheck },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/audit', label: 'Audit Log', icon: ShieldCheck }
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/60 p-4 flex flex-col justify-between hidden md:flex min-h-screen">
      <div className="space-y-6">
        <div className="px-3 py-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Navigation Modules
          </p>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  )
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 text-xs text-slate-400">
        <p className="font-semibold text-slate-300 mb-1">Module 1 Foundation</p>
        <p>Architectural routes ready for feature implementation.</p>
      </div>
    </aside>
  );
};
