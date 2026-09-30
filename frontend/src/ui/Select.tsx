import React from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const Select: React.FC<SelectProps> = ({
  value,
  onValueChange,
  options,
  placeholder = 'Select an option',
  label,
  disabled = false,
  className = '',
  size = 'md',
}) => {
  const selectedOption = options.find((o) => o.value === value);
  const sizeClasses = size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm';

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-[var(--color-muted)]">{label}</label>}
      <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <RadixSelect.Trigger
          className={`inline-flex items-center justify-between gap-2 bg-[var(--color-surface)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)] hover:border-[var(--color-brand)]/60 focus:border-[var(--color-brand)] transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${className}`}
        >
          <RadixSelect.Value placeholder={placeholder}>
            {selectedOption ? selectedOption.label : placeholder}
          </RadixSelect.Value>
          <RadixSelect.Icon asChild>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--color-muted)] flex-shrink-0" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={4}
            className="z-50 min-w-[8rem] overflow-hidden bg-[var(--color-surface)] border border-[var(--color-line)] rounded-lg shadow-lg py-1 animate-in fade-in-80"
          >
            <RadixSelect.Viewport className="p-1">
              {options.map((opt) => (
                <RadixSelect.Item
                  key={opt.value}
                  value={opt.value}
                  className="relative flex items-center justify-between px-3 py-1.5 text-xs rounded-md text-[var(--color-ink)] hover:bg-[var(--color-raised)] cursor-pointer select-none outline-none focus:bg-[var(--color-brand-tint)] focus:text-[var(--color-brand)]"
                >
                  <RadixSelect.ItemText>
                    <span>{opt.label}</span>
                    {opt.description && (
                      <span className="block text-[11px] text-[var(--color-muted)]">
                        {opt.description}
                      </span>
                    )}
                  </RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator>
                    <Check className="w-3.5 h-3.5 text-[var(--color-brand)] ml-2" />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </div>
  );
};
