import { forwardRef, type InputHTMLAttributes } from "react";
import type { SVGProps } from "react";

interface IconInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
}

export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(function IconInput(
  { icon: Icon, className = "", ...props },
  ref,
) {
  return (
    <div className="relative">
      <Icon
        width={16}
        height={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
      />
      <input
        ref={ref}
        {...props}
        className={`w-full rounded-lg border border-neutral-300 py-2 pl-9 pr-3 text-sm ${className}`}
      />
    </div>
  );
});
