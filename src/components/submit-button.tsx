"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { type ButtonVariant, buttonClass } from "./button";

export function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * A form's submit button that shows it's working the moment it's pressed and can't be pressed twice.
 * With `confirm`, it asks first and does nothing unless the Admin agrees.
 */
export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  block,
  confirm: confirmText,
  name,
  value,
  className = "",
  disabled,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  block?: boolean;
  confirm?: string;
  name?: string;
  value?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending, data } = useFormStatus();
  // With several submit buttons in one form, only the pressed one shows it's working.
  const pressed = pending && (name === undefined || data?.get(name) === value);

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      aria-busy={pressed}
      className={`${buttonClass(variant, { block })} ${className}`}
      onClick={(event) => {
        if (confirmText && !window.confirm(confirmText)) event.preventDefault();
      }}
    >
      {pressed && <Spinner />}
      {pressed && pendingText ? pendingText : children}
    </button>
  );
}
