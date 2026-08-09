import { useCallback, useState } from 'react';

import { fieldErrors, isOffline } from '@/lib/http/errors';

/**
 * Runs a one-shot auth request and turns its failure into renderable state.
 *
 * Exists because Register and VerifyAccount were each hand-rolling the same
 * three pieces — a submitting flag, a form-level message, and per-field
 * server errors — around a single call. Two copies is a coincidence; a third
 * would be a pattern nobody extracted.
 *
 * It is also the layer 1C's rule is asking for: a page must not call a domain
 * service directly, because then data-fetching policy (what a 409 means here,
 * whether to retry, how an offline failure reads) lives wherever someone
 * happened to write the form, and cannot be tested without rendering it.
 */
export interface AuthActionState {
  submitting: boolean;
  /** A message about the request as a whole. */
  formError: string | null;
  /** Per-field messages from B2's validation handler, keyed by field name. */
  fieldMessages: Record<string, string>;
}

export interface UseAuthAction<TArgs extends unknown[], TResult> extends AuthActionState {
  /** Resolves with the result, or null when the request failed. */
  run: (...args: TArgs) => Promise<TResult | null>;
  reset: () => void;
}

export function useAuthAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  /**
   * Message for a failure that is not offline and carries no field errors.
   * Passed in because only the caller knows what the request was FOR — "that
   * username is already taken" and "that code has expired" are the same shape
   * of failure and completely different sentences.
   */
  fallbackMessage: string,
): UseAuthAction<TArgs, TResult> {
  const [state, setState] = useState<AuthActionState>({
    submitting: false,
    formError: null,
    fieldMessages: {},
  });

  const reset = useCallback(() => {
    setState({ submitting: false, formError: null, fieldMessages: {} });
  }, []);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setState({ submitting: true, formError: null, fieldMessages: {} });

      try {
        const result = await action(...args);
        setState({ submitting: false, formError: null, fieldMessages: {} });
        return result;
      } catch (error) {
        const fields = fieldErrors(error);

        setState({
          submitting: false,
          /*
           * Field errors take precedence: when the server names the problem
           * per field, repeating a vague form-level message above them is
           * noise. Offline is distinguished because it is the one failure the
           * user can act on directly.
           */
          formError: fields
            ? null
            : isOffline(error)
              ? 'Cannot reach Notare. Check your connection and try again.'
              : fallbackMessage,
          fieldMessages: fields ?? {},
        });
        return null;
      }
    },
    [action, fallbackMessage],
  );

  return { ...state, run, reset };
}
