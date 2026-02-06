import React from 'react';

const Image = ({ 
  src, 
  alt, 
  width, 
  height, 
  unoptimized, 
  priority, 
  fill, 
  loader, 
  quality, 
  placeholder, 
  blurDataURL, 
  onLoadingComplete, 
  lazyBoundary, 
  lazyRoot, 
  ...props 
}: any) => {
  return (
    <img 
      src={src} 
      alt={alt} 
      width={width} 
      height={height} 
      {...props} 
    />
  );
};

export default Image;
