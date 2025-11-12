'use client'

export function LoadingSpinner() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes stackFromBottom {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.8);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes twinkle {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.3;
            transform: scale(0.8);
          }
        }
        .tree-stack-layer-1 {
          animation: stackFromBottom 0.6s ease-out forwards;
          opacity: 0;
        }
        .tree-stack-layer-2 {
          animation: stackFromBottom 0.6s ease-out 0.3s forwards;
          opacity: 0;
        }
        .tree-stack-layer-3 {
          animation: stackFromBottom 0.6s ease-out 0.6s forwards;
          opacity: 0;
        }
        .tree-stack-layer-4 {
          animation: stackFromBottom 0.6s ease-out 0.9s forwards;
          opacity: 0;
        }
        .tree-stack-layer-5 {
          animation: stackFromBottom 0.6s ease-out 1.2s forwards;
          opacity: 0;
        }
        .tree-light-twinkle {
          animation: twinkle 1.5s ease-in-out infinite;
        }
      `}} />
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      <div className="relative">
        {/* Main Christmas Tree - Stacking Effect */}
        <div className="relative">
          {/* Tree trunk - appears first */}
          <div className="tree-stack-layer-1 absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-8 bg-amber-800 rounded-sm shadow-lg"></div>
          
          {/* Bottom layer - appears second */}
          <div className="tree-stack-layer-2 relative">
            <div className="w-0 h-0 border-l-[40px] border-l-transparent border-r-[40px] border-r-transparent border-b-[60px] border-b-green-600 shadow-lg shadow-green-800/50"></div>
            {/* Lights on bottom layer */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_8px_2px_rgba(250,204,21,0.8)] tree-light-twinkle" style={{ animationDelay: '1.5s' }}></div>
            <div className="absolute top-10 left-[30%] w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_6px_2px_rgba(239,68,68,0.8)] tree-light-twinkle" style={{ animationDelay: '1.8s' }}></div>
            <div className="absolute top-10 right-[30%] w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_6px_2px_rgba(59,130,246,0.8)] tree-light-twinkle" style={{ animationDelay: '2.1s' }}></div>
          </div>
          
          {/* Middle layer - appears third */}
          <div className="tree-stack-layer-3 absolute -top-8 left-1/2 -translate-x-1/2">
            <div className="w-0 h-0 border-l-[30px] border-l-transparent border-r-[30px] border-r-transparent border-b-[45px] border-b-green-500 shadow-lg shadow-green-700/50"></div>
            {/* Lights on middle layer */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_8px_2px_rgba(250,204,21,0.8)] tree-light-twinkle" style={{ animationDelay: '2.4s' }}></div>
            <div className="absolute top-7 left-[25%] w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_6px_2px_rgba(239,68,68,0.8)] tree-light-twinkle" style={{ animationDelay: '2.7s' }}></div>
            <div className="absolute top-7 right-[25%] w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_6px_2px_rgba(59,130,246,0.8)] tree-light-twinkle" style={{ animationDelay: '3s' }}></div>
          </div>
          
          {/* Top layer - appears fourth */}
          <div className="tree-stack-layer-4 absolute -top-16 left-1/2 -translate-x-1/2">
            <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-b-[30px] border-b-green-400 shadow-lg shadow-green-600/50"></div>
            {/* Lights on top layer */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_8px_2px_rgba(250,204,21,0.8)] tree-light-twinkle" style={{ animationDelay: '3.3s' }}></div>
          </div>
          
          {/* Star on top - appears last */}
          <div className="tree-stack-layer-5 absolute -top-20 left-1/2 -translate-x-1/2">
            <div className="relative">
              <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[12px] border-b-yellow-400 shadow-[0_0_12px_4px_rgba(250,204,21,0.9)] tree-light-twinkle" style={{ animationDelay: '3.6s' }}></div>
              <div className="absolute top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[9px] border-b-yellow-300"></div>
            </div>
          </div>
        </div>
        
        {/* Floating ornaments - appear after tree is built */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2" style={{ animation: 'stackFromBottom 0.6s ease-out 1.5s forwards', opacity: 0 }}>
          <div className="relative w-16 h-16">
            <div className="absolute top-0 left-0 w-3 h-3 bg-red-500 rounded-full shadow-[0_0_8px_3px_rgba(239,68,68,0.9)] animate-bounce" style={{ animationDelay: '2.1s', animationDuration: '2s' }}></div>
            <div className="absolute top-2 right-0 w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_8px_3px_rgba(59,130,246,0.9)] animate-bounce" style={{ animationDelay: '2.4s', animationDuration: '2.5s' }}></div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_8px_3px_rgba(250,204,21,0.9)] animate-bounce" style={{ animationDelay: '2.7s', animationDuration: '2.2s' }}></div>
          </div>
        </div>
        
        {/* Loading text - appears last */}
        <div className="absolute top-32 left-1/2 -translate-x-1/2 mt-4" style={{ animation: 'stackFromBottom 0.6s ease-out 1.8s forwards', opacity: 0 }}>
          <p className="text-green-700 font-semibold text-lg animate-pulse">Loading...</p>
        </div>
      </div>
      </div>
    </>
  )
}

