"use client";
import { startTransition, useActionState, useEffect, useRef } from "react";

type State = { error?: string; ok?: string } | undefined;

/**
 * Wraps useActionState but submits via onSubmit so React does not reset the form
 * fields after the action. Users keep their input when validation fails.
 * Pass resetOnOk to clear the form after a successful submission.
 */
export function useFormAction(fn: (s: State, fd: FormData) => Promise<State>, resetOnOk = false) {
  const [state, dispatch, pending] = useActionState(fn, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnOk && state?.ok) ref.current?.reset();
  }, [state, resetOnOk]);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  return { state, pending, formProps: { ref, onSubmit } };
}
