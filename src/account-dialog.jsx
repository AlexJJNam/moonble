import React, { useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export function AccountDialog({ open, onOpenChange, busy = false, trigger, title, description, className = '', children }) {
  const contentRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    let frame;
    const update = () => {
      const offset = viewport && viewport.scale === 1 ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      contentRef.current?.style.setProperty('--account-keyboard-offset', `${offset > 120 ? offset : 0}px`);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    schedule();
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    document.addEventListener('focusin', schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('focusin', schedule);
    };
  }, [open]);

  const preventBusyClose = event => { if (busy) event.preventDefault(); };
  return <Dialog.Root open={open} onOpenChange={next => { if (!busy) onOpenChange(next); }}>
    <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="account-dialog-overlay" />
      <Dialog.Content ref={contentRef} className={`account-dialog ${className}`} onEscapeKeyDown={preventBusyClose} onInteractOutside={preventBusyClose}>
        <header className="account-dialog-heading">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Close asChild><button className="account-dialog-close" type="button" aria-label="닫기" disabled={busy}><X size={19} aria-hidden="true" /></button></Dialog.Close>
        </header>
        <Dialog.Description className="mb-sr-only">{description}</Dialog.Description>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
