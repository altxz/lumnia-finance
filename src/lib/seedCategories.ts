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
      { name: 'Financiamento', icon: 'badge-dollar-sign', color: '#14B8A6', keywords: ['Caixa', 'habitação'] },
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
      { name: 'Combustível', icon: 'fuel', color: '#8B5CF6', keywords: ['Posto', 'Shell', 'Petrobrás', 'Ipiranga'] },
      { name: 'Estacionamento', icon: 'car', color: '#8B5CF6', keywords: ['Estacionamento', 'Estapar'] },
      { name: 'Uber', icon: 'car', color: '#5447BC', keywords: ['Uber'] },
      { name: 'Transporte Público', icon: 'bus', color: '#5447BC', keywords: ['ônibus', 'metro', 'metrô', 'bilhete', 'passagem'] },
    ],
  },
  {
    name: 'Saúde e Bem-Estar', icon: 'heart-pulse', color: '#DA90FC', keywords: ['saúde', 'saude', 'médico', 'hospital'],
    children: [
      { name: 'Farmácia', icon: 'pill', color: '#DA90FC', keywords: ['Farmácia', 'Drogasil', 'Drogaria'] },
      { name: 'Academia', icon: 'dumbbell', color: '#DA90FC', keywords: ['Academia', 'SmartFit'] },
    ],
  },
  {
    name: 'Lazer e Entretenimento', icon: 'sofa', color: '#F59E0B', keywords: ['lazer', 'entretenimento', 'diversão'],
    children: [
      { name: 'Viagens', icon: 'plane', color: '#F59E0B', keywords: ['Gol', 'Azul', 'Linhas Aéreas'] },
      { name: 'Cinema', icon: 'film', color: '#F59E0B', keywords: ['Cinema', 'Cinemark', 'Cinépolis'] },
      { name: 'Bares', icon: 'wine', color: '#F59E0B', keywords: ['Bar'] },
    ],
  },
  {
    name: 'Cuidados Pessoais', icon: 'scissors', color: '#4B6DFB', keywords: ['cuidados pessoais', 'beleza'],
    children: [
      { name: 'Barbearia', icon: 'scissors', color: '#4B6DFB', keywords: ['Barbearia'] },
      { name: 'Perfumaria', icon: 'sparkles', color: '#4B6DFB', keywords: ['Perfumaria'] },
    ],
  },
  {
    name: 'Educação', icon: 'graduation-cap', color: '#06B6D4', keywords: ['educação', 'estudo', 'curso', 'escola'],
    children: [
      { name: 'Cursos', icon: 'notebook-pen', color: '#06B6D4', keywords: ['Curso'] },
      { name: 'Mensalidade Escolar', icon: 'receipt', color: '#06B6D4', keywords: [] },
    ],
  },
  {
    name: 'Financeiro', icon: 'circle-dollar-sign', color: '#EF4444', keywords: ['despesa financeira', 'juros', 'financeiro'],
    children: [
      { name: 'Investimentos', icon: 'trending-up', color: '#BEEE62', keywords: ['Invest'] },
      { name: 'Juros/Multas', icon: 'percent', color: '#EF4444', keywords: ['Juros', 'Renegociação', 'Despesa'] },
      { name: 'Empréstimos', icon: 'hand-coins', color: '#EF4444', keywords: ['Empréstimo'] },
      { name: 'Transferências', icon: 'arrow-up-down', color: '#EF4444', keywords: [] },
    ],
  },
  {
    name: 'Receitas', icon: 'trending-up', color: '#84CC16', keywords: ['receita', 'renda', 'ganho', 'entrada'],
    children: [
      { name: 'Salário', icon: 'circle-dollar-sign', color: '#84CC16', keywords: ['salário', 'salario', 'pagamento', 'holerite'] },
      { name: 'Freelance', icon: 'briefcase', color: '#84CC16', keywords: ['freelance', 'freela', 'serviço extra'] },
      { name: 'Rendimentos', icon: 'chart-line', color: '#84CC16', keywords: ['rendimento', 'dividendo', 'investimento'] },
      { name: 'Reembolsos', icon: 'arrow-up-down', color: '#84CC16', keywords: ['Reembolso'] },
      { name: 'Transferências', icon: 'arrow-up-down', color: '#84CC16', keywords: ['Transferência'] },
    ],
  },
  {
    name: 'Compras', icon: 'shopping-bag', color: '#8B5CF6', keywords: ['compras', 'shopping'],
    children: [
      { name: 'Eletrônicos', icon: 'laptop', color: '#8B5CF6', keywords: ['Fast Shop', 'Magalu'] },
      { name: 'Vestuário e Acessórios', icon: 'shirt', color: '#5447BC', keywords: ['Roupa', 'Zara', 'Riachuelo', 'C&A', 'Renner', 'Adidas', 'Nike', 'New Balance'] },
      { name: 'Casa e Decoração', icon: 'house', color: '#8B5CF6', keywords: ['Tok & Stok', 'Mobly', 'Camicado'] },
      { name: 'Eletrodomésticos', icon: 'tv', color: '#8B5CF6', keywords: ['Fast Shop'] },
      { name: 'Pet Shop', icon: 'dog', color: '#8B5CF6', keywords: ['Pet', 'Petlove', 'Petz'] },
      { name: 'Presentes', icon: 'gift', color: '#8B5CF6', keywords: [] },
      { name: 'Assinaturas', icon: 'gem', color: '#8B5CF6', keywords: ['Netflix', 'YouTube', 'Spotify', 'Microsoft', 'Game Pass'] },
      { name: 'Jogos', icon: 'gamepad-2', color: '#8B5CF6', keywords: ['Xbox'] },
      { name: 'Ferramentas', icon: 'wrench', color: '#8B5CF6', keywords: [] },
    ],
  },
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
