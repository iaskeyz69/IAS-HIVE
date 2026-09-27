import { Toaster as Sonner } from "sonner";

function Toaster() {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:border-white/10 group-[.toaster]:bg-[#161616] group-[.toaster]:text-[#fafaf9]",
        },
      }}
    />
  );
}

export { Toaster };
