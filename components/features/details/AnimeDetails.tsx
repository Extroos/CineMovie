import React, { useState, useEffect, useRef, useMemo } from 'react';
import { triggerHaptic } from '../../../utils/haptics';
import { useGetAnimeDetails } from '@/query/get-anime-details';
import { useGetAnimeBanner } from '@/query/get-banner-anime';
import { useGetEpisodeServers } from '@/query/get-episode-servers';
import { useGetEpisodeData } from '@/query/get-episode-data';
import { useAnimeStore } from '@/store/anime-store';
import KitsunePlayer from '@/components/kitsune-player';
import AnimeEpisodes from '@/components/anime-episodes';
import CharacterCard from '@/components/common/character-card';
import AnimeCard from '@/components/anime-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ROUTES } from '@/constants/routes';
import { ChevronLeft, Play, Info, Heart, Share2, MoreHorizontal, Subtitles, Mic, Plus } from 'lucide-react';
import { COLORS } from '../../../constants';
import BlurFade from '@/components/ui/blur-fade';
import { useGetAllEpisodes } from '@/query/get-all-episodes';
import Container from '@/components/container';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AnimeDetailsProps {
  anime: any; // Simplified anime object from search / home
  onClose: () => void;
}

export default function AnimeDetails({ anime, onClose }: AnimeDetailsProps) {
  const [view, setView] = useState<'overview' | 'episodes'>('overview');
  const [showPlayer, setShowPlayer] = useState(false);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [subOrDub, setSubOrDub] = useState<'sub' | 'dub'>('sub');
  const [activeServer, setActiveServer] = useState<string | undefined>(undefined);
  
  const animeId = anime.id.toString();
  const { data: details, isLoading: detailsLoading } = useGetAnimeDetails(animeId);
  const { data: episodesData, isLoading: episodesLoading } = useGetAllEpisodes(animeId);
  const { data: banner, isLoading: bannerLoading } = useGetAnimeBanner(details?.anime.info.anilistId!);
  
  const { data: serversData, isLoading: serversLoading } = useGetEpisodeServers(selectedEpisodeId!);
  const { data: episodeData, isLoading: episodeDataLoading } = useGetEpisodeData(
    selectedEpisodeId!,
    activeServer || serversData?.sub?.[0]?.serverName || serversData?.dub?.[0]?.serverName,
    subOrDub
  );

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  const handleEpisodeClick = (episodeId: string) => {
    triggerHaptic('medium');
    setSelectedEpisodeId(episodeId);
    setShowPlayer(true);
  };

  const handleBack = () => {
    triggerHaptic('light');
    onClose();
  };

  const { anime: info, seasons, relatedAnimes, recommendedAnimes } = details || { seasons: [], relatedAnimes: [], recommendedAnimes: [] };
  const bannerImage = (banner?.Media.bannerImage as string) || info?.info?.poster || anime.image;

  const animeInfo = useMemo(() => ({
    title: info?.info?.name || anime.name || anime.title,
    image: info?.info?.poster || anime.image || anime.poster,
    id: animeId
  }), [info?.info?.name, info?.info?.poster, animeId, anime.name, anime.title, anime.image, anime.poster]);

  if (detailsLoading || !details) {
    return (
      <div className="fixed inset-0 z-[4000] bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div 
      onClick={handleBack}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 4000,
        background: 'rgba(10, 10, 10, 0.6)',
        backdropFilter: 'blur(25px) saturate(240%) brightness(1.1)',
        WebkitBackdropFilter: 'blur(20px) saturate(220%) brightness(0.9)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overflowX: 'hidden',
        animation: 'detailsIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'opacity, transform',
      }}
      className="no-scrollbar"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          minHeight: '100vh',
          background: '#0a0a0a',
          position: 'relative',
          width: '100%',
          maxWidth: '100%',
        }}
      >
        {/* Navigation Back/Close Button */}
        <button
          onClick={handleBack}
          aria-label="Back"
          style={{
            position: 'fixed',
            top: 'calc(1.5rem + env(safe-area-inset-top, 24px))',
            right: '1.5rem',
            zIndex: 4001,
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(15px) saturate(220%)',
            WebkitBackdropFilter: 'blur(15px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
          className="active:scale-95"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>

        {/* Cinematic Backdrop */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '45vh',
          maxHeight: '500px',
        }}>
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <img
                  src={bannerImage}
                  alt={info.info.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: 0.8
                  }}
                />
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(to bottom, rgba(10,10,10,0.2) 0%, rgba(10,10,10,0.6) 60%, #0a0a0a 100%)',
                }} />
             </div>
        </div>

        {/* Content Container */}
        <div style={{
          position: 'relative',
          marginTop: '-100px',
          animation: 'detailsIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
          animationDelay: '0.1s',
          padding: '0 5% 4rem',
          zIndex: 2,
          maxWidth: '100%',
        }}>
          {view === 'overview' ? (
            <>
              {/* Title */}
              <h1 style={{
                fontSize: 'clamp(1.5rem, 6vw, 3.5rem)',
                fontWeight: 950,
                lineHeight: 1.1,
                color: '#fff',
                marginBottom: '0.75rem',
                textShadow: '0 4px 12px rgba(0,0,0,0.6)',
                letterSpacing: '-0.02em',
              }} className="italic uppercase">
                {info.info.name}
              </h1>

              {/* Metadata */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '1.5rem',
                fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
                fontWeight: 700,
                color: '#e5e5e5',
              }}>
                 <span style={{ color: '#46d369' }}>
                   {info.info.stats.rating} Match
                 </span>
                 <span>{info.moreInfo.aired?.split(',')[1]?.trim() || info.moreInfo.aired}</span>
                 <span style={{ opacity: 0.5 }}>|</span>
                 <span>{info.info.stats.quality}</span>
                 <span style={{ opacity: 0.5 }}>|</span>
                 <div className="flex items-center gap-1">
                    <Subtitles className="w-3.5 h-3.5" />
                    <span>{info.info.stats.episodes.sub}</span>
                 </div>
                 {info.info.stats.episodes.dub > 0 && (
                    <div className="flex items-center gap-1">
                        <Mic className="w-3.5 h-3.5" />
                        <span>{info.info.stats.episodes.dub}</span>
                    </div>
                 )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
                 <button
                   onClick={() => {
                     const firstEp = episodesData?.episodes?.[0];
                     if (firstEp) handleEpisodeClick(firstEp.episodeId);
                   }}
                   style={{
                      flex: '1 1 auto',
                      minWidth: '120px',
                      maxWidth: '200px',
                      padding: '12px 24px',
                      backgroundColor: '#fff',
                      color: '#000',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 20px rgba(255, 255, 100, 0.1)',
                      fontSize: '1rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'transform 0.2s',
                    }}
                    className="active:scale-95"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    {episodesLoading ? 'Loading...' : 'Play Now'}
                  </button>

                  <button
                    onClick={() => setView('episodes')}
                    style={{
                      padding: '12px 24px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(20px)',
                      color: '#fff',
                      border: '1.5px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    className="active:scale-95"
                  >
                    <Info className="w-5 h-5" />
                    Episodes
                  </button>

                  <button
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      border: '1.5px solid rgba(255, 255, 255, 0.3)',
                      background: 'rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(20px)',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}
                    className="active:scale-90"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 'clamp(2rem, 5vw, 4rem)',
                width: '100%',
              }}>
                 {/* Left Column: Story & Info */}
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Synopsis</h3>
                        <p style={{ 
                           fontSize: '1.05rem', 
                           lineHeight: '1.6', 
                           color: 'rgba(255,255,255,0.8)', 
                           fontWeight: 500
                         }}>
                           {info.info.description}
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                       {info.moreInfo.genres?.map((g, i) => (
                          <span key={i} style={{
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            color: '#fff',
                            padding: '8px 20px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1.5px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '40px',
                          }}>
                            {g}
                          </span>
                       ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', opacity: 0.8 }}>
                        <div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Studios</span>
                            <p style={{ color: '#fff', fontWeight: 600 }}>{info.moreInfo.studios}</p>
                        </div>
                        <div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Status</span>
                            <p style={{ color: '#fff', fontWeight: 600 }}>{info.moreInfo.status}</p>
                        </div>
                    </div>
                 </div>

                 {/* Right Column: Characters & More */}
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                    {/* Character Section */}
                    {info.info.charactersVoiceActors.length > 0 && (
                      <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Characters</h3>
                        <div style={{
                            display: 'flex',
                            overflowX: 'auto',
                            gap: '24px',
                            paddingBottom: '1rem',
                            scrollSnapType: 'x mandatory',
                            WebkitOverflowScrolling: 'touch',
                          }} className="no-scrollbar">
                           {info.info.charactersVoiceActors.slice(0, 15).map((char, idx) => (
                              <div 
                                 key={idx} 
                                 style={{ 
                                   width: '100px',
                                   flexShrink: 0,
                                   scrollSnapAlign: 'start',
                                   textAlign: 'center'
                                 }}
                              >
                                 <img 
                                   src={char.character.poster}
                                   alt={char.character.name}
                                   style={{
                                     width: '100px',
                                     height: '100px',
                                     borderRadius: '50%',
                                     objectFit: 'cover',
                                     border: '2px solid rgba(255, 255, 255, 0.1)',
                                     boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                                     marginBottom: '10px'
                                   }}
                                 />
                                 <div style={{
                                     fontSize: '0.8rem',
                                     fontWeight: 700,
                                     color: '#e5e5e5',
                                     lineHeight: 1.2,
                                     wordBreak: 'break-word',
                                 }}>
                                   {char.character.name}
                                 </div>
                              </div>
                           ))}
                        </div>
                      </div>
                    )}

                    {/* More Like This */}
                    {(recommendedAnimes.length > 0) && (
                      <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Recommendations</h3>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '12px',
                        }}>
                           {recommendedAnimes.slice(0, 6).map((ani, idx) => (
                             <div 
                               key={idx}
                               onClick={() => {
                                 onClose();
                                 window.location.href = `${ROUTES.ANIME_DETAILS}/${ani.id}`;
                               }}
                               style={{
                                 aspectRatio: '2/3',
                                 borderRadius: '12px',
                                 overflow: 'hidden',
                                 position: 'relative',
                                 cursor: 'pointer',
                                 border: '1px solid rgba(255, 255, 255, 0.1)',
                                 boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                               }}
                             >
                                <img 
                                  src={ani.poster}
                                  alt={ani.name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                             </div>
                           ))}
                        </div>
                      </div>
                    )}
                 </div>
              </div>
            </>
          ) : (
            <div style={{ animation: 'detailsIn 0.5s ease both' }}>
                <div style={{ 
                    position: 'sticky', 
                    top: '-100px', 
                    zIndex: 100, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '1.5rem 0',
                    background: 'linear-gradient(to bottom, #0a0a0a 80%, transparent)',
                    marginBottom: '2rem'
                }}>
                    <button 
                        onClick={() => setView('overview')}
                        style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <ChevronLeft className="w-6 h-6" />
                        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Back to Overview</span>
                    </button>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                            onClick={() => setSubOrDub(subOrDub === 'sub' ? 'dub' : 'sub')}
                            style={{
                                background: subOrDub === 'dub' ? '#E50914' : 'rgba(255,255,255,0.1)',
                                color: '#fff',
                                border: '1.5px solid ' + (subOrDub === 'dub' ? '#E50914' : 'rgba(255,255,255,0.2)'),
                                padding: '8px 16px',
                                fontWeight: 800,
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                            }}
                        >
                            {subOrDub === 'dub' ? 'DUBBED' : 'SUBBED'}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {episodesLoading ? (
                        <div style={{ textAlign: 'center', padding: '5rem', color: 'rgba(255,255,255,0.3)' }}>
                            <div className="w-10 h-10 border-4 border-white/10 border-t-white rounded-full animate-spin mx-auto mb-4" />
                            <p className="font-bold underline tracking-widest italic">INDEXING EPISODES...</p>
                        </div>
                    ) : (
                        episodesData?.episodes.map((ep) => (
                            <div 
                                key={ep.episodeId}
                                onClick={() => handleEpisodeClick(ep.episodeId)}
                                style={{
                                    display: 'flex',
                                    gap: '20px',
                                    padding: '16px',
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: '16px',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                className="hover:bg-white/[0.07] active:scale-[0.98]"
                            >
                                <div style={{ 
                                    width: '180px', 
                                    aspectRatio: '16/9', 
                                    background: '#1a1a1a', 
                                    borderRadius: '10px', 
                                    overflow: 'hidden',
                                    flexShrink: 0,
                                    position: 'relative'
                                }}>
                                    <img 
                                        src={bannerImage} 
                                        alt={ep.title} 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} 
                                    />
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifySelf: 'center', pointerEvents: 'none' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifySelf: 'center', margin: 'auto' }}>
                                            <Play className="w-4 h-4 text-white fill-current ml-1" />
                                        </div>
                                    </div>
                                    <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.8)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                                        EP {ep.number}
                                    </div>
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
                                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span>{ep.title}</span>
                                        {ep.isFiller && <Badge className="bg-orange-500/20 text-orange-400 border-none text-[10px] uppercase">Filler</Badge>}
                                    </h4>
                                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', margin: 0, fontWeight: 600 }}>
                                        Episode {ep.number}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
          )}
        </div>
      </div>

       {/* Video Player Overlay */}
       {showPlayer && selectedEpisodeId && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-[5000] bg-black flex flex-col animate-in fade-in duration-300"
        >
           {/* Player Header - Safe Area Aware */}
           <div className="absolute top-0 left-0 right-0 p-6 pt-[calc(env(safe-area-inset-top,24px)+1.5rem)] flex items-center justify-between z-[5100]">
              <button 
                onClick={() => setShowPlayer(false)}
                className="p-3 bg-black/60 backdrop-blur-xl rounded-full border border-white/10 hover:bg-black/80 transition-all active:scale-90"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
           </div>

          {(episodeDataLoading || serversLoading) ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
               <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
               <p className="text-white/60 font-medium tracking-wide font-mono italic">SYNCING STREAM...</p>
            </div>
          ) : episodeData && serversData ? (
            <div className="flex-1 flex items-center justify-center">
              <KitsunePlayer
                episodeInfo={episodeData}
                animeInfo={animeInfo}
                subOrDub={subOrDub}
                serversData={serversData}
                onClose={() => setShowPlayer(false)}
                className="w-full h-full max-h-none aspect-auto" 
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center bg-[#0a0a0a]">
               <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-2">
                 <Info className="w-10 h-10 text-red-500" />
               </div>
               <div className="space-y-1">
                 <p className="text-white text-2xl font-black italic">LINK BROKEN</p>
                 <p className="text-white/40 max-w-md">The source stream could not be established. Please try a different server or check your connection.</p>
               </div>
               <Button 
                 onClick={() => setShowPlayer(false)} 
                 className="bg-white text-black hover:bg-white/90 px-8 py-3 rounded-2xl font-bold transition-all active:scale-95"
               >
                 Go Back
               </Button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes detailsIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
