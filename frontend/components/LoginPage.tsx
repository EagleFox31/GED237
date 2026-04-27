import React, { useEffect, useState } from 'react';
import CameroonMap from './CameroonMap';
import DemoProfiles from './widgets/DemoProfiles';
import { api, type AuthSession } from '../services/api';

interface LoginPageProps {
  onLogin: (session: AuthSession) => void;
}

const DEMO_CREDENTIALS: Record<string, { institution: string; matricule: string; password: string }> = {
  super: { institution: 'Plateforme E-Dossier (PLATFORM)', matricule: 'SUPER001', password: 'Admin@2025' },
  tenant: { institution: 'Ministère des Finances (MINFI)', matricule: 'MINFI001', password: 'Minfi@2025' },
  collab: { institution: 'Ministère des Finances (MINFI)', matricule: 'MINFI002', password: 'User@2025' },
};

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [step, setStep] = useState<'login' | 'otp'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form controlled inputs
  const [institution, setInstitution] = useState('');
  const [tenantOptions, setTenantOptions] = useState<Array<{ name: string; short_name: string | null }> | null>(null);
  const [tenantsLoadError, setTenantsLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getPublicTenants()
      .then((list) => { if (!cancelled) setTenantOptions(list); })
      .catch(() => { if (!cancelled) setTenantsLoadError(true); });
    return () => { cancelled = true; };
  }, []);
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');

  const handleDemoSelect = (profile: any) => {
    const creds = DEMO_CREDENTIALS[profile.id];
    if (creds) {
      setInstitution(creds.institution);
      setMatricule(creds.matricule);
      setPassword(creds.password);
      setError(null);
      return;
    }

    setError('Ce compte de démonstration ne fait pas partie de la seed courante.');
  };

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement);
      const institution = formData.get('institution') as string;
      const matricule = formData.get('matricule') as string;
      const password = formData.get('password') as string;

      const response = await api.login({ institution, matricule, password });

      if (response.session_token) {
        setTempToken(response.session_token);
        setStep('otp');
        if (response.otp && typeof response.otp === 'string' && response.otp.length === 6) {
          setOtp(response.otp.split(''));
        }
      } else {
        setError('Réponse inattendue du serveur.');
      }
    } catch (err) {
      console.error(err);
      setError("Échec de connexion. Vérifiez vos identifiants.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const code = otp.join('');
      if (!tempToken || code.length !== 6) {
        setError("Code incorrect");
        return;
      }

      const response = await api.verifyOTP({
        session_token: tempToken,
        otp: code,
      });
      onLogin(response);
    } catch (err) {
      setError("Code invalide");
    } finally {
      setLoading(false);
    }
  };



  const handleOtpChange = (index: number, value: string) => {
    const sanitizedValue = value.replace(/\D/g, '');
    if (sanitizedValue.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = sanitizedValue;
    setOtp(newOtp);
    if (sanitizedValue && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  return (
    <div className="font-display bg-[#f8f9fa] text-slate-900 h-screen overflow-hidden flex flex-col md:flex-row w-full selection:bg-rdpc-blue/10">

      {/* Panneau Gauche : Prestige National */}
      <div className="hidden md:flex relative w-[40%] h-full flex-col justify-between overflow-hidden bg-rdpc-blue shadow-2xl shrink-0">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[80%] rounded-full bg-cam-green blur-[120px] opacity-40 animate-flow"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[80%] rounded-full bg-cam-yellow blur-[120px] opacity-30 animate-flow" style={{ animationDelay: '-7s' }}></div>
          <div className="absolute top-[30%] left-[20%] w-[60%] h-[60%] rounded-full bg-cam-red blur-[100px] opacity-30 animate-flow" style={{ animationDelay: '-3s' }}></div>
        </div>

        <div className="relative z-10 p-12 flex flex-col h-full justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/95 flex items-center justify-center shadow-2xl backdrop-blur-md transition-transform hover:scale-110">
              <span className="material-symbols-outlined text-rdpc-blue text-4xl font-semibold">shield_lock</span>
            </div>
            <div>
              <h2 className="text-white text-2xl font-black tracking-tighter leading-none uppercase italic">E-Dossier</h2>
              <p className="text-white/60 text-[10px] font-bold tracking-[0.4em] uppercase mt-1">Souveraineté Numérique</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center items-center">
            <div className="w-full max-w-[300px] relative group animate-in zoom-in duration-1000">
              <div className="absolute inset-0 bg-white/10 blur-[90px] rounded-full scale-90 animate-pulse"></div>
              <CameroonMap className="w-full h-auto relative z-10 text-white/90 brightness-[5] drop-shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all duration-700 group-hover:scale-105" />
            </div>
            <div className="mt-12 text-center px-6">
              <h1 className="text-white text-3xl font-black italic tracking-tighter uppercase leading-tight">Authentification <br /><span className="text-cam-yellow font-medium not-italic">Haute Sécurité</span></h1>
              <p className="text-white/70 text-sm mt-4 leading-relaxed max-w-xs mx-auto font-medium italic">Accès restreint aux agents de l'État et personnels autorisés.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-8 border-t border-white/10 opacity-50">
            <span className="material-symbols-outlined text-white text-sm">verified_user</span>
            <p className="text-white text-[9px] font-black uppercase tracking-[0.3em]">Infrastructure Certifiée ANTIC - 2025</p>
          </div>
        </div>
      </div>

      {/* Panneau Droit : Formulaire & Démo */}
      <div className="w-full md:w-[60%] h-full flex flex-col relative overflow-y-auto bg-white">
        <main className="flex-1 flex flex-col justify-center px-8 sm:px-16 md:px-20 lg:px-24 w-full max-w-5xl mx-auto z-10 py-12">
          <div className="w-full space-y-12">

            {step === 'login' ? (
              <div className="space-y-10 animate-in fade-in slide-in-from-right duration-500">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-rdpc-blue rounded-full text-[9px] font-black uppercase tracking-widest">Portail Officiel</div>
                  <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter italic uppercase leading-none">Connexion</h1>
                  <p className="text-slate-500 text-lg font-medium leading-relaxed">Accédez à votre espace de travail dématérialisé.</p>
                  {error && <p className="text-red-500 text-sm font-bold bg-red-50 p-3 rounded-xl">{error}</p>}
                </div>

                <form onSubmit={handleInitialSubmit} className="space-y-6 max-w-xl">
                  <div className="space-y-5">
                    <div className="space-y-2 group">
                      <label className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 ml-1">Administration / Organisme</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-300 group-focus-within:text-rdpc-blue transition-colors">
                          <span className="material-symbols-outlined">corporate_fare</span>
                        </div>
                        {tenantsLoadError ? (
                          <input
                            id="institution"
                            name="institution"
                            type="text"
                            value={institution}
                            onChange={(e) => setInstitution(e.target.value)}
                            placeholder="Nom de votre institution..."
                            className="block w-full pl-16 pr-10 py-4 border-2 border-slate-50 rounded-2xl bg-slate-50/50 text-slate-900 transition-all focus:bg-white focus:ring-8 focus:ring-blue-500/5 focus:border-rdpc-blue/30 font-bold"
                            required
                          />
                        ) : (
                          <>
                            <select id="institution" name="institution" value={institution} onChange={(e) => setInstitution(e.target.value)} className="block w-full pl-16 pr-10 py-4 border-2 border-slate-50 rounded-2xl bg-slate-50/50 text-slate-900 transition-all focus:bg-white focus:ring-8 focus:ring-blue-500/5 focus:border-rdpc-blue/30 appearance-none font-bold cursor-pointer" required disabled={tenantOptions === null}>
                              <option value="">
                                {tenantOptions === null ? 'Chargement des institutions...' : 'Sélectionnez votre institution...'}
                              </option>
                              {tenantOptions?.map((t) => {
                                const label = t.short_name ? `${t.name} (${t.short_name})` : t.name;
                                return <option key={label} value={label}>{label}</option>;
                              })}
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-6 flex items-center pointer-events-none text-slate-300 group-focus-within:text-rdpc-blue transition-colors">
                              <span className="material-symbols-outlined">expand_more</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 group">
                      <label htmlFor="matricule" className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 ml-1">Matricule Personnel</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-300 group-focus-within:text-rdpc-blue transition-colors">
                          <span className="material-symbols-outlined">badge</span>
                        </div>
                        <input id="matricule" name="matricule" type="text" value={matricule} onChange={(e) => setMatricule(e.target.value)} className="block w-full pl-16 pr-6 py-4 border-2 border-slate-50 rounded-2xl bg-slate-50/50 text-slate-900 focus:bg-white focus:ring-8 focus:ring-blue-500/5 focus:border-rdpc-blue/30 font-bold outline-none transition-all placeholder:text-slate-300" placeholder="EX: 752458-M" required />
                      </div>
                    </div>

                    <div className="space-y-2 group">
                      <div className="flex justify-between px-1">
                        <label htmlFor="password" className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Mot de Passe</label>
                        <button type="button" className="text-[10px] font-black text-rdpc-blue uppercase hover:underline">Oublié ?</button>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-300 group-focus-within:text-rdpc-blue transition-colors">
                          <span className="material-symbols-outlined">lock_open</span>
                        </div>
                        <input id="password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full pl-16 pr-16 py-4 border-2 border-slate-50 rounded-2xl bg-slate-50/50 text-slate-900 focus:bg-white focus:ring-8 focus:ring-blue-500/5 focus:border-rdpc-blue/30 font-bold outline-none transition-all placeholder:text-slate-300" placeholder="••••••••" required />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-6 flex items-center text-slate-300 hover:text-rdpc-blue transition-colors">
                          <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-4 py-5 rounded-2xl bg-rdpc-blue text-white text-xs font-black uppercase tracking-[0.4em] transition-all hover:bg-blue-800 shadow-2xl shadow-blue-500/20 disabled:opacity-70 group overflow-hidden relative">
                    {loading ? "Connexion..." : <span className="flex items-center gap-3 italic">Étape Suivante <span className="material-symbols-outlined group-hover:translate-x-2 transition-transform font-bold">east</span></span>}
                    <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-10 animate-in fade-in slide-in-from-right duration-500 max-w-xl">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-full text-[9px] font-black uppercase tracking-widest">Double Facteur</div>
                  <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter italic uppercase leading-none">Code MFA</h1>
                  <p className="text-slate-500 text-lg font-medium leading-relaxed">Saisissez le code de sécurité reçu sur votre mobile.</p>
                  {error && <p className="text-red-500 text-sm font-bold bg-red-50 p-3 rounded-xl">{error}</p>}
                </div>

                <form onSubmit={handleOtpSubmit} className="space-y-10">
                  <div className="flex justify-between gap-3">
                    {otp.map((digit, idx) => (
                      <input key={idx} id={`otp-${idx}`} type="text" maxLength={1} value={digit} onChange={(e) => handleOtpChange(idx, e.target.value)} className="w-full h-16 text-center text-2xl font-black text-rdpc-blue bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-rdpc-blue focus:ring-8 focus:ring-blue-500/5 outline-none transition-all" />
                    ))}
                  </div>

                  <div className="space-y-4">
                    <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-4 py-5 rounded-2xl bg-rdpc-blue text-white text-xs font-black uppercase tracking-[0.4em] transition-all hover:bg-blue-800 shadow-2xl shadow-blue-500/20 group relative overflow-hidden">
                      {loading ? "Validation..." : <span className="flex items-center gap-3 italic relative z-10">Confirmer l'identité <span className="material-symbols-outlined group-hover:scale-125 transition-transform font-bold">verified_user</span></span>}
                      <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
                    </button>
                    <button type="button" onClick={() => setStep('login')} className="w-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rdpc-blue transition-colors">Utiliser une autre méthode</button>
                  </div>
                </form>
              </div>
            )}

            {step === 'login' && <DemoProfiles onSelect={handleDemoSelect} />}

            <div className="mt-8 pt-8 border-t border-slate-50 opacity-30 group hover:opacity-100 transition-opacity">
              <p className="text-[9px] text-slate-400 font-bold text-center leading-relaxed italic">
                Ce système est la propriété exclusive de l'État du Cameroun. <br />Toute utilisation non autorisée sera poursuivie conformément à la loi sur la cybercriminalité.
              </p>
            </div>
          </div>
        </main>
      </div>

      <style>{`
        @keyframes shine {
          100% {
            left: 125%;
          }
        }
        .animate-shine {
          animation: shine 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
