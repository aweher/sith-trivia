import React, { useEffect } from 'react';

const MatomoTracker = () => {
  useEffect(() => {
    // Inicializar Matomo
    window._mtm = window._mtm || [];
    window._mtm.push({
      'mtm.startTime': new Date().getTime(),
      'event': 'mtm.Start'
    });

    // Cargar el script de Matomo
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://analytics.arreg.la/js/container_4tEKSzbX.js';
    document.head.appendChild(script);

    // Limpiar al desmontar
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return null;
};

export default MatomoTracker; 