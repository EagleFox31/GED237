// frontend/profiles/tenant-admin/pages/GEDRulesPage.tsx
import React, { useState } from 'react';
import TemplatesTab from './gedrules/TemplatesTab';
import RulesTab from './gedrules/RulesTab';
import SimulatorTab from './gedrules/SimulatorTab';
import CategoriesTab from './gedrules/CategoriesTab';

const GEDRulesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'categories' | 'templates' | 'rules' | 'simulator'>('categories');

  return (
    <div className="p-8 pb-32 flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase italic flex items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-rdpc-blue">directions</span>
            Types de Docs & Aiguillage
          </h1>
          <p className="text-slate-500 font-medium italic mt-2">
            Gérez les différents types de pièces administratives. Chaque type peut déclencher un chemin de validation précis et être distribué automatiquement.
          </p>
        </div>
      </div>

      <div className="flex gap-2.5 mb-6 border-b-2 border-slate-200 shrink-0 overflow-x-auto custom-scrollbar">
        <button
          className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2.5 whitespace-nowrap ${activeTab === 'categories' ? 'text-rdpc-blue border-b-4 border-rdpc-blue mb-[-2px]' : 'text-slate-400 hover:text-slate-700 hover:border-slate-300'}`}
          onClick={() => setActiveTab('categories')}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeTab === 'categories' ? 'bg-rdpc-blue text-white' : 'bg-slate-100 text-slate-500'}`}>1</span>
          Types de documents
        </button>
        <button
          className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2.5 whitespace-nowrap ${activeTab === 'templates' ? 'text-rdpc-blue border-b-4 border-rdpc-blue mb-[-2px]' : 'text-slate-400 hover:text-slate-700 hover:border-slate-300'}`}
          onClick={() => setActiveTab('templates')}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeTab === 'templates' ? 'bg-rdpc-blue text-white' : 'bg-slate-100 text-slate-500'}`}>2</span>
          Circuits de validation
        </button>
        <button
           className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2.5 whitespace-nowrap ${activeTab === 'rules' ? 'text-rdpc-blue border-b-4 border-rdpc-blue mb-[-2px]' : 'text-slate-400 hover:text-slate-700 hover:border-slate-300'}`}
          onClick={() => setActiveTab('rules')}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeTab === 'rules' ? 'bg-rdpc-blue text-white' : 'bg-slate-100 text-slate-500'}`}>3</span>
          Règles d'aiguillage
        </button>
        <button
           className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2.5 whitespace-nowrap ${activeTab === 'simulator' ? 'text-rdpc-blue border-b-4 border-rdpc-blue mb-[-2px]' : 'text-slate-400 hover:text-slate-700 hover:border-slate-300'}`}
          onClick={() => setActiveTab('simulator')}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeTab === 'simulator' ? 'bg-rdpc-blue text-white' : 'bg-slate-100 text-slate-500'}`}>4</span>
          Simulateur
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'categories' && <CategoriesTab />}
        {activeTab === 'templates' && <TemplatesTab />}
        {activeTab === 'rules' && <RulesTab />}
        {activeTab === 'simulator' && <SimulatorTab />}
      </div>
    </div>
  );
};

export default GEDRulesPage;
