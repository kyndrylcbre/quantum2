/* ============================================================
   Emerald component library (recreated). Import as:
     import { EmeraldButton, EmeraldChip, ... } from '../emerald'
   Names mirror the real @emerald-react/* API so a future swap to
   the licensed package is mostly an import change.
   ============================================================ */
import {
  forwardRef, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes,
  type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'
import './emerald.css'
export { CbreLogo } from './CbreLogo'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

/* ---------------- Button ---------------- */
export type EmeraldButtonVariant =
  | 'primary' | 'secondary' | 'light' | 'text' | 'danger' | 'danger-secondary'
export type EmeraldSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: EmeraldButtonVariant
  size?: EmeraldSize
  block?: boolean
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const EmeraldButton = forwardRef<HTMLButtonElement, ButtonProps>(function EmeraldButton(
  { variant = 'primary', size = 'md', block, loading, leftIcon, rightIcon, children, className, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx('em-btn', `em-btn--${variant}`, `em-btn--${size}`, block && 'em-btn--block', className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="em-btn__spinner" aria-hidden />}
      {!loading && leftIcon && <span className="em-btn__icon">{leftIcon}</span>}
      {children}
      {!loading && rightIcon && <span className="em-btn__icon">{rightIcon}</span>}
    </button>
  )
})

/* ---------------- IconButton ---------------- */
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md'
  outlined?: boolean
  label: string // required for a11y
}
export const EmeraldIconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function EmeraldIconButton(
  { size = 'md', outlined, label, children, className, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cx('em-iconbtn', `em-iconbtn--${size}`, outlined && 'em-iconbtn--outlined', className)}
      {...rest}
    >
      {children}
    </button>
  )
})

/* ---------------- Chip ---------------- */
interface ChipProps {
  children: ReactNode
  selected?: boolean
  disabled?: boolean
  onClose?: () => void
  onClick?: () => void
}
export function EmeraldChip({ children, selected, disabled, onClose, onClick }: ChipProps) {
  return (
    <span
      className={cx('em-chip', onClick && 'em-chip--clickable', selected && 'em-chip--selected', disabled && 'em-chip--disabled')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
    >
      {children}
      {onClose && (
        <button className="em-chip__close" aria-label="Remove" onClick={e => { e.stopPropagation(); onClose() }}>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      )}
    </span>
  )
}

/* ---------------- StatusTag ---------------- */
export type EmeraldTagTone = 'good' | 'warn' | 'serious' | 'critical' | 'info' | 'neutral'
export function EmeraldTag({ tone, children, dot = true }: { tone: EmeraldTagTone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cx('em-tag', `em-tag--${tone}`)}>
      {dot && <span className="em-tag__dot" aria-hidden />}
      {children}
    </span>
  )
}

/* ---------------- TextField ---------------- */
interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  hint?: string
  error?: boolean
  block?: boolean
}
export const EmeraldTextField = forwardRef<HTMLInputElement, TextFieldProps>(function EmeraldTextField(
  { label, hint, error, block, className, id, value, defaultValue, placeholder, ...rest }, ref,
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const floated = Boolean(value ?? defaultValue) || Boolean(placeholder)
  return (
    <div className={cx('em-field', block && 'em-field--block', error && 'em-field--error', floated && 'em-field--floated', className)}>
      <input
        ref={ref} id={fieldId} className="em-field__control"
        value={value} defaultValue={defaultValue} placeholder={label ? placeholder : placeholder}
        aria-invalid={error || undefined}
        {...rest}
      />
      {label && <label className="em-field__label" htmlFor={fieldId}>{label}</label>}
      {hint && <div className="em-field__hint">{hint}</div>}
    </div>
  )
})

/* ---------------- Select ---------------- */
interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  hint?: string
  error?: boolean
  block?: boolean
}
export const EmeraldSelect = forwardRef<HTMLSelectElement, SelectProps>(function EmeraldSelect(
  { label, hint, error, block, className, id, children, ...rest }, ref,
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className={cx('em-field', block && 'em-field--block', error && 'em-field--error', 'em-field--floated', className)}>
      <select ref={ref} id={fieldId} className="em-field__control" {...rest}>
        {children}
      </select>
      {label && <label className="em-field__label" htmlFor={fieldId}>{label}</label>}
      <span className="em-field__chevron" aria-hidden>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
      </span>
      {hint && <div className="em-field__hint">{hint}</div>}
    </div>
  )
})

