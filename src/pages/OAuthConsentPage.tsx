import { useEffect, useState } from "react";
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

export default function OAuthConsentPage() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Parâmetro authorization_id ausente.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await authOauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await authOauth().approveAuthorization(authorizationId)
      : await authOauth().denyAuthorization(authorizationId);
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
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardHeader>
            <CardTitle>Não foi possível carregar a autorização</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando autorização...
        </div>
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
            <Button
              className="flex-1 rounded-xl"
              onClick={() => decide(true)}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Autorizar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
