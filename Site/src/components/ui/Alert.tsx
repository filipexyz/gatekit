import { HTMLAttributes, forwardRef } from 'react';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', title, children, ...props }, ref) => {
    const variants = {
      info: {
        container: 'bg-blue-50 border-blue-200 text-blue-900',
        icon: <Info className="w-5 h-5 text-blue-600" />,
      },
      success: {
        container: 'bg-green-50 border-green-200 text-green-900',
        icon: <CheckCircle className="w-5 h-5 text-green-600" />,
      },
      warning: {
        container: 'bg-yellow-50 border-yellow-200 text-yellow-900',
        icon: <AlertCircle className="w-5 h-5 text-yellow-600" />,
      },
      danger: {
        container: 'bg-red-50 border-red-200 text-red-900',
        icon: <XCircle className="w-5 h-5 text-red-600" />,
      },
    };

    const config = variants[variant];

    return (
      <div
        ref={ref}
        className={cn(
          'flex gap-3 p-4 border rounded-lg',
          config.container,
          className
        )}
        {...props}
      >
        <div className="flex-shrink-0">{config.icon}</div>
        <div className="flex-1">
          {title && <h5 className="font-semibold mb-1">{title}</h5>}
          <div className="text-sm">{children}</div>
        </div>
      </div>
    );
  }
);

Alert.displayName = 'Alert';
