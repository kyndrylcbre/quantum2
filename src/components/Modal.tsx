import { useEffect, type ReactNode } from 'react'
import { EmeraldIconButton } from '../emerald'

export function Modal({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <EmeraldIconButton label="Close dialog" onClick={onClose}>✕</EmeraldIconButton>
        </div>
        {children}
      </div>
    </div>
  )
}
