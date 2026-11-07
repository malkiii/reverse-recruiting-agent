"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { cx, inputClass } from "./ui";

const DEBOUNCE_MS = 300;

/** Sets a URL param, or removes it when empty, and goes back to page 1. */
function useSetParam(name: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(name, value);
    else params.delete(name);
    params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
}

/** A text filter that updates the URL a moment after typing stops. */
export function FilterInput({ name, label, placeholder }: { name: string; label: string; placeholder?: string }) {
  const value = useSearchParams().get(name) ?? "";
  const setParam = useSetParam(name);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Follows the URL when it changes elsewhere, such as Clear filters, but not under the Admin's typing.
  useEffect(() => {
    if (input.current && document.activeElement !== input.current) input.current.value = value;
  }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <input
      ref={input}
      type="search"
      aria-label={label}
      placeholder={placeholder}
      defaultValue={value}
      onChange={(event) => {
        const next = event.target.value.trim();
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setParam(next), DEBOUNCE_MS);
      }}
      className={cx(inputClass, "sm:w-56")}
    />
  );
}

/** A dropdown filter. The empty option removes the param. */
export function FilterSelect({
  name,
  label,
  emptyLabel,
  options,
}: {
  name: string;
  label: string;
  emptyLabel: string;
  options: string[];
}) {
  const value = useSearchParams().get(name) ?? "";
  const setParam = useSetParam(name);
  // A value no longer offered, such as a cleaned-up Company, still shows as chosen.
  const shown = value && !options.includes(value) ? [value, ...options] : options;

  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => setParam(event.target.value)}
      className={cx(inputClass, "sm:w-56")}
    >
      <option value="">{emptyLabel}</option>
      {shown.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
