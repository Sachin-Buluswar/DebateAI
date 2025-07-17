'use client';

import React from 'react';
import Layout from '../layout/Layout';

type WidgetProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
  colSpan?: 'col-span-1' | 'col-span-2' | 'col-span-3' | 'col-span-4';
};

export function Widget({ title, children, className = '', colSpan = 'col-span-1' }: WidgetProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-lg transition-shadow duration-200 overflow-hidden ${colSpan} ${className}`}>
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
        <h3>{title}</h3>
      </div>
      <div className="px-4 py-5 sm:p-6">{children}</div>
    </div>
  );
}

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="pb-5 border-b border-gray-200 dark:border-gray-700 sm:flex sm:items-center sm:justify-between mb-6">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
        </div>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {children}
        </div>
      </div>
    </Layout>
  );
} 