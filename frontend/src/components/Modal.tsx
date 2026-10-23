import { X } from 'lucide-react';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Fenêtre au premier plan : bottom-sheet sur mobile (poignée + glissière),
 * boîte de dialogue centrée sur desktop. Échap / clic sur le fond → fermer.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Glisser vers le bas pour fermer (bottom-sheet mobile) :
  // armé depuis la poignée/titre, ou quand le contenu est déjà en haut.
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const [dy, setDy] = useState(0);

  const onTouchStart = (e: React.TouchEvent) => {
    const el = sheetRef.current;
    if (!el) return;
    const onHandle = e.touches[0].clientY - el.getBoundingClientRect().top < 64;
    if (onHandle || !bodyRef.current || bodyRef.current.scrollTop <= 0)
      startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    setDy(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    if (startY.current === null) return;
    startY.current = null;
    if (dy > 100) onClose();
    else setDy(0);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 bg-night-950/70 backdrop-blur-sm"
      />
      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: dy ? `translateY(${dy}px)` : undefined,
          opacity: dy ? Math.max(0.4, 1 - dy / 400) : undefined,
        }}
        className={`animate-fade-up relative flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl border border-white/10 bg-night-900 p-5 shadow-2xl sm:rounded-2xl ${
          dy === 0 ? 'transition-transform duration-200' : ''
        }`}
      >
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-white/15 sm:hidden" />
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <h2 className="truncate text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200"
            aria-label="close"
          >
            <X size={18} />
          </button>
        </div>
        <div ref={bodyRef} className="min-h-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
