import React from 'react';
import { AvatarTone } from '../types';
import { getInitials } from '../utils/format';

interface RepAvatarProps {
  src: string;
  name: string;
  size?: number;
}

export const RepAvatar: React.FC<RepAvatarProps> = ({ src, name, size = 34 }) => (
  <span className="avatar" style={{ width: size, height: size }} title={name}>
    <img src={src} alt={name} />
  </span>
);

interface ContactAvatarProps {
  name: string;
  tone: AvatarTone;
  size?: number;
}

export const ContactAvatar: React.FC<ContactAvatarProps> = ({ name, tone, size = 34 }) => (
  <span
    className={`avatar avatar--${tone}`}
    style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }}
    title={name}
  >
    {getInitials(name)}
  </span>
);
