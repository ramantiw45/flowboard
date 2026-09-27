import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Loader from './Loader';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost' | 'glass' | 'inverse';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  'danger-ghost': 'btn-danger-ghost',
  glass: 'btn-glass',
  /** Primary action sitting on the brand gradient, where brand-600 would vanish. */
  inverse: 'btn-inverse',
};

const SIZES: Record<Size, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Renders a spinner and disables the button. */
  loading?: boolean;
  /** Leading icon element, e.g. <Plus className="h-4 w-4" /> */
  icon?: ReactNode;
}

/**
 * Single source of truth for every clickable action in the app.
 * Variant/size tokens live in index.css so styles stay consistent.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, icon, className = '', children, disabled, type, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      className={`btn ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <Loader className="h-4 w-4" /> : icon}
      {children}
    </button>
  );
});

export default Button;
