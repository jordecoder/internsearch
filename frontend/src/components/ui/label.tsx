import * as React from 'react';
import { cn } from '@/lib/utils';

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'text-[13px] font-semibold tracking-[-0.003em] text-muted-foreground',
        className,
      )}
      {...props}
    />
  ),
);
Label.displayName = 'Label';

export { Label };
