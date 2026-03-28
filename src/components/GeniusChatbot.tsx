import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, X, Send, Loader2, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function simulateAiResponse(text: string): string {
  const lower = text.toLowerCase();
  const numberMatch = lower.match(/(\d+[.,]?\d*)/);
  const amount = numberMatch ? numberMatch[1].replace(',', '.') : null;

  if ((lower.includes('gasto') || lower.includes('despesa') || lower.includes('gastei') || lower.includes('paguei') || lower.includes('comprei')) && amount) {
    return `✅ Entendido! Despesa de **R$ ${parseFloat(amount).toFixed(2)}** registada. Deseja adicionar mais detalhes como categoria ou conta?`;
  }
  if ((lower.includes('recebi') || lower.includes('receita') || lower.includes('salário') || lower.includes('renda')) && amount) {
    return `✅ Receita de **R$ ${parseFloat(amount).toFixed(2)}** anotada! Quer vincular a alguma conta específica?`;
  }
  if (lower.includes('saldo') || lower.includes('quanto tenho') || lower.includes('patrimônio')) {
    return `Para ver o seu saldo atual, acesse o **Dashboard** ou a página **Minha Carteira**. Posso ajudá-lo com mais alguma coisa?`;
  }
  if (lower.includes('orçamento') || lower.includes('budget') || lower.includes('meta')) {
    return `Você pode configurar metas de orçamento na página de **Orçamento**. Quer que eu explique como funciona o planeamento base-zero?`;
  }
  if (lower.includes('categoria')) {
    return `Você pode gerenciar suas categorias em **Configurações → Categorias**. Temos categorias com subcategorias e palavras-chave para a IA categorizar automaticamente!`;
  }
  if (lower.includes('ajuda') || lower.includes('help') || lower.includes('o que') || lower.includes('como')) {
    return `Sou o **Genius**, seu assistente financeiro! 🧠\n\nPosso ajudá-lo a:\n- 📝 Registar despesas e receitas\n- 📊 Consultar saldos e orçamentos\n- 🏷️ Gerenciar categorias\n- 💡 Dar dicas financeiras\n\nExperimente: *"Gastei 50 reais no supermercado"*`;
  }
  if (lower.includes('olá') || lower.includes('oi') || lower.includes('hey') || lower.includes('bom dia') || lower.includes('boa tarde')) {
    return `Olá! 👋 Sou o **Genius**, seu assistente financeiro inteligente. Como posso ajudá-lo hoje?`;
  }
  return `Entendi sua mensagem! 🤔 No momento estou aprendendo a processar pedidos mais complexos. Tente algo como:\n- *"Gastei 30 no almoço"*\n- *"Qual meu saldo?"*\n- *"Ajuda"*`;
}

export function GeniusChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Olá! 👋 Sou o **Genius**, seu assistente financeiro. Como posso ajudá-lo?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate AI thinking delay
    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));

    const reply = simulateAiResponse(text);
    const aiMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: reply,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Simple markdown-like rendering (bold and italic)
  const renderContent = (content: string) => {
    const parts = content.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\n)/g);
    return parts.map((part, i) => {
      if (part === '\n') return <br key={i} />;
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i} className="italic text-muted-foreground">{part.slice(1, -1)}</em>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-20 left-4 sm:left-6 z-50 w-[calc(100vw-2rem)] sm:w-96 h-[500px] max-h-[70vh] rounded-2xl border bg-card shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-primary text-primary-foreground">
            <div className="w-9 h-9 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
              <Brain className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm">Genius AI</h3>
              <p className="text-[11px] opacity-80">Assistente financeiro inteligente</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={cn(
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-secondary text-secondary-foreground rounded-bl-md'
                  )}
                >
                  {renderContent(msg.content)}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escreva uma mensagem..."
                className="rounded-xl h-10 flex-1"
                disabled={isTyping}
              />
              <Button
                size="icon"
                className="h-10 w-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
              >
                {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FAB Button */}
      <Button
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          'fixed bottom-6 left-4 sm:left-6 z-50 h-14 w-14 rounded-2xl shadow-xl transition-all duration-300',
          isOpen
            ? 'bg-muted text-muted-foreground hover:bg-muted/80 scale-90'
            : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105'
        )}
        size="icon"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Sparkles className="h-6 w-6" />
        )}
      </Button>
    </>
  );
}