/* ---------------- Textarea ---------------- */
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: boolean
  block?: boolean
}
export const EmeraldTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function EmeraldTextarea(
  { label, hint, error, block, className, id, value, defaultValue, ...rest }, ref,
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const floated = Boolean(value ?? defaultValue)
  return (
    <div className={cx('em-field', 'em-field--textarea', block && 'em-field--block', error && 'em-field--error', floated && 'em-field--floated', className)}>
      <textarea ref={ref} id={fieldId} className="em-field__control" value={value} defaultValue={defaultValue} {...rest} />
      {label && <label className="em-field__label" htmlFor={fieldId}>{label}</label>}
      {hint && <div className="em-field__hint">{hint}</div>}
    </div>
  )
})

/* ---------------- Checkbox ---------------- */
interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode
}
export function EmeraldCheckbox({ label, disabled, className, ...rest }: CheckboxProps) {
  return (
    <label className={cx('em-checkbox', disabled && 'em-checkbox--disabled', className)}>
      <input type="checkbox" disabled={disabled} {...rest} />
      <span className="em-checkbox__box" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 6" /></svg>
      </span>
      {label && <span>{label}</span>}
    </label>
  )
}

/* ---------------- Tabs (underline) ---------------- */
export function EmeraldTabs<T extends string>({ tabs, value, onChange, className }: {
  tabs: readonly { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cx('em-tabs', className)} role="tablist">
      {tabs.map(t => (
        <button
          key={t.value}
          role="tab"
          aria-selected={t.value === value}
          className={cx('em-tab', t.value === value && 'em-tab--active')}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------- SegmentedControl (button-group) ---------------- */
export function EmeraldSegmented<T extends string>({ options, value, onChange }: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="em-seg" role="tablist">
      {options.map(o => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className={cx('em-seg__btn', o.value === value && 'em-seg__btn--on')}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------- Tooltip ---------------- */
export function EmeraldTooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <span className="em-tooltip" tabIndex={0}>
      {children}
      <span className="em-tooltip__bubble" role="tooltip">{content}</span>
    </span>
  )
}

/* ---------------- Avatar ---------------- */
export function EmeraldAvatar({ initials, src, size = 'md', alt }: {
  initials?: string
  src?: string
  size?: EmeraldSize
  alt?: string
}) {
  return (
    <span className={cx('em-avatar', `em-avatar--${size}`)} aria-label={alt}>
      {src ? <img src={src} alt={alt ?? ''} /> : initials}
    </span>
  )
}

/* ---------------- Notification badge ---------------- */
export function EmeraldBadge({ count, dot, max = 99, children }: {
  count?: number
  dot?: boolean
  max?: number
  children: ReactNode
}) {
  const show = dot || (count != null && count > 0)
  return (
    <span className="em-badge-wrap">
      {children}
      {show && (dot
        ? <span className="em-badge-dot" aria-hidden />
        : <span className="em-badge-count">{count! > max ? `${max}+` : count}</span>)}
    </span>
  )
}

/* ---------------- Accordion ---------------- */
export function EmeraldAccordion({ items, allowMultiple, className }: {
  items: { id: string; title: ReactNode; content: ReactNode; defaultOpen?: boolean }[]
  allowMultiple?: boolean
  className?: string
}) {
  const [open, setOpen] = useState<string[]>(() => items.filter(i => i.defaultOpen).map(i => i.id))
  const toggle = (id: string) =>
    setOpen(prev => prev.includes(id)
      ? prev.filter(x => x !== id)
      : allowMultiple ? [...prev, id] : [id])
  return (
    <div className={cx('em-accordion', className)}>
      {items.map(item => {
        const isOpen = open.includes(item.id)
        return (
          <div key={item.id} className={cx('em-accordion__item', isOpen && 'em-accordion__item--open')}>
            <button className="em-accordion__header" aria-expanded={isOpen} onClick={() => toggle(item.id)}>
              {item.title}
              <svg className="em-accordion__chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
            </button>
            {isOpen && <div className="em-accordion__panel">{item.content}</div>}
          </div>
        )
      })}
    </div>
  )
}

/* ---------------- Inline notification ---------------- */
export type EmeraldNoteStatus = 'info' | 'success' | 'warning' | 'error'
const NOTE_ICON: Record<EmeraldNoteStatus, ReactNode> = {
  info: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.5" /></svg>,
  success: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-5" /></svg>,
  warning: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3L2 20h20L12 3z" /><path d="M12 10v4M12 17.5v.5" /></svg>,
  error: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></svg>,
}
export function EmeraldNotification({ status = 'info', title, children, actionLabel, onAction, onClose }: {
  status?: EmeraldNoteStatus
  title?: ReactNode
  children?: ReactNode
  actionLabel?: string
  onAction?: () => void
  onClose?: () => void
}) {
  return (
    <div className={cx('em-note', `em-note--${status}`)} role="status">
      <span className="em-note__icon" aria-hidden>{NOTE_ICON[status]}</span>
      <div className="em-note__body">
        {title && <div className="em-note__title">{title}</div>}
        {children && <div className="em-note__msg">{children}</div>}
      </div>
      {actionLabel && <button className="em-note__action" onClick={onAction}>{actionLabel}</button>}
      {onClose && (
        <button className="em-note__close" aria-label="Dismiss" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      )}
    </div>
  )
}

/* ---------------- Radio / RadioGroup ---------------- */
export function EmeraldRadio({ label, disabled, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: ReactNode }) {
  return (
    <label className={cx('em-radio', disabled && 'em-radio--disabled', className)}>
      <input type="radio" disabled={disabled} {...rest} />
      <span className="em-radio__dot" aria-hidden />
      {label && <span>{label}</span>}
    </label>
  )
}
export function EmeraldRadioGroup<T extends string>({ name, value, options, onChange, row }: {
  name: string
  value: T
  options: readonly { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  row?: boolean
}) {
  return (
    <div className={cx('em-radiogroup', row && 'em-radiogroup--row')} role="radiogroup">
      {options.map(o => (
        <EmeraldRadio key={o.value} name={name} label={o.label}
          checked={o.value === value} onChange={() => onChange(o.value)} />
      ))}
    </div>
  )
}

/* ---------------- Switch ---------------- */
export function EmeraldSwitch({ label, disabled, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: ReactNode }) {
  return (
    <label className={cx('em-switch', disabled && 'em-switch--disabled', className)}>
      <input type="checkbox" role="switch" disabled={disabled} {...rest} />
      <span className="em-switch__track" aria-hidden />
      {label && <span>{label}</span>}
    </label>
  )
}

/* ---------------- Progress bar ---------------- */
export function EmeraldProgress({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={cx('em-progress', className)} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className="em-progress__fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ---------------- Spinner ---------------- */
export function EmeraldSpinner({ size = 'md', className }: { size?: EmeraldSize; className?: string }) {
  return <span className={cx('em-spinner', `em-spinner--${size}`, className)} role="status" aria-label="Loading" />
}

/* ---------------- Breadcrumb ---------------- */
export function EmeraldBreadcrumb({ items }: { items: { label: ReactNode; href?: string; onClick?: () => void }[] }) {
  return (
    <nav className="em-breadcrumb" aria-label="Breadcrumb">
      {items.map((it, i) => {
        const last = i === items.length - 1
        return (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {last
              ? <span className="em-breadcrumb__current" aria-current="page">{it.label}</span>
              : it.href
                ? <a href={it.href}>{it.label}</a>
                : <span role="button" tabIndex={0} onClick={it.onClick} style={{ cursor: it.onClick ? 'pointer' : undefined }}>{it.label}</span>}
            {!last && <span className="em-breadcrumb__sep" aria-hidden>/</span>}
          </span>
        )
      })}
    </nav>
  )
}

/* ---------------- Divider ---------------- */
export function EmeraldDivider({ vertical, className }: { vertical?: boolean; className?: string }) {
  return vertical
    ? <div className={cx('em-divider em-divider--vertical', className)} role="separator" aria-orientation="vertical" />
    : <hr className={cx('em-divider', className)} />
}

/* ---------------- Empty state ---------------- */
export function EmeraldEmptyState({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="em-empty">
      {icon && <div className="em-empty__icon">{icon}</div>}
      <div className="em-empty__title">{title}</div>
      {children && <div className="em-empty__msg">{children}</div>}
    </div>
  )
}

/* ---------------- Card ---------------- */
export function EmeraldCard({ title, action, children, className = '' }: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cx('em-card', className)}>
      {title != null && (
        <div className="em-card__title">
          <span>{title}</span>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
