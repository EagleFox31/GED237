// frontend/profiles/tenant-admin/pages/ClassementPage.tsx
import React from 'react';
import ClassificationSettingsTab from './gedrules/ClassificationSettingsTab';

const ClassementPage: React.FC = () => (
  <div className="p-8 pb-32 flex flex-col h-full animate-in fade-in duration-500">
    <div className="flex justify-between items-center mb-8 shrink-0">
      <div>
        <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase italic flex items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-rdpc-blue">account_tree</span>
          Plan de classement
        </h1>
        <p className="text-slate-500 font-medium italic mt-2">
          Organisez le rangement des documents : définissez les domaines métier, les activités, les règles de classement et testez-les avec le simulateur.
        </p>
      </div>
    </div>

    <div className="flex-1 overflow-hidden">
      <ClassificationSettingsTab />
    </div>
  </div>
);

export default ClassementPage;
