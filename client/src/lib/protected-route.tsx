import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { getCPF } from "@/lib/expenseStore";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const cpf = await getCPF();
        setIsAuthenticated(!!cpf);
      } catch (error) {
        console.error("Erro ao verificar autenticação:", error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="h-8 w-8 animate-spin border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </Route>
    );
  }

  if (!isAuthenticated) {
    console.log("Usuário não autenticado, redirecionando para /auth");
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}