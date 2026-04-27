import React from 'react';

export const Spinner: React.FC = () => (
  <div className="flex items-center justify-center py-16">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rdpc-blue" />
  </div>
);
