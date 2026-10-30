import Link from 'next/link';
import { AlertCircle, Home, UserCheck } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#0b1120] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#131d31] border border-slate-800 rounded-2xl p-6 sm:p-8 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-5">
          <AlertCircle className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Página não encontrada
        </h1>

        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          O endereço acessado não existe ou foi reorganizado na nova versão do MediCare.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-sm transition-colors shadow-md"
          >
            <Home className="w-4 h-4" />
            Ir para o Portal Inicial
          </Link>

          <Link
            href="/cuidador"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:bg-slate-800 text-slate-200 border border-slate-700 font-medium text-sm transition-colors"
          >
            <UserCheck className="w-4 h-4 text-blue-400" />
            Acessar MediCare Cuidador
          </Link>
        </div>
      </div>
    </main>
  );
}
