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
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children({ id, describedBy })}
      {message && (
        <p
          id={`${id}-msg`}
          className={`mt-1.5 text-xs ${error ? 'font-medium text-rose-600' : 'text-slate-400'}`}
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
      className={`input cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.6rem_center] bg-no-repeat pr-9 ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
      }}
      {...rest}
    />
  );
}
