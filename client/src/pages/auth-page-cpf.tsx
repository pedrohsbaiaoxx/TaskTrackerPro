import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogIn } from "lucide-react";
import { saveCPF } from "@/lib/expenseStore";

export default function AuthPage() {
  const [cpf, setCpf] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Format CPF as XXX.XXX.XXX-XX
    let value = e.target.value.replace(/\D/g, "");
    if (value.length <= 11) {
      value = value
        .replace(/(\d{3})(?=\d)/, "$1.")
        .replace(/(\d{3})(?=\d)/, "$1.")
        .replace(/(\d{3})(?=\d)/, "$1-");
      setCpf(value);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cpf || cpf.replace(/\D/g, "").length !== 11) {
      toast({
        title: "CPF inválido",
        description: "Por favor, digite um CPF válido com 11 dígitos",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Salva no armazenamento local para autenticação rápida
      await saveCPF(cpf);
      
      // Autentica o usuário via API
      const response = await fetch('/api/auth/cpf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ cpf }),
      });
      
      if (!response.ok) {
        throw new Error('Falha na autenticação');
      }
      
      const userData = await response.json();
      
      toast({
        title: "Login realizado com sucesso",
        description: "Você foi identificado com sucesso",
      });
      
      navigate("/dashboard");
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      toast({
        title: "Erro ao fazer login",
        description: "Ocorreu um erro ao tentar fazer login",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Formulário (lado esquerdo) */}
      <div className="flex items-center justify-center p-6 md:w-1/2">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Identificação</CardTitle>
              <CardDescription>
                Digite seu CPF para acessar o sistema de controle de despesas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={cpf}
                    onChange={handleCpfChange}
                    placeholder="000.000.000-00"
                    required
                  />
                  <p className="text-sm text-gray-500">
                    O CPF é usado para identificar suas viagens entre dispositivos
                  </p>
                </div>
                <Button 
                  type="submit" 
                  className="w-full mt-4" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="mr-2 h-4 w-4" />
                  )}
                  Entrar
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Hero section (lado direito) */}
      <div className="bg-gradient-to-br from-primary/80 to-primary/50 p-8 md:p-12 flex flex-col justify-center md:w-1/2">
        <div className="max-w-lg mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Controle de Despesas de Viagem
          </h1>
          <p className="text-white/90 text-lg mb-8">
            Organize suas viagens de negócios, registre despesas e gere relatórios detalhados facilmente.
          </p>
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="bg-white/10 p-2 rounded-full mr-4">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold">Gestão de despesas simplificada</h3>
                <p className="text-white/80">Registre e categorize despesas com recibos facilmente</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="bg-white/10 p-2 rounded-full mr-4">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold">Geração de relatórios</h3>
                <p className="text-white/80">Exporte seus relatórios em PDF ou Excel</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="bg-white/10 p-2 rounded-full mr-4">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold">Interface responsiva</h3>
                <p className="text-white/80">Acesse de qualquer dispositivo, em qualquer lugar</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}