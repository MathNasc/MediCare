import { Shield, ArrowRight, Download, CheckCircle, Calendar, HeartHandshake } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8 antialiased">
      <div className="max-w-4xl mx-auto w-full space-y-12 my-auto">
        
        {/* BLOCO A — APRESENTAÇÃO */}
        <section className="text-center space-y-4 max-w-2xl mx-auto pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold tracking-wide">
            <HeartHandshake className="w-3.5 h-3.5 text-blue-400" />
            <span>Cuidado e Saúde Compartilhada</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Sua saúde, acompanhada de perto.
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            O MediCare conecta pacientes e cuidadores para facilitar a organização de medicamentos,
            o acompanhamento dos tratamentos e a rotina de cuidados.
          </p>
        </section>

        {/* BLOCO B — ACESSO ÀS APLICAÇÕES */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cartão 1: MediCare Cuidador (Destaque Azul) */}
          <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-6 sm:p-7 flex flex-col justify-between shadow-xl shadow-black/20 hover:border-blue-500/40 transition-all group">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-xl bg-blue-600/15 border border-blue-500/25 flex items-center justify-center text-blue-400 mb-2">
                <Shield className="w-5 h-5" />
              </div>
              
              <h2 className="text-xl font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">
                MediCare Cuidador
              </h2>

              <p className="text-sm text-slate-300 leading-relaxed">
                Organize o cuidado, acompanhe seus pacientes e consulte administrações,
                compromissos e histórico em um só lugar.
              </p>
            </div>

            <div className="pt-6 mt-2">
              <a
                href="/cuidador"
                className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm py-3 px-5 rounded-xl transition-colors shadow-lg shadow-blue-600/20 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#131d31]"
              >
                <span>Acessar MediCare Cuidador</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>

          {/* Cartão 2: MediCare Paciente (Destaque Verde) */}
          <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-6 sm:p-7 flex flex-col justify-between shadow-xl shadow-black/20 hover:border-emerald-500/40 transition-all group">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-600/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 mb-2">
                <Download className="w-5 h-5" />
              </div>

              <h2 className="text-xl font-bold text-white tracking-tight group-hover:text-emerald-400 transition-colors">
                MediCare Paciente
              </h2>

              <p className="text-sm text-slate-300 leading-relaxed">
                Consulte seus medicamentos, acompanhe seus horários e utilize os recursos de
                lembretes do aplicativo Android.
              </p>
            </div>

            <div className="pt-6 mt-2">
              <a
                href="/api/apk"
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-sm py-3 px-5 rounded-xl transition-colors shadow-lg shadow-emerald-600/20 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-[#131d31]"
              >
                <span>Baixar aplicativo Android</span>
                <Download className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* BLOCO C — APRESENTAÇÃO DOS BENEFÍCIOS */}
        <section className="bg-[#131d31]/70 rounded-2xl border border-slate-800/80 p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Benefício 1 */}
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Organização</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Medicamentos, horários e compromissos centralizados em um fluxo simples.
                </p>
              </div>
            </div>

            {/* Benefício 2 */}
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <HeartHandshake className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Acompanhamento</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Informações seguras disponíveis para pacientes e seus cuidadores autorizados.
                </p>
              </div>
            </div>

            {/* Benefício 3 */}
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Continuidade</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Registros e histórico integrados à rotina diária de saúde da família.
                </p>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* Rodapé discreto */}
      <footer className="text-center pt-8 text-xs text-slate-500">
        MediCare • Gestão de Saúde e Cuidado Compartilhado
      </footer>
    </div>
  );
}
