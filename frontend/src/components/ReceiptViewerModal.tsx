import React from 'react';
import { X, Download, FileText } from 'lucide-react';
import { ReceiptAttachment } from '../types';

interface ReceiptViewerModalProps {
  receipt: ReceiptAttachment | null;
  productName: string;
  onClose: () => void;
}

export const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({
  receipt,
  productName,
  onClose,
}) => {
  if (!receipt) return null;

  const isPdf = receipt.mimeType === 'application/pdf';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">
              Nota Fiscal — {productName}
            </h3>
            <p className="text-xs text-slate-500 truncate">{receipt.fileName}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={receipt.dataUrl}
              download={receipt.fileName}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-4 bg-slate-100 flex-1 overflow-auto flex items-center justify-center min-h-[300px]">
          {isPdf ? (
            <div className="text-center p-6 bg-white rounded-xl shadow-xs border border-slate-200">
              <FileText className="h-12 w-12 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">{receipt.fileName}</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Documento PDF armazenado com segurança.
              </p>
              <a
                href={receipt.dataUrl}
                download={receipt.fileName}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
              >
                <Download className="h-4 w-4" />
                Fazer Download do PDF
              </a>
            </div>
          ) : (
            <img
              src={receipt.dataUrl}
              alt={`Nota fiscal de ${productName}`}
              className="max-h-[70vh] w-auto rounded-lg shadow-sm object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );
};
