import React from 'react';
import Jdenticon from 'react-jdenticon';

interface AvatarProps {
  email: string;
  size?: number;
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ email, size = 32, className = '' }) => {
  return (
    <Jdenticon value={email} size={size} className={`rounded-full ${className}`} />
  );
};

export default Avatar;
