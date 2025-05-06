'use client';

import { useState, useRef, useEffect } from 'react';

// 定义空间类型
type SpaceData = {
  id: string;
  shareId: string;
  members: string[];
  memberColors?: Record<string, string>;
  memberNames?: Record<string, string>;
  status: 'waiting' | 'active';
  createdAt: number;
  name?: string;
};

type DraggableSpaceListProps = {
  spaces: SpaceData[];
  activeSpaceId: string | null;
  userId: string | null;
  onSpaceSelect: (space: SpaceData) => void;
  onCreateSpace: () => void;
  onJoinSpace?: () => void;
};

const DraggableSpaceList = ({
  spaces,
  activeSpaceId,
  userId,
  onSpaceSelect,
  onCreateSpace,
  onJoinSpace
}: DraggableSpaceListProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showCopy, setShowCopy] = useState<string | null>(null);
  
  // 滚动到活动空间
  useEffect(() => {
    if (containerRef.current && activeSpaceId) {
      const activeElement = containerRef.current.querySelector(`[data-space-id="${activeSpaceId}"]`);
      if (activeElement) {
        // 计算需要滚动的位置，使活动空间在可见区域中居中
        const container = containerRef.current;
        const elementOffset = (activeElement as HTMLElement).offsetLeft;
        const elementWidth = (activeElement as HTMLElement).offsetWidth;
        const containerWidth = container.offsetWidth;
        const scrollPosition = elementOffset - (containerWidth / 2) + (elementWidth / 2);
        
        container.scrollTo({
          left: scrollPosition,
          behavior: 'smooth'
        });
      }
    }
  }, [activeSpaceId]);
  
  // 处理鼠标按下事件，开始拖动
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current!.offsetLeft);
    setScrollLeft(containerRef.current!.scrollLeft);
  };
  
  // 处理鼠标移动事件，更新滚动位置
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    
    const x = e.pageX - containerRef.current!.offsetLeft;
    const walk = (x - startX) * 2; // 滚动速度
    containerRef.current!.scrollLeft = scrollLeft - walk;
  };
  
  // 处理鼠标释放事件，结束拖动
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // 处理触摸事件
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].pageX - containerRef.current!.offsetLeft);
    setScrollLeft(containerRef.current!.scrollLeft);
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const x = e.touches[0].pageX - containerRef.current!.offsetLeft;
    const walk = (x - startX) * 2; // 滚动速度
    containerRef.current!.scrollLeft = scrollLeft - walk;
  };
  
  const handleTouchEnd = () => {
    setIsDragging(false);
  };
  
  // 复制共享ID
  const handleCopyShareId = (shareId: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareId)
        .then(() => {
          setShowCopy(shareId);
          setTimeout(() => setShowCopy(null), 2000);
        });
    } else {
      // 回退方案：创建临时文本区域
      const textArea = document.createElement('textarea');
      textArea.value = shareId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setShowCopy(shareId);
      setTimeout(() => setShowCopy(null), 2000);
    }
  };
  
  return (
    <div 
      ref={containerRef}
      className={`pb-4 overflow-x-auto ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex space-x-4 min-w-max">
        {spaces.map(space => (
          <div 
            key={space.id}
            data-space-id={space.id}
            onClick={() => onSpaceSelect(space)}
            className={`flex-shrink-0 w-48 p-4 rounded-lg shadow-sm cursor-pointer transition-all duration-200 ${
              activeSpaceId === space.id ? 'bg-indigo-100 border-2 border-indigo-500' : 'bg-white hover:bg-gray-50 border border-gray-200'
            }`}
            tabIndex={0}
            aria-label={`切换到空间: ${space.name || '未命名空间'}`}
            onKeyDown={(e) => e.key === 'Enter' && onSpaceSelect(space)}
          >
            <div className="flex justify-between items-start">
              <h3 className="text-md font-medium text-gray-900 truncate mb-1">
                {space.name || '未命名空间'}
              </h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyShareId(space.shareId);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full focus:outline-none"
                title="复制共享ID"
                aria-label="复制共享ID"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {showCopy === space.shareId && (
                  <span className="absolute -mt-8 ml-2 px-2 py-1 text-xs bg-gray-800 text-white rounded">已复制!</span>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {space.members.length} 位成员
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {space.members[0] === userId ? '(您创建的)' : '(您加入的)'}
            </p>
          </div>
        ))}
        <div 
          onClick={onCreateSpace}
          className="flex-shrink-0 w-48 p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
          tabIndex={0}
          aria-label="创建新空间"
          onKeyDown={(e) => e.key === 'Enter' && onCreateSpace()}
        >
          <div className="text-center">
            <svg className="w-6 h-6 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="block mt-1 text-sm font-medium text-gray-500">创建新空间</span>
          </div>
        </div>
        {onJoinSpace && (
          <div 
            onClick={onJoinSpace}
            className="flex-shrink-0 w-48 p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
            tabIndex={0}
            aria-label="加入现有空间"
            onKeyDown={(e) => e.key === 'Enter' && onJoinSpace()}
          >
            <div className="text-center">
              <svg className="w-6 h-6 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span className="block mt-1 text-sm font-medium text-gray-500">加入空间</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DraggableSpaceList; 