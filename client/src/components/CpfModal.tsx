import { useState } from "react";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CpfModalProps {
  currentCpf: string | null;
  onSave: (cpf: string) => void;
  onClose: () => void;
}

const CpfModal = ({ currentCpf, onSave, onClose }: CpfModalProps) => {
  const [cpf, setCpf] = useState(currentCpf || "");

  const handleSave = () => {
    onSave(cpf);
  };

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

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Identificar por CPF</DialogTitle>
          <DialogDescription>
            O CPF é opcional e ajuda a identificar suas viagens entre dispositivos.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              value={cpf}
              onChange={handleCpfChange}
              placeholder="000.000.000-00"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CpfModal;
