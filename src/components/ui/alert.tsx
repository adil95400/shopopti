import React from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

const icons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

interface AlertProps {
  variant?: AlertVariant;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function Alert({ variant = 'info', title, children, className = '' }: AlertProps) {
  const Icon = icons[variant];
  const base = {
    info: 'bg-blue-50 text-blue-800',
    success: 'bg-green-50 text-green-800',
    warning: 'bg-yellow-50 text-yellow-800',
    error: 'bg-red-50 text-red-800',
  }[variant];

  return (
    <div className={`flex items-start gap-3 rounded-md p-4 ${base} ${className}`}> 
      <Icon className="h-5 w-5 mt-0.5" />
      <div>
        {title && <h4 className="font-medium">{title}</h4>}
        {children && <p className="text-sm">{children}</p>}
      </div>
    </div>
  );
}
