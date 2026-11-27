/** Runs one auth request and turns its failure into something to show. */
import { useCallback, useState } from 'react';

import { fieldErrors, isOffline } from '@/lib/http/errors';

export interface AuthActionState {
  submitting: boolean;
  formError: string | null;
  fieldMessages: Record<string, string>;
}

export interface UseAuthAction<TArgs extends unknown[], TResult> extends AuthActionState {
  run: (...args: TArgs) => Promise<TResult | null>;
  reset: () => void;
}

export function useAuthAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
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
