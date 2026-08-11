import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface DescriptionSuggestion {
  description: string;
  value: number;
  final_category: string;
  type: string;
  payment_method: string | null;
  credit_card_id: string | null;
  wallet_id: string | null;
  project_id: string | null;
  notes: string | null;
  tags: string[] | null;
  date: string;
  count: number;
}

/**
 * Busca transações anteriores com descrição parecida para autocompletar o lançamento.
 */
export function useDescriptionSuggestions(term: string, type: 'income' | 'expense' | 'transfer') {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<DescriptionSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = term.trim();
    if (!user || type === 'transfer' || query.length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const escaped = query.replace(/[%_,]/g, '');
      const { data } = await supabase
        .from('expenses')
        .select('description, value, final_category, type, payment_method, credit_card_id, wallet_id, project_id, notes, tags, date')
        .eq('user_id', user.id)
        .eq('type', type)
        .ilike('description', `%${escaped}%`)
        .order('date', { ascending: false })
        .limit(60);

      if (cancelled) return;

      const map = new Map<string, DescriptionSuggestion>();
      for (const row of data || []) {
        const key = (row.description || '').trim().toLowerCase();
        if (!key) continue;
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(key, { ...(row as any), count: 1 });
        }
      }

      setSuggestions(Array.from(map.values()).slice(0, 6));
      setLoading(false);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, type, user]);

  return { suggestions, loading };
}
