import * as LabelPrimitive from '@radix-ui/react-label';
import type * as React from 'react';
import { cn } from '#/lib/utils.ts';

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('select-none font-medium text-sm leading-none text-foreground', className)}
      {...props}
    />
  );
}

export { Label };
