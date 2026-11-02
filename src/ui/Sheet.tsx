import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from './Button';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}

/** Bottom sheet built on the native <dialog> (focus trap, Esc to close). */
export function Sheet({ open, onClose, title, closeLabel, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      {open && (
        <div className="sheet__inner">
          <div className="sheet__grip" aria-hidden />
          <div className="sheet__head">
            <h2 id={titleId} className="sheet__title">{title}</h2>
            <IconButton label={closeLabel} onClick={onClose}><X size={22} strokeWidth={1.5} aria-hidden /></IconButton>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
