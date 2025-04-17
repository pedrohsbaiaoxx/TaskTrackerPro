import { useState, useEffect } from "react";
import { 
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ReceiptPreviewModalProps {
  receiptUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const ReceiptPreviewModal = ({ receiptUrl, isOpen, onClose }: ReceiptPreviewModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] bg-black/90 border-0">
        <div className="flex justify-between items-center mb-4 text-white">
          <h3 className="font-medium">Comprovante</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white">
            <X className="h-6 w-6" />
          </Button>
        </div>
        {receiptUrl && (
          <img 
            src={receiptUrl} 
            alt="Comprovante em tamanho real" 
            className="max-w-full max-h-[70vh] mx-auto rounded-lg" 
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptPreviewModal;
