import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface MobileHeaderPortalProps {
  children: React.ReactNode;
}

export const MobileHeaderPortal: React.FC<MobileHeaderPortalProps> = ({ children }) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Look up the portal container in the navbar
    const el = document.getElementById('navbar-page-action');
    if (el) {
      setContainer(el);
    } else {
      // In case navbar mounts slightly after
      const timeout = setTimeout(() => {
        setContainer(document.getElementById('navbar-page-action'));
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, []);

  if (!container) return null;
  return createPortal(children, container);
};
