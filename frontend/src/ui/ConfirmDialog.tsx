import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: 'danger' | 'brand';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  variant = 'brand',
  isLoading = false,
}) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 animate-in fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-line)] rounded-xl p-6 shadow-2xl z-50 animate-in zoom-in-95">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  variant === 'danger'
                    ? 'bg-[var(--color-critical-bg)] text-[var(--color-critical-text)]'
                    : 'bg-[var(--color-brand-tint)] text-[var(--color-brand)]'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <Dialog.Title className="text-base font-semibold text-[var(--color-ink)]">
                {title}
              </Dialog.Title>
            </div>
            <Dialog.Close className="p-1 text-[var(--color-muted)] hover:text-[var(--color-ink)] rounded-md">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-xs text-[var(--color-muted)] mb-6 leading-relaxed">
            {description}
          </Dialog.Description>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-ink)] border border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-raised)] transition-colors cursor-pointer disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
              }}
              disabled={isLoading}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50 ${
                variant === 'danger'
                  ? 'bg-[var(--color-critical)] hover:bg-[#A91E2F]'
                  : 'bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)]'
              }`}
            >
              {isLoading ? 'Processing...' : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
