export const env = (key: string) => {
  // Vite uses import.meta.env
  // Next.js uses process.env or next-runtime-env
  const value = import.meta.env[key] || process.env[key];
  
  // Mapping NEXT_PUBLIC_* to VITE_* if needed
  if (!value && key.startsWith('NEXT_PUBLIC_')) {
    const viteKey = key.replace('NEXT_PUBLIC_', 'VITE_');
    return import.meta.env[viteKey];
  }
  
  return value;
};
