import React from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SegmentedControlProps<T extends string = string> {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentOption<T>[];
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  value,
  onValueChange,
  options,
  size = 'md',
  className = '',
}: SegmentedControlProps<T>) {
  const paddingClass = size === 'sm' ? 'p-0.5 text-xs' : 'p-1 text-sm';
  const itemPadding = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-xs font-medium';

  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(val) => {
        if (val) onValueChange(val as T);
      }}
      className={`inline-flex items-center bg-[var(--color-raised)] border border-[var(--color-line)] rounded-lg ${paddingClass} ${className}`}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isSelected = value === option.value;

        return (
          <ToggleGroup.Item
            key={option.value}
            value={option.value}
            className={`inline-flex items-center gap-1.5 rounded-md transition-all duration-150 select-none ${itemPadding} ${
              isSelected
                ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-sm font-semibold border border-[var(--color-line)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)] border border-transparent'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] tabular-nums font-semibold ${
                  isSelected
                    ? 'bg-[var(--color-brand-tint)] text-[var(--color-brand)]'
                    : 'bg-black/5 dark:bg-white/10 text-[var(--color-muted)]'
                }`}
              >
                {option.count}
              </span>
            )}
          </ToggleGroup.Item>
        );
      })}
    </ToggleGroup.Root>
  );
}
