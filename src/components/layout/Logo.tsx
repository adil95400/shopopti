import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'white';
}

const Logo: React.FC<LogoProps> = ({ size = 'md', variant = 'default' }) => {
  const widthClasses = {
    sm: 'w-28',
    md: 'w-36',
    lg: 'w-44'
  };

  const src = variant === 'white'
    ? '/brand/shopopti-logo-dark.svg'
    : '/brand/shopopti-logo-light.svg';

  return (
    <Link to="/" aria-label="ShopOpti">
      <motion.div
        className="flex items-center"
        whileHover={{ scale: 1.03 }}
        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      >
        <img
          src={src}
          alt="ShopOpti"
          className={`${widthClasses[size]} h-auto select-none`}
          draggable={false}
        />
      </motion.div>
    </Link>
  );
};

export default Logo;
