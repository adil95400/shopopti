import React from 'react';
import { CheckCircle, Info, AlertTriangle, XCircle } from 'lucide-react';
import clsx from 'clsx';

export type AlertVariant = 'default' | 'success' | 'warning' | 'error';

const variantStyles: Record<AlertVariant, string> = {
  default: 'bg-gray-50 text-gray-800 border-gray-300',
  success: 'bg-green-50 text-green-800 border-green-300',
  warning: 'bg-yellow-50 text-yellow-800 border-yellow-300',
  error: 'bg-red-50 text-red-800 border-red-300'
};

const icons: Record<AlertVariant, React.ElementType> = {
  default: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
}

export function Alert({
  variant = 'default',
  title,
  className,
  children,
  ...props
}: AlertProps) {
  const Icon = icons[variant];
  return (
    <div
      role="alert"
      className={clsx(
        'flex items-start gap-2 rounded-md border px-4 py-3 text-sm',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      <Icon className="h-4 w-4 mt-0.5" />
      <div>
        {title && <h4 className="font-medium mb-1">{title}</h4>}
        {children}
      </div>
    </div>
  );
}

export { toast } from 'sonner';
