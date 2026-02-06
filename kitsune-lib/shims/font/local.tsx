const localFont = (options: any) => {
  // Simple shim for next/font/local
  // In Vite, we'll rely on global CSS @font-face
  return {
    className: "kitsune-local-font",
    style: { fontFamily: "NightinTokyo" },
  };
};

export default localFont;
