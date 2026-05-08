import * as React from "react";
import { Input } from "@/components/ui/input";

interface WheelNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  wheelStep?: number;
}

export const WheelNumberInput = React.forwardRef<HTMLInputElement, WheelNumberInputProps>(
  ({ value, onChange, wheelStep = 1, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLInputElement>(null);

    // Merge refs
    React.useImperativeHandle(forwardedRef, () => innerRef.current!);

    React.useEffect(() => {
      const el = innerRef.current;
      if (!el) return;

      const handler = (e: WheelEvent) => {
        e.preventDefault();
        const currentVal = parseFloat(String(value)) || 0;
        const delta = e.deltaY < 0 ? wheelStep : -wheelStep;
        const newVal = Math.max(0, currentVal + delta);
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        )!.set!;
        nativeInputValueSetter.call(el, String(Math.round(newVal * 100) / 100));
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };

      el.addEventListener('wheel', handler, { passive: false });
      return () => el.removeEventListener('wheel', handler);
    }, [value, wheelStep, onChange]);

    return (
      <Input
        ref={innerRef}
        type="number"
        value={value}
        onChange={onChange}
        onFocus={(e) => e.target.select()}
        {...props}
      />
    );
  }
);

WheelNumberInput.displayName = "WheelNumberInput";
