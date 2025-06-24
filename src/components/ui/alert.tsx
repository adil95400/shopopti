import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

interface AlertProps {
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  title?: string;
  children?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: 'bg-gray-50 text-gray-800 border-gray-200',
  success: 'bg-green-50 text-green-800 border-green-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  info: 'bg-blue-50 text-blue-800 border-blue-200'
};

const variantIcons: Record<string, React.ReactNode> = {
  default: <Info className="h-5 w-5" />,
  success: <CheckCircle2 className="h-5 w-5" />,
  error: <AlertCircle className="h-5 w-5" />,
  warning: <AlertTriangle className="h-5 w-5" />,
  info: <Info className="h-5 w-5" />
};

export function Alert({ variant = 'default', title, children, className = '' }: AlertProps) {
  return (
    <div className={`flex items-start space-x-3 rounded-md border p-4 text-sm ${variantStyles[variant]} ${className}`}> 
      <div>{variantIcons[variant]}</div>
      <div>
        {title && <p className="font-medium">{title}</p>}
        {children && <p>{children}</p>}
      </div>
    </div>
  );
}
