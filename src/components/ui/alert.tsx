import React from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

interface AlertProps {
  variant?: 'default' | 'success' | 'warning' | 'error';
  className?: string;
  children: React.ReactNode;
}

const icons = {
  default: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

export function Alert({ variant = 'default', className = '', children }: AlertProps) {
  const Icon = icons[variant];
  const base = 'rounded-md p-4 flex items-start gap-3 text-sm';
  const styles: Record<string, string> = {
    default: 'bg-muted text-muted-foreground',
    success: 'bg-success-400/10 text-success-400',
    warning: 'bg-warning-400/10 text-warning-400',
    error: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className={`${base} ${styles[variant]} ${className}`}>
      <Icon className="h-4 w-4 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}
