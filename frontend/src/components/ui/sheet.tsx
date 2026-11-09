import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[3px] dark:bg-background/60 data-[state=open]:animate-backdrop-in',
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

// Sheets travel on the iOS spring curve (cubic-bezier(0.32, 0.72, 0, 1)).
const sheetVariants = cva('fixed z-50 flex flex-col bg-card text-card-foreground shadow-float focus:outline-none', {
  variants: {
    side: {
      left: 'inset-y-0 left-0 h-full w-full max-w-xs rounded-r-[26px] bg-sidebar data-[state=open]:animate-sheet-in-left',
      right:
        'inset-y-0 right-0 h-full w-full max-w-md data-[state=open]:animate-sheet-in-right sm:inset-y-2 sm:right-2 sm:h-auto sm:max-w-[540px] sm:rounded-[28px]',
      bottom: 'inset-x-0 bottom-0 max-h-[88vh] rounded-t-[28px] pt-2 data-[state=open]:animate-sheet-in-bottom',
    },
  },
  defaultVariants: { side: 'right' },
});

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  hideClose?: boolean;
}

const SheetContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, SheetContentProps>(
  ({ side = 'right', className, children, hideClose, ...props }, ref) => (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
        {side === 'bottom' && <span aria-hidden className="mx-auto mb-1 h-1.5 w-10 flex-shrink-0 rounded-full bg-foreground/15" />}
        {children}
        {!hideClose && (
          <DialogPrimitive.Close className="pressable absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/[0.06] text-muted-foreground hover:bg-foreground/[0.1] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </SheetPortal>
  ),
);
SheetContent.displayName = DialogPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 px-6 pb-3 pt-6 pr-16', className)} {...props} />
);

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-[19px] font-semibold tracking-[-0.018em] text-foreground', className)}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-[14px] text-muted-foreground', className)} {...props} />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription };
