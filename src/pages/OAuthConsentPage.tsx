import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};
const authOauth = () => (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;

const TIMEOUT_MS = 10_000;

class TimeoutError extends Error {
  constructor() {
    super("timeout");
    this.name = "TimeoutError";
  }
}

/** Nunca deixa uma promessa de auth pendurada — o ecrã sempre sai do "carregando". */
function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      console.warn(`[oauth-consent] timeout em ${label}`);
      reject(new TimeoutError());
    }, TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export default function OAuthConsentPage() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const goToLogin = useCallback(() => {
    const next = window.location.pathname + window.location.search;
    window.location.href = "/auth?next=" + encodeURIComponent(next);
  }, []);

  /** Limpa a sessão local (que pode estar corrompida) e volta ao login. */
  const resetSession = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // ignorado: o objetivo é apenas limpar o estado local
    }
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith("sb-") && key.includes("auth-token"))
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      // storage indisponível (modo privado) — segue para o login
    }
    goToLogin();
  }, [goToLogin]);

  useEffect(() => {
    let active = true;
    const isExpiredSession = (message?: string) =>
      !!message &&
      /expired|invalid jwt|unable to parse or verify signature|invalid claims|jwt/i.test(message);

    (async () => {
      setError(null);
      setTimedOut(false);
      try {
        if (!authorizationId) {
          setError("Parâmetro authorization_id ausente.");
          return;
        }
        const { data: sess } = await withTimeout(supabase.auth.getSession(), "getSession");
        if (!active) return;
        if (!sess.session) {
          goToLogin();
          return;
        }
        // Garante um access token válido antes de falar com o servidor de autorização.
        const expiresAt = sess.session.expires_at ? sess.session.expires_at * 1000 : 0;
        if (!expiresAt || expiresAt - Date.now() < 60_000) {
          const { data: refreshed, error: refreshError } = await withTimeout(
            supabase.auth.refreshSession(),
            "refreshSession",
          );
          if (!active) return;
          if (refreshError || !refreshed.session) {
            await resetSession();
            return;
          }
        }

        const { data, error } = await withTimeout(
          authOauth().getAuthorizationDetails(authorizationId),
          "getAuthorizationDetails",
        );
        if (!active) return;
        if (error) {
          if (isExpiredSession(error.message)) {
            const { data: retrySession } = await withTimeout(
              supabase.auth.refreshSession(),
              "refreshSession(retry)",
            );
            if (!active) return;
            if (!retrySession.session) {
              await resetSession();
              return;
            }
            const retry = await withTimeout(
              authOauth().getAuthorizationDetails(authorizationId),
              "getAuthorizationDetails(retry)",
            );
            if (!active) return;
            if (retry.error) {
              setError(retry.error.message);
              return;
            }
            const immediateRetry = retry.data?.redirect_url ?? retry.data?.redirect_to;
            if (immediateRetry && !retry.data?.client) {
              window.location.href = immediateRetry;
              return;
            }
            setDetails(retry.data);
            return;
          }
          setError(error.message);
          return;
        }
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (err) {
        if (!active) return;
        if (err instanceof TimeoutError) {
          setTimedOut(true);
          setError("A verificação da sua sessão demorou demais para responder.");
          return;
        }
        console.error("[oauth-consent] falha inesperada", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId, attempt, goToLogin, resetSession]);

  async function decide(approve: boolean) {
    setBusy(true);
    const call = () =>
      withTimeout(
        approve
          ? authOauth().approveAuthorization(authorizationId)
          : authOauth().denyAuthorization(authorizationId),
        approve ? "approveAuthorization" : "denyAuthorization",
      );
    try {
      let { data, error } = await call();
      if (error && /expired|invalid jwt|invalid claims|signature/i.test(error.message)) {
        const { data: refreshed } = await withTimeout(
          supabase.auth.refreshSession(),
          "refreshSession(decide)",
        );
        if (refreshed.session) {
          ({ data, error } = await call());
        }
      }
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }

      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        setError("O servidor de autorização não retornou uma URL de redirecionamento.");
        return;
      }
      window.location.href = target;
    } catch (err) {
      setBusy(false);
      if (err instanceof TimeoutError) {
        setTimedOut(true);
        setError("O servidor de autorização demorou demais para responder.");
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (error) {
    const notFound = !timedOut && /not found|não encontrad|expired|expirad|invalid/i.test(error);
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardHeader className="space-y-2">
            <CardTitle>
              {timedOut
                ? "Não conseguimos concluir a autorização"
                : notFound
                  ? "Este pedido de conexão expirou"
                  : "Não foi possível carregar a autorização"}
            </CardTitle>
            <CardDescription>
              {timedOut
                ? `${error} Tente novamente; se continuar, limpe a sessão local e entre outra vez antes de reconectar o aplicativo.`
                : notFound
                  ? "O link de autorização já foi usado ou expirou. Volte ao aplicativo que você estava conectando (ChatGPT, Cursor, etc.) e inicie a conexão novamente. Para usar a Lumnia normalmente, entre pelo botão abaixo."
                  : error}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                className="flex-1 rounded-xl"
                onClick={() => {
                  setError(null);
                  setTimedOut(false);
                  setAttempt((n) => n + 1);
                }}
              >
                Tentar novamente
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => (window.location.href = "/")}
              >
                Ir para a Lumnia
              </Button>
            </div>
            <Button variant="ghost" className="rounded-xl" onClick={resetSession}>
              Limpar sessão e entrar novamente
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando autorização...
        </div>
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={resetSession}>
          Está demorando? Limpar sessão e entrar novamente
        </Button>
      </main>
    );
  }

  const clientName = details.client?.name ?? "este aplicativo";

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md rounded-2xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Conectar {clientName} à Lumnia</CardTitle>
          <CardDescription>
            Isto permitirá que {clientName} use as ferramentas da Lumnia agindo como você. Suas
            políticas de dados continuam sendo aplicadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {details.client?.redirect_uri && (
            <div className="text-xs text-muted-foreground break-all bg-muted/40 rounded-xl p-3">
              Redirecionamento: {details.client.redirect_uri}
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => decide(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button className="flex-1 rounded-xl" onClick={() => decide(true)} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Autorizar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
