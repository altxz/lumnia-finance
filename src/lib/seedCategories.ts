import { supabase } from '@/lib/supabase';

interface CategorySeed {
  name: string;
  icon: string;
  color: string;
  keywords: string[];
  children?: Omit<CategorySeed, 'children'>[];
}

const DEFAULT_CATEGORIES: CategorySeed[] = [
  {
    name: 'Moradia', icon: 'house', color: '#14B8A6', keywords: ['moradia', 'casa', 'apartamento'],
    children: [
      { name: 'Aluguel', icon: 'key-round', color: '#14B8A6', keywords: ['aluguel', 'renda', 'arrendamento'] },
      { name: 'Condomínio', icon: 'building-2', color: '#0D9488', keywords: ['condomínio', 'condominio', 'taxa condominial'] },
      { name: 'Energia', icon: 'zap', color: '#F59E0B', keywords: ['energia', 'luz', 'eletricidade', 'conta de luz'] },
      { name: 'Água', icon: 'droplets', color: '#06B6D4', keywords: ['água', 'agua', 'saneamento', 'conta de água'] },
      { name: 'Internet', icon: 'wifi', color: '#6366F1', keywords: ['internet', 'wifi', 'fibra', 'banda larga'] },
      { name: 'Manutenção', icon: 'wrench', color: '#78716C', keywords: ['manutenção', 'reparo', 'conserto', 'reforma'] },
    ],
  },
  {
    name: 'Alimentação', icon: 'utensils', color: '#F97316', keywords: ['alimentação', 'comida', 'alimentacao'],
    children: [
      { name: 'Supermercado', icon: 'shopping-cart', color: '#F97316', keywords: ['supermercado', 'mercado', 'mercearia', 'hortifruti'] },
      { name: 'Restaurante', icon: 'chef-hat', color: '#EA580C', keywords: ['restaurante', 'almoço', 'jantar', 'refeição'] },
      { name: 'Delivery', icon: 'bike', color: '#DC2626', keywords: ['delivery', 'ifood', 'rappi', 'uber eats', 'entrega'] },
      { name: 'Padaria', icon: 'croissant', color: '#D97706', keywords: ['padaria', 'pão', 'pao', 'confeitaria'] },
      { name: 'Café', icon: 'coffee', color: '#92400E', keywords: ['café', 'cafe', 'cafeteria', 'starbucks'] },
    ],
  },
  {
    name: 'Transporte', icon: 'car', color: '#4B6DFB', keywords: ['transporte', 'locomoção', 'mobilidade'],
    children: [
      { name: 'Combustível', icon: 'fuel', color: '#4B6DFB', keywords: ['combustível', 'gasolina', 'etanol', 'diesel', 'posto'] },
      { name: 'Uber/Táxi', icon: 'car-taxi-front', color: '#1D4ED8', keywords: ['uber', 'táxi', 'taxi', '99', 'corrida'] },
      { name: 'Manutenção Auto', icon: 'wrench', color: '#3B82F6', keywords: ['oficina', 'mecânico', 'revisão', 'borracharia'] },
      { name: 'Seguros', icon: 'shield-check', color: '#2563EB', keywords: ['seguro auto', 'seguro carro', 'dpvat', 'ipva'] },
      { name: 'Transporte Público', icon: 'bus', color: '#60A5FA', keywords: ['ônibus', 'metro', 'metrô', 'bilhete', 'passagem'] },
    ],
  },
  {
    name: 'Saúde', icon: 'heart-pulse', color: '#EF4444', keywords: ['saúde', 'saude', 'médico', 'hospital'],
    children: [
      { name: 'Plano de Saúde', icon: 'heart-handshake', color: '#EF4444', keywords: ['plano de saúde', 'convênio', 'unimed', 'amil'] },
      { name: 'Farmácia', icon: 'pill', color: '#DC2626', keywords: ['farmácia', 'remédio', 'medicamento', 'drogaria'] },
      { name: 'Consultas', icon: 'stethoscope', color: '#F87171', keywords: ['consulta', 'médico', 'dentista', 'exame'] },
      { name: 'Terapia', icon: 'brain', color: '#FB923C', keywords: ['terapia', 'psicólogo', 'psicologia', 'terapeuta'] },
    ],
  },
  {
    name: 'Lazer & Estilo de Vida', icon: 'gamepad-2', color: '#DA90FC', keywords: ['lazer', 'entretenimento', 'diversão'],
    children: [
      { name: 'Assinaturas (Streaming)', icon: 'tv', color: '#DA90FC', keywords: ['netflix', 'spotify', 'disney', 'hbo', 'streaming', 'assinatura'] },
      { name: 'Cinema/Teatro', icon: 'clapperboard', color: '#C084FC', keywords: ['cinema', 'teatro', 'filme', 'espetáculo'] },
      { name: 'Bares/Festas', icon: 'wine', color: '#A855F7', keywords: ['bar', 'festa', 'happy hour', 'balada', 'drinks'] },
      { name: 'Viagens', icon: 'plane', color: '#8B5CF6', keywords: ['viagem', 'hotel', 'passagem aérea', 'turismo', 'hospedagem'] },
      { name: 'Roupas/Calçados', icon: 'shirt', color: '#EC4899', keywords: ['roupa', 'calçado', 'vestuário', 'shopping', 'moda'] },
    ],
  },
  { name: 'Educação', icon: 'graduation-cap', color: '#F59E0B', keywords: ['educação', 'estudo', 'curso', 'escola'], children: [] },
  {
    name: 'Receitas', icon: 'wallet', color: '#22C55E', keywords: ['receita', 'renda', 'ganho', 'entrada'],
    children: [
      { name: 'Salário', icon: 'banknote', color: '#22C55E', keywords: ['salário', 'salario', 'pagamento', 'holerite'] },
      { name: 'Freelance', icon: 'laptop', color: '#16A34A', keywords: ['freelance', 'freela', 'serviço extra', 'bico'] },
      { name: 'Rendimentos de Investimentos', icon: 'trending-up', color: '#15803D', keywords: ['rendimento', 'dividendo', 'investimento', 'juros'] },
      { name: 'Cashback', icon: 'rotate-ccw', color: '#4ADE80', keywords: ['cashback', 'reembolso', 'estorno'] },
    ],
  },
  {
    name: 'Despesas Financeiras', icon: 'landmark', color: '#78716C', keywords: ['despesa financeira', 'juros', 'financeiro'],
    children: [
      { name: 'Empréstimo', icon: 'hand-coins', color: '#78716C', keywords: ['empréstimo', 'financiamento', 'prestação', 'parcela'] },
    ],
  },
  { name: 'Outros', icon: 'tag', color: '#8B5CF6', keywords: ['outros', 'diverso', 'geral'], children: [] },
];

export async function seedDefaultCategories(userId: string) {
  const { count } = await supabase
    .from('categories')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (count && count > 0) return;

  // Batch insert: first all parents, then all children
  let sortOrder = 0;
  const parentRows = DEFAULT_CATEGORIES.map(cat => ({
    user_id: userId,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    keywords: cat.keywords,
    sort_order: sortOrder++,
    parent_id: null as string | null,
  }));

  const { data: parents, error } = await supabase
    .from('categories')
    .insert(parentRows)
    .select('id, name');

  if (error || !parents) return;

  // Map parent name → id
  const parentMap = new Map(parents.map(p => [p.name, p.id]));

  const childRows: typeof parentRows = [];
  DEFAULT_CATEGORIES.forEach(cat => {
    const parentId = parentMap.get(cat.name);
    if (!parentId || !cat.children?.length) return;
    cat.children.forEach(child => {
      childRows.push({
        user_id: userId,
        name: child.name,
        icon: child.icon,
        color: child.color,
        keywords: child.keywords,
        sort_order: sortOrder++,
        parent_id: parentId,
      });
    });
  });

  if (childRows.length > 0) {
    await supabase.from('categories').insert(childRows);
  }
}
