// Final production sync - V2.1
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, MapPin, Search, Briefcase, Calendar, 
  DollarSign, Globe, Clock, Filter, Target, LogIn, LogOut, CheckCircle2, Bell, BellOff
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

interface Offer {
  id: number;
  title: string;
  little_description: string;
  city: string;
  country: string;
  address: string;
  contract_type: string;
  salary: string;
  created_at: string;
  invalid_at: string;
  is_remote: boolean;
  company_name: string;
  company_logo: string | null;
}

function App() {
  const STORAGE_KEY = 'FIND_INTERNSHIP_SESSION_FINAL';
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY);
  });
  
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState('');
  const [debouncedCity, setDebouncedCity] = useState('');
  const [country, setCountry] = useState('');
  const [contractType, setContractType] = useState('');
  const [expertise, setExpertise] = useState('');
  const [target, setTarget] = useState('');
  const [onlyRemote, setOnlyRemote] = useState(false);
  const [user, setUser] = useState<{login: string, image: string, userId: number, notifications_enabled: boolean} | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userStr = new URLSearchParams(window.location.search).get('user');
        const parsedUser = userStr ? JSON.parse(decodeURIComponent(userStr)) : null;
        
        // Persistência local do estado das notificações
        const localNotifStatus = localStorage.getItem('notifications_enabled');
        const isEnabled = localNotifStatus !== null 
          ? localNotifStatus === 'true' 
          : (parsedUser?.notifications_enabled ?? payload.notifications_enabled ?? false);
        
        setUser({ 
          login: payload.login, 
          image: payload.image,
          userId: parsedUser?.userId || payload.userId,
          notifications_enabled: isEnabled
        });
        setNotificationsEnabled(isEnabled);
      } catch (e) {
        console.error("Erro ao decodificar token", e);
      }
    }
  }, [token]);

  const handleToggleNotifications = async () => {
    if (!user || loadingNotifications) return;
    const newState = !notificationsEnabled;
    setLoadingNotifications(true);
    
    try {
      console.log('Tentando alternar notificações para:', { userId: user.userId, enabled: newState });
      const response = await fetch(`${API_BASE_URL}/auth/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: Number(user.userId), enabled: newState }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Sucesso ao alternar:', data);
        setNotificationsEnabled(newState);
        localStorage.setItem('notifications_enabled', String(newState));
      } else {
        const errData = await response.text();
        console.error('Erro do servidor ao alternar:', errData);
      }
    } catch (error) {
      console.error('Erro de rede ao alternar notificações:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCity(city);
    }, 500);
    return () => clearTimeout(handler);
  }, [city]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token') || urlParams.get('secure_session_id');
    const userFromUrl = urlParams.get('user');

    if (tokenFromUrl) {
      localStorage.setItem(STORAGE_KEY, tokenFromUrl);
      setToken(tokenFromUrl);
      
      if (userFromUrl) {
        try {
          const parsedUser = JSON.parse(decodeURIComponent(userFromUrl));
          setUser(parsedUser);
          setNotificationsEnabled(parsedUser.notifications_enabled ?? true);
        } catch (e) {
          console.error("Erro ao processar dados do user na URL", e);
        }
      }
      
      window.history.replaceState({}, document.title, window.location.pathname); 
    }
  }, []);

  const fetchOffers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      let params = new URLSearchParams({ city: debouncedCity });
      if (country) params.append('country', country);
      if (contractType) params.append('contract_type', contractType);
      if (expertise) params.append('expertise_id', expertise);
      if (target) params.append('target', target);
      
      const response = await fetch(`${API_BASE_URL}/offers?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 401) {
        handleLogout();
        return;
      }
      let data = await response.json();
      if (onlyRemote) {
        data = data.filter((o: Offer) => o.is_remote);
      }
      setOffers(data);
    } catch (error) {
       console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchOffers();
  }, [token, debouncedCity, contractType, expertise, target, onlyRemote]);

  const handleLogout = () => {
    // Apenas limpa o estado local e volta para a tela de login
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('notifications_enabled');
    setToken(null);
    setUser(null);
    setOffers([]);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-[#111827] border border-gray-800 p-12 rounded-[2.5rem] text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#00BABC]" />
          <div className="w-16 h-16 bg-[#00BABC]/10 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-inner shadow-[#00BABC]/10">
             <LogIn className="w-8 h-8 text-[#00BABC]" />
          </div>
          <h1 className="text-3xl font-black mb-4 tracking-tight leading-none text-white font-sans">
            Find <span className="text-[#00BABC]">Internship</span>
          </h1>
          <p className="text-slate-400 text-sm mb-10 leading-relaxed font-medium">
             Aceder ao portal oficial 42
          </p>
          <a 
            href={`${API_BASE_URL}/auth/login`}
            className="block w-full bg-[#00BABC] hover:bg-[#008f91] text-black font-black py-4 rounded-2xl transition-all shadow-xl text-center no-underline uppercase text-xs"
          >
            ENTRAR COM A 42
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-8 font-sans selection:bg-[#00BABC]/20 relative">
      
      {/* BOTÃO DE LOGOUT E NOTIFICAÇÕES - CANTO SUPERIOR DIREITO */}
      <div className="fixed top-8 right-8 z-[100] flex flex-col gap-3 items-end">
        <button 
          onClick={handleLogout}
          className="p-3 bg-slate-900 border border-slate-700 hover:border-rose-500/50 hover:text-rose-500 rounded-2xl transition-all shadow-2xl text-slate-500 group"
          title="Signout"
        >
          <LogOut size={18} className="group-hover:rotate-12 transition-transform" />
        </button>

        <button 
          onClick={handleToggleNotifications}
          disabled={loadingNotifications}
          className={`p-3 border rounded-2xl transition-all shadow-2xl group ${
            loadingNotifications ? 'opacity-50 cursor-not-allowed' : ''
          } ${
            notificationsEnabled 
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20' 
              : 'bg-slate-900 text-slate-500 border-slate-700 hover:border-emerald-500/50 hover:text-emerald-500'
          }`}
          title={notificationsEnabled ? 'Desativar Notificações' : 'Ativar Notificações'}
        >
          {loadingNotifications ? (
            <div className="w-[18px] h-[18px] border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            notificationsEnabled ? <Bell size={18} className="animate-bounce" /> : <BellOff size={18} />
          )}
        </button>
      </div>

      {/* BACKGROUND DECOR */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#00BABC]/20 rounded-full blur-[150px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* HEADER SECTION */}
        <header className="mb-12">
          <motion.div 
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-10"
          >
            <div className="flex items-center gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-[2px] bg-[#00BABC]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#00BABC]">Explore 42 Jobs</span>
                </div>
                <h1 className="text-6xl font-black tracking-tight leading-none text-white">
                  Find <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#00BABC] to-blue-500">Internship</span>
                </h1>
              </div>

              {user && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  className="hidden md:flex items-center gap-4 bg-slate-900/40 p-2 pr-6 rounded-full border border-slate-800/50 backdrop-blur-sm self-end mb-2"
                >
                  <img src={user.image} alt={user.login} className="w-10 h-10 rounded-full border-2 border-[#00BABC]/30 object-cover" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-[#00BABC] uppercase tracking-wider">Authenticated as</span>
                    <span className="text-xs font-bold text-white lowercase">@{user.login}</span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* MAIN SEARCH TILE */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-2 rounded-3xl flex items-center gap-2 shadow-2xl w-full md:w-[450px]">
              <div className="flex-1 flex items-center px-4">
                <Search className="w-5 h-5 text-slate-500 mr-3" />
                <input 
                  type="text" 
                  placeholder="Cidade (ex: Luanda, Paris...)" 
                  className="bg-transparent border-none outline-none text-sm py-3 w-full text-white placeholder-slate-600 font-medium"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onKeyUp={(e) => e.key === 'Enter' && fetchOffers()}
                />
              </div>
              <button 
                onClick={fetchOffers}
                className="bg-[#00BABC] hover:brightness-110 text-slate-950 font-black px-6 py-3 rounded-2xl transition-all shadow-[0_0_20px_rgba(0,186,188,0.3)] active:scale-95"
              >
                BUSCAR
              </button>
            </div>
          </motion.div>

          {/* ADVANCED FILTER BAR */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-wrap items-center gap-4 bg-slate-900/40 p-4 rounded-3xl border border-slate-800/50 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mr-2">
               <Filter className="w-4 h-4" /> FILTRAR POR:
            </div>

            <select 
              value={country} onChange={(e) => setCountry(e.target.value)}
              className="bg-slate-800/80 border border-slate-700/50 rounded-xl px-4 py-2 text-xs font-bold text-slate-300 outline-none focus:border-[#00BABC]/50 hover:bg-slate-700 transition-all cursor-pointer"
            >
              <option value="">Países (Todos)</option>
              <option value="France">França</option>
              <option value="Madagascar">Madagascar</option>
              <option value="Spain">Espanha</option>
              <option value="Portugal">Portugal</option>
              <option value="Angola">Angola</option>
              <option value="Brazil">Brasil</option>
              <option value="Belgium">Bélgica</option>
              <option value="Switzerland">Suíça</option>
              <option value="Morocco">Marrocos</option>
              <option value="United Kingdom">Reino Unido</option>
            </select>

            <select 
              value={contractType} onChange={(e) => setContractType(e.target.value)}
              className="bg-slate-800/80 border border-slate-700/50 rounded-xl px-4 py-2 text-xs font-bold text-slate-300 outline-none focus:border-[#00BABC]/50 hover:bg-slate-700 transition-all cursor-pointer"
            >
              <option value="">Contratos (Todos)</option>
              <option value="stage">Stage / Estágio</option>
              <option value="cdi">Trabalho Integral (CDI)</option>
              <option value="cdd">Contrato Determinado (CDD)</option>
              <option value="apprentice_ship">Alternance / Apprentice</option>
              <option value="freelance">Freelance</option>
            </select>

            <select 
              value={expertise} onChange={(e) => setExpertise(e.target.value)}
              className="bg-slate-800/80 border border-slate-700/50 rounded-xl px-4 py-2 text-xs font-bold text-slate-300 outline-none focus:border-[#00BABC]/50 hover:bg-slate-700 transition-all cursor-pointer"
            >
              <option value="">Skills / Tecnologias (Todas)</option>
              <option value="java">Java / Spring Boot</option>
              <option value="node">Node.js / Express</option>
              <option value="python">Python / Django / AI</option>
              <option value="react">React / Frontend</option>
              <option value="mobile">Mobile (iOS/Android)</option>
              <option value="c++">C / C++ / Embedded</option>
              <option value="security">CyberSecurity</option>
              <option value="php">PHP / Laravel</option>
            </select>

            <select 
              value={target} onChange={(e) => setTarget(e.target.value)}
              className="bg-slate-800/80 border border-slate-700/50 rounded-xl px-4 py-2 text-xs font-bold text-slate-300 outline-none focus:border-[#00BABC]/50 hover:bg-slate-700 transition-all cursor-pointer"
            >
              <option value="">Público (Todos)</option>
              <option value="student">Somente Alunos</option>
              <option value="alumni">Somente Alumni</option>
            </select>

            <div 
              onClick={() => setOnlyRemote(!onlyRemote)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${onlyRemote ? 'bg-[#00BABC]/10 border-[#00BABC] text-[#00BABC]' : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:text-slate-300'}`}
            >
              <Globe className="w-3.5 h-3.5" /> 100% REMOTE
              {onlyRemote && <CheckCircle2 className="w-3.5 h-3.5" />}
            </div>
          </motion.div>
        </header>

        {/* LISTING SECTION */}
        <main>
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-40"
              >
                <div className="relative w-16 h-16 mb-6">
                   <div className="absolute inset-0 border-4 border-slate-800 rounded-full" />
                   <div className="absolute inset-0 border-4 border-[#00BABC] border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-slate-500 text-xs font-black tracking-widest uppercase animate-pulse">Buscando todas as vagas válidas na 42 Intra...</p>
                <p className="text-[10px] text-slate-600 mt-2 font-bold max-w-xs mx-auto">Filtrando apenas oportunidades em aberto e sem limites de busca.</p>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                {offers.map((offer, idx) => (
                  <motion.div 
                    key={offer.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="relative group bg-[#0f172a]/60 backdrop-blur-xl border border-slate-800/80 rounded-[2.5rem] p-7 hover:border-[#00BABC]/30 transition-all flex flex-col shadow-2xl overflow-hidden"
                  >
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#00BABC]/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <a 
                      href={`https://companies.intra.42.fr/en/offers/${offer.id}`}
                      target="_blank" rel="noreferrer"
                      className="absolute top-6 right-6 p-2.5 bg-slate-800 text-slate-400 hover:text-[#00BABC] hover:bg-[#00BABC]/10 rounded-2xl transition-all shadow-xl z-20"
                    >
                      <Eye className="w-5 h-5" />
                    </a>

                    <div className="flex flex-wrap gap-2 mb-6">
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-[#00BABC]/10 border border-[#00BABC]/30 text-[#00BABC] text-[10px] font-black uppercase rounded-lg">
                        <Briefcase className="w-3 h-3" /> {offer.contract_type?.replace('_', ' ') || 'Internship'}
                      </span>
                      {offer.is_remote && (
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase rounded-lg">
                          <Globe className="w-3 h-3" /> Remote
                        </span>
                      )}
                      {offer.salary && (
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase rounded-lg">
                          <DollarSign className="w-3 h-3" /> {offer.salary}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mb-4 pr-10">
                      <div className="w-12 h-12 bg-slate-800 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-700/50 group-hover:border-[#00BABC]/30 transition-all">
                        {offer.company_logo ? (
                          <img src={offer.company_logo} alt={offer.company_name} className="w-full h-full object-cover" />
                        ) : (
                          <Briefcase className="w-6 h-6 text-slate-600" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-black text-[#00BABC] uppercase tracking-[0.2em] mb-1 truncate">
                          {offer.company_name}
                        </span>
                        <h3 className="text-xl font-black leading-tight text-white truncate tracking-tight group-hover:text-[#00BABC] transition-colors">
                          {offer.title}
                        </h3>
                      </div>
                    </div>

                    <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-1 line-clamp-4">
                      {offer.little_description}
                    </p>

                    <div className="space-y-4 pt-6 border-t border-slate-800/60 font-black uppercase tracking-widest text-slate-500 text-[10px]">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800/50 rounded-xl">
                          <MapPin className="w-4 h-4 text-[#00BABC]" />
                        </div>
                        <span className="text-xs font-bold text-slate-300 truncate tracking-tight uppercase">
                          {offer.address || `${offer.city}, ${offer.country}`}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                           <Calendar className="w-4 h-4" /> {new Date(offer.created_at).toLocaleDateString('pt-PT')}
                        </div>
                        {offer.invalid_at && (
                          <div className="flex items-center gap-2 text-rose-500/80 bg-rose-500/5 px-2 py-1 rounded-md border border-rose-500/10">
                            <Clock className="w-4 h-4" /> {new Date(offer.invalid_at).toLocaleDateString('pt-PT')}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
            
            {!loading && offers.length === 0 && (
              <div className="text-center py-40 bg-slate-900/20 border-2 border-dashed border-slate-800/50 rounded-[3rem]">
                 <Target className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                 <p className="text-slate-500 font-bold tracking-widest uppercase">No Active Opportunities in this Scope</p>
              </div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default App;
