import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetClose = SheetPrimitive.Close;
const SheetTitle = SheetPrimitive.Title;

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & { overlay?: boolean }
>(({ className, children, overlay = true, ...props }, ref) => (
  <SheetPrimitive.Portal>
    {overlay ? <SheetPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40" /> : null}
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-40 flex flex-col gap-4 border border-white/10 bg-[#161616] p-4 text-foreground shadow-lg",
        className,
      )}
      {...props}
    >
      {children}
    </SheetPrimitive.Content>
  </SheetPrimitive.Portal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

export { Sheet, SheetClose, SheetContent, SheetTitle };
