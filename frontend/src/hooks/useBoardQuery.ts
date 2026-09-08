import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { BoardEntry, BoardStatus } from '@/types/job';

const BOARD_KEY = ['board'];

export function useBoardQuery(enabled: boolean) {
  return useQuery({
    queryKey: BOARD_KEY,
    queryFn: async () => (await api.getBoard()).jobs,
    enabled,
    staleTime: 30_000,
  });
}

export function useUpsertBoardEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: { url: string; status: BoardStatus; notes?: string; title?: string; company?: string }) =>
      api.upsertBoardEntry(entry),
    onMutate: async (entry) => {
      await qc.cancelQueries({ queryKey: BOARD_KEY });
      const previous = qc.getQueryData<Record<string, BoardEntry>>(BOARD_KEY);
      qc.setQueryData<Record<string, BoardEntry>>(BOARD_KEY, (old) => ({
        ...old,
        [entry.url]: {
          ...(old?.[entry.url] ?? { updated_at: '' }),
          status: entry.status,
          notes: entry.notes ?? old?.[entry.url]?.notes ?? '',
          title: entry.title ?? old?.[entry.url]?.title,
          company: entry.company ?? old?.[entry.url]?.company,
          url: entry.url,
        },
      }));
      return { previous };
    },
    onError: (_err, _entry, context) => {
      if (context?.previous) qc.setQueryData(BOARD_KEY, context.previous);
    },
    onSuccess: (res) => qc.setQueryData(BOARD_KEY, res.jobs),
  });
}

export function useDeleteBoardEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => api.deleteBoardEntry(url),
    onMutate: async (url) => {
      await qc.cancelQueries({ queryKey: BOARD_KEY });
      const previous = qc.getQueryData<Record<string, BoardEntry>>(BOARD_KEY);
      qc.setQueryData<Record<string, BoardEntry>>(BOARD_KEY, (old) => {
        const next = { ...old };
        delete next[url];
        return next;
      });
      return { previous };
    },
    onError: (_err, _url, context) => {
      if (context?.previous) qc.setQueryData(BOARD_KEY, context.previous);
    },
    onSuccess: (res) => qc.setQueryData(BOARD_KEY, res.jobs),
  });
}
