import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: (props: { id: string; describedBy?: string }) => ReactNode;
}

/** Accessible label + message wrapper shared by every form control. */
export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId();
  const message = error ?? hint;
  const describedBy = message ? `${id}-msg` : undefined;
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-danger-500">*</span>}
      </label>
      {children({ id, describedBy })}
      {message && (
        <p
          id={`${id}-msg`}
          className={`mt-1.5 text-xs ${error ? 'font-medium text-danger-600' : 'text-slate-400'}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

export function TextInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`} {...rest} />;
}

export function TextArea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`input resize-y leading-relaxed ${className}`} {...rest} />;
}

export function SelectInput({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`input select-chevron cursor-pointer appearance-none pr-9 ${className}`}
      {...rest}
    />
  );
}
