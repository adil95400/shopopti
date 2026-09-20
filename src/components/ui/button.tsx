import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  asChild?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'default',
  size = 'default',
  asChild = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const variantStyles = {
    default: 'bg-primary text-white hover:bg-primary/90 focus-visible:ring-primary',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-accent',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-secondary',
    ghost: 'hover:bg-accent hover:text-accent-foreground focus-visible:ring-accent',
    link: 'text-primary underline-offset-4 hover:underline focus-visible:ring-primary',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive'
  };
  const sizeStyles = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 px-3 text-sm',
    lg: 'h-11 px-8 text-lg',
    icon: 'h-10 w-10'
  };
  const mergedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  if (asChild) {
    if (!React.isValidElement(children)) {
      throw new Error('Button with asChild expects exactly one valid React element');
    }
    return React.cloneElement(children as React.ReactElement<{ className?: string }>, {
      className: `${mergedClassName} ${children.props.className || ''}`.trim(),
    });
  }

  return <button className={mergedClassName} {...props}>{children}</button>;
}
