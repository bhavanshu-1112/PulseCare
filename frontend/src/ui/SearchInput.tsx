import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 200,
  className = '',
}) => {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localVal !== value) {
        onChange(localVal);
      }
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [localVal, debounceMs, onChange, value]);

  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="w-3.5 h-3.5 text-[var(--color-muted)] absolute left-2.5 pointer-events-none" />
      <input
        type="text"
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        placeholder={placeholder}
        className="w-full h-8 pl-8 pr-7 bg-[var(--color-surface)] border border-[var(--color-line)] rounded-lg text-xs text-[var(--color-ink)] placeholder-[var(--color-muted)] transition-colors focus:border-[var(--color-brand)] focus:ring-0 outline-none"
      />
      {localVal && (
        <button
          type="button"
          onClick={() => {
            setLocalVal('');
            onChange('');
          }}
          className="absolute right-2 p-0.5 text-[var(--color-muted)] hover:text-[var(--color-ink)] rounded"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
