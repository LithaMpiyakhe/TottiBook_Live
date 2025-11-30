import React from 'react';

const TottiLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect width="100" height="100" rx="50" fill="#4E74BF"/>
    <path d="M30 30H70V70H30V30Z" fill="white"/>
    <path d="M40 40H60V60H40V40Z" fill="#4E74BF"/>
    <text x="50" y="55" fontFamily="Arial, sans-serif" fontSize="20" fill="white" textAnchor="middle" dominantBaseline="middle">TS</text>
  </svg>
);

export default TottiLogo;