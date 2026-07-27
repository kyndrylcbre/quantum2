/* ============================================================
   Emerald component library (recreated). Import as:
     import { EmeraldButton, EmeraldChip, ... } from '../emerald'
   Names mirror the real @emerald-react/* API so a future swap to
   the licensed package is mostly an import change.
   ============================================================ */
import {
  forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes,
  type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'
import './emerald.css'

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
