import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { lovable } from '@/integrations/lovable/index';

const authSchema = z.object({
  name: z.string(),
  email: z.string().min(1, 'Informe seu e-mail.').email('Digite um e-mail válido.'),
  password: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres.'),
});

type AuthFormData = z.infer<typeof authSchema>;

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get('next');
  const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });

      if (result.error) {
        toast({ title: 'Erro', description: result.error.message, variant: 'destructive' });
        return;
      }

      if (result.redirected) return;

      navigate(safeNext ?? '/');
    } finally {
      setGoogleLoading(false);
    }
  };

  const onSubmit = async ({ email, password, name }: AuthFormData) => {
    if (!isLogin && !name.trim()) {
      setError('name', { message: 'Informe seu nome completo.' }, { shouldFocus: true });
      return;
    }
    setLoading(true);

    const result = isLogin
      ? await signIn(email, password)
      : await signUp(email, password, name);

    if (result.error) {
      toast({
        title: 'Erro',
        description: result.error.message,
        variant: 'destructive',
      });
      setError('password', { message: 'Confira seus dados e tente novamente.' }, { shouldFocus: true });
    } else if (isLogin) {
      navigate(safeNext ?? '/');
    } else {
      toast({
        title: 'Conta criada!',
        description: 'Verifique seu e-mail para confirmar o cadastro.',
      });
    }
    setLoading(false);
  };

  return (
    <main className="gradient-surface relative flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-8">
      <div className="absolute inset-0 bg-background/25 backdrop-blur-[2px]" aria-hidden="true" />
      <Card className="relative w-full max-w-md rounded-3xl shadow-float">
        <CardHeader className="space-y-4 px-5 pb-3 pt-6 text-center sm:px-8 sm:pt-8">
          <>
            <img src="/brand-logo-black.svg" alt="Lumnia" className="mx-auto h-12 w-auto sm:h-14 dark:hidden" />
            <img src="/brand-logo-white.svg" alt="Lumnia" className="mx-auto hidden h-12 w-auto sm:h-14 dark:block" />
          </>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold sm:text-3xl">
              {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              {isLogin
                ? 'Entre para continuar cuidando da sua vida financeira.'
                : 'Comece a organizar suas finanças com inteligência.'}
            </CardDescription>
          </div>
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-secondary/80 px-3 py-1.5 text-xs font-medium text-secondary-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Seus dados permanecem protegidos
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-6 sm:px-8 sm:pb-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {!isLogin && (
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-medium">Nome completo</label>
                <Input id="name" autoComplete="name" placeholder="Seu nome" aria-invalid={Boolean(errors.name)} {...register('name')} />
                {errors.name && <p className="text-xs font-medium text-destructive" role="alert">{errors.name.message}</p>}
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">E-mail</label>
              <Input id="email" type="email" autoComplete="email" placeholder="seu@email.com" aria-invalid={Boolean(errors.email)} {...register('email')} />
              {errors.email && <p className="text-xs font-medium text-destructive" role="alert">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">Senha</label>
              <Input id="password" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder="Mínimo de 6 caracteres" aria-invalid={Boolean(errors.password)} {...register('password')} />
              {errors.password && <p className="text-xs font-medium text-destructive" role="alert">{errors.password.message}</p>}
            </div>
            <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading || googleLoading}>
              {loading ? <><Loader2 className="animate-spin" /> Aguarde...</> : <>{isLogin ? 'Entrar' : 'Criar conta'} <ArrowRight /></>}
            </Button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/60" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card/80 px-3 text-muted-foreground">ou</span></div>
          </div>

          <Button type="button" variant="outline" size="lg" className="w-full" disabled={googleLoading || loading} onClick={handleGoogleSignIn}>
            {googleLoading ? <Loader2 className="animate-spin" /> : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.64v3.02h3.86c2.26-2.09 3.56-5.17 3.56-8.9z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3.02c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.13A11.99 11.99 0 0 0 12 24z" />
                <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.6H1.29a11.99 11.99 0 0 0 0 10.8l3.98-3.13z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.6l3.98 3.13C6.22 6.86 8.87 4.75 12 4.75z" />
              </svg>
            )}
            {googleLoading ? 'Conectando...' : 'Continuar com Google'}
          </Button>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {isLogin ? 'Ainda não tem conta?' : 'Já possui uma conta?'}{' '}
            <button type="button" onClick={() => { setIsLogin(!isLogin); clearErrors(); }} className="font-semibold text-primary hover:underline">
              {isLogin ? 'Criar conta' : 'Fazer login'}
            </button>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
