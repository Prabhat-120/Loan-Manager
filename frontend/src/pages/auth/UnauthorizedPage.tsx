import React from 'react';
import { Link } from 'react-router-dom';

export const UnauthorizedPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 text-center text-slate-100">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 text-3xl font-extrabold mb-6 shadow-xl">
        403
      </div>
      <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
        Access Forbidden
      </h1>
      <p className="mt-3 text-base text-slate-400 max-w-md">
        You do not have the required permissions or tenant scope to access this page.
      </p>
      <div className="mt-8">
        <Link
          to="/"
          className="inline-flex items-center px-5 py-3 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
};
