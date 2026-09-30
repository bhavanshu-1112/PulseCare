import React from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  className = '',
  id,
}) => {
  const switchId = id || React.useId();

  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      {(label || description) && (
        <label htmlFor={switchId} className="cursor-pointer select-none min-w-0 pr-2">
          {label && <div className="text-sm font-medium text-[var(--color-ink)]">{label}</div>}
          {description && (
            <div className="text-xs text-[var(--color-muted)] mt-0.5 leading-normal">{description}</div>
          )}
        </label>
      )}

      <RadixSwitch.Root
        id={switchId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={`w-10 h-5.5 rounded-full transition-colors relative flex-shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 border border-transparent ${
          checked ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-line)]'
        }`}
      >
        <RadixSwitch.Thumb
          className={`block w-4.5 h-4.5 bg-white rounded-full transition-transform shadow-sm ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </RadixSwitch.Root>
    </div>
  );
};
