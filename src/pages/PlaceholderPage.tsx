import React from 'react';

const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex items-center justify-center min-h-[400px] text-gray-400 italic">
    {title} - Próximamente
  </div>
);

export default PlaceholderPage;
