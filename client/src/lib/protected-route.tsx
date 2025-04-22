import { useEffect, useState } from "react";
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
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Primeiro verificamos se o usuário está autenticado no backend
        const response = await fetch('/api/user', {
          credentials: 'include'
        });

        // Se a resposta for bem-sucedida, o usuário está autenticado no backend
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setIsAuthenticated(true);
        } else {
          // Se não estiver autenticado no backend, verificamos o CPF local
          const cpf = await getCPF();
          if (cpf) {
            // Se tiver CPF local, tentamos autenticar no backend
            await authenticateWithCpf(cpf);
          } else {
            setIsAuthenticated(false);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    const authenticateWithCpf = async (cpf: string) => {
      try {
        const response = await fetch('/api/auth/cpf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ cpf })
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Erro ao autenticar com CPF:', error);
        setIsAuthenticated(false);
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