import React from 'react';

interface FooterCreditProps {
  className?: string;
  hasBottomNav?: boolean;
}

export const FooterCredit: React.FC<FooterCreditProps> = ({
  className = '',
  hasBottomNav = false,
}) => {
  return (
    <footer
      className={`w-full text-center text-xs text-[#78716C] pt-8 ${
        hasBottomNav ? 'pb-28 sm:pb-8' : 'pb-8'
      } ${className}`}
    >
      <span>Made by </span>
      <a
        href="https://nexifysolution.net"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#78716C] hover:text-[#44403C] no-underline hover:underline transition-colors"
      >
        Nexify Solution
      </a>
    </footer>
  );
};
