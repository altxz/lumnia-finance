import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, X, Send, Loader2, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_SUGGESTIONS = [
  { label: '📊 Top gastos', message: 'Quais são meus maiores gastos este mês?' },
  { label: '💡 Oportunidades de economia', message: 'Onde posso economizar este mês?' },
  { label: '📈 Projeção do mês', message: 'Como vou fechar o mês?' },
  { label: '💳 Faturas dos cartões', message: 'Qual o valor das minhas faturas de cartão de crédito?' },
  { label: '🔄 Comparar com mês anterior', message: 'Compare meus gastos com o mês anterior' },
];

export function GeniusChatbot() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Olá! 👋 Sou a **Lumnia**, sua assistente financeira inteligente.\n\nPosso ajudá-lo a:\n- 📊 Resumo e projeção do mês\n- 💳 Faturas de cartão de crédito\n- 📝 Registar/excluir despesas e receitas\n- 🏷️ Gastos por categoria e ranking\n- 📋 Contas pendentes e receitas a receber\n- 🎯 Orçamentos por categoria\n- 🏦 Saldos das carteiras\n- 📈 Comparar meses e evolução\n- 🔍 Buscar transações por nome\n- 💰 Dívidas e patrimônio líquido\n- 📉 Média diária e taxa de poupança\n- 🔄 Transações recorrentes/fixas\n\nExperimente: *"Como vou fechar o mês?"*',
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
    if (!text || isTyping || !user) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // Build history from recent messages (skip welcome)
      const history = messages
        .filter(m => m.id !== 'welcome')
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke('chat-genius', {
        body: { message: text, user_id: user.id, history },
      });

      if (error) throw error;

      const reply = data?.reply || 'Desculpe, não consegui processar o seu pedido.';

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '⚠️ Ocorreu um erro ao processar sua mensagem. Tente novamente.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderContent = (content: string, isUser: boolean) => {
    if (isUser) {
      return <span>{content}</span>;
    }
    return (
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
          em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="text-base font-bold text-primary mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold text-primary mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-primary mb-1">{children}</h3>,
          hr: () => <hr className="my-2 border-border/50" />,
          code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-primary">{children}</code>,
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-20 left-4 sm:left-6 z-50 w-[calc(100vw-2rem)] sm:w-96 h-[500px] max-h-[70vh] rounded-2xl border bg-card shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-primary text-primary-foreground">
            <div className="w-9 h-9 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
              <Brain className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm">Lumnia AI</h3>
              <p className="text-[11px] opacity-80">Assistente financeira inteligente</p>
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

          {/* Quick suggestions */}
          {messages.length <= 1 && !isTyping && (
            <div className="border-t px-3 pt-2 pb-1">
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {QUICK_SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(s.message)}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/50 text-secondary-foreground hover:bg-secondary transition-colors whitespace-nowrap"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

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
          'fixed bottom-6 left-4 sm:left-6 z-50 rounded-2xl shadow-xl transition-all duration-300',
          'h-11 w-11 md:h-14 md:w-14',
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
