import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rowanAccountMutate, type RowanAccountCommand } from "@/lib/rowan-fns";

export function useAccountMutation(sessionId: string, onSaved?: () => void) {
  const cache = useQueryClient();
  const pending = useRef<RowanAccountCommand | null>(null);
  const [message, setMessage] = useState("");
  const mutation = useMutation({
    mutationFn: (command: RowanAccountCommand) =>
      rowanAccountMutate({ data: { sessionId, command } }),
    onSuccess: async (result) => {
      pending.current = null;
      setMessage(result.ok ? "Saved." : result.message);
      await cache.invalidateQueries({ queryKey: ["rowan", sessionId] });
      if (result.ok) onSaved?.();
    },
    onError: () =>
      setMessage(
        "The result could not be confirmed. Retry this request before making another change.",
      ),
  });
  return {
    message,
    busy: mutation.isPending || !!pending.current,
    uncertain: mutation.isError && !!pending.current,
    retry: () => {
      if (pending.current && !mutation.isPending) mutation.mutate(pending.current);
    },
    run: (command: RowanAccountCommand) => {
      if (pending.current) return;
      pending.current = command;
      setMessage("");
      mutation.mutate(command);
    },
  };
}
