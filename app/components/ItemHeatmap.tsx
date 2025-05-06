'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Todo } from './TodoList';
import { createPortal } from 'react-dom';

interface ItemHeatmapProps {
  todo: Todo;
  isOpen: boolean;
  memberColors?: Record<string, string>;
  memberNames?: Record<string, string>;
  userId: string;
}

const ItemHeatmap = ({ todo, isOpen, memberColors = {}, memberNames = {}, userId }: ItemHeatmapProps) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [tooltipPosition, setTooltipPosition] = useState<{
    visible: boolean,
    date: string, 
    completedBy: string[], 
    x: number, 
    y: number,
    isPersistent: boolean
  } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // 检查客户端挂载状态
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  
  // 添加一个全局点击事件监听器，用于关闭提示框
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // 只有持久显示的提示框才需要通过全局点击关闭
      if (tooltipPosition && tooltipPosition.isPersistent && 
          !(e.target as HTMLElement).closest('.heatmap-day')) {
        setTooltipPosition(null);
      }
    };
    
    if (isMounted && tooltipPosition && tooltipPosition.isPersistent) {
      document.addEventListener('click', handleGlobalClick);
    }
    
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [isMounted, tooltipPosition]);
  
  // 关闭提示框的辅助函数
  const closeTooltip = () => {
    setTooltipPosition(null);
  };

  // 计算当前年份的热力图数据
  const heatmapData = useMemo(() => {
    // 确保completionHistory存在
    const completionHistory = todo.completionHistory || {};
    
    // 创建日期映射以便快速查找
    const historyMap = new Map<string, {completed: boolean, completedBy: string[]}>();
    Object.entries(completionHistory).forEach(([date, data]) => {
      // 只处理当前选择年份的数据
      if (date.startsWith(year.toString())) {
        // 确保completedBy始终是数组
        const completedBy = data.completedBy || [];
        historyMap.set(date, {
          completed: data.completed || false,
          completedBy
        });
      }
    });
    
    // 获取空间创建者ID（通常是第一个成员）
    const spaceMembers = Object.keys(memberColors || {});
    const creatorId = spaceMembers.length > 0 ? spaceMembers[0] : '';
    
    // 生成整年的日期格式
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const today = new Date().toISOString().split('T')[0];
    
    const days = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      // 如果日期大于今天，则不包括在热力图中
      if (dateStr <= today) {
        const dayData = historyMap.get(dateStr);
        
        const completedBy = dayData ? dayData.completedBy : [];
        // 严格区分创建者和加入者，确保不会混淆
        const creatorCompleted = creatorId && completedBy.includes(creatorId);
        const joinersCompleted = completedBy.some(id => id !== creatorId && id !== '');
        
        days.push({
          date: dateStr,
          completed: dayData ? dayData.completed : false,
          completedBy,
          creatorCompleted,
          joinersCompleted,
          isToday: dateStr === today
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  }, [todo.completionHistory, memberColors, year]);
  
  // 计算统计数据
  const statistics = useMemo(() => {
    if (!heatmapData.length) return null;
    
    const completedDays = heatmapData.filter(day => day.completed).length;
    const totalDays = heatmapData.length;
    const completionRate = totalDays ? Math.round((completedDays / totalDays) * 100) : 0;
    
    // 计算连续天数
    let currentStreak = 0;
    let maxStreak = 0;
    
    // 从今天往回数，计算当前连续天数
    for (let i = heatmapData.length - 1; i >= 0; i--) {
      if (heatmapData[i].completed) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    // 计算最大连续天数
    let tempStreak = 0;
    for (const day of heatmapData) {
      if (day.completed) {
        tempStreak++;
        maxStreak = Math.max(maxStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }
    
    return {
      completionRate,
      completedDays,
      currentStreak,
      maxStreak
    };
  }, [heatmapData]);
  
  // 简化坐标计算，保持桌面端和移动端一致
  const updateTooltipPosition = (element: HTMLElement, date: string, completedBy: string[], isPersistent: boolean) => {
    // 直接使用getBoundingClientRect获取元素位置
    const rect = element.getBoundingClientRect();
    
    // 设置提示框位置 - 使用视口坐标
    setTooltipPosition({
      visible: true,
      date,
      completedBy,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      isPersistent
    });
  };

  // 处理鼠标悬停
  const handleDayMouseEnter = (day: {date: string, completedBy: string[]}, event: React.MouseEvent) => {
    // 如果已经有持久化的提示框，不处理悬停
    if (tooltipPosition && tooltipPosition.isPersistent) return;
    
    const element = event.currentTarget as HTMLElement;
    updateTooltipPosition(element, day.date, day.completedBy, false);
  };
  
  // 处理鼠标离开 - 关闭非持久提示框
  const handleDayMouseLeave = () => {
    // 只有非持久显示的提示框才在鼠标离开时关闭
    if (tooltipPosition && !tooltipPosition.isPersistent) {
      setTooltipPosition(null);
    }
  };
  
  // 处理日期点击 - 使提示框持久显示
  const handleDayClick = (day: {date: string, completedBy: string[]}, event: React.MouseEvent) => {
    event.stopPropagation(); // 防止冒泡
    
    const element = event.currentTarget as HTMLElement;
    updateTooltipPosition(element, day.date, day.completedBy, true);
  };
  
  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };
  
  // 如果热力图没有打开，返回null
  if (!isOpen) return null;

  // 检查是否有完成历史
  const hasHistory = todo.completionHistory && Object.keys(todo.completionHistory).length > 0;
  
  // 获取用户名称
  const spaceMembers = Object.keys(memberColors);
  const creatorId = spaceMembers.length > 0 ? spaceMembers[0] : '';
  const creatorName = memberNames[creatorId] || '创建者';
  const joinerName = Object.keys(memberNames).filter(id => id !== creatorId).map(id => memberNames[id]).join('/') || '参与者';

  return (
    <div className="mt-2 mb-4 bg-gray-50 p-3 rounded-md">
      {/* 年份选择器 */}
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm font-medium text-gray-700">任务完成记录</div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setYear(prev => prev - 1)}
            className="p-1 rounded-md hover:bg-gray-200 focus:outline-none"
            aria-label="上一年"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <span className="text-sm text-gray-600">{year}年</span>
          
          <button 
            onClick={() => setYear(prev => prev + 1)}
            disabled={year >= new Date().getFullYear()}
            className={`p-1 rounded-md focus:outline-none ${
              year >= new Date().getFullYear() 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:bg-gray-200'
            }`}
            aria-label="下一年"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* 热力图 */}
      {hasHistory ? (
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-cols-53 gap-1 min-w-max" style={{ gridTemplateColumns: 'repeat(53, minmax(8px, 1fr))' }}>
            {heatmapData.map((day, index) => (
              <div
                key={day.date}
                style={{ 
                  gridColumn: `${Math.floor(index / 7) + 1} / span 1`,
                  gridRow: `${index % 7 + 1} / span 1`
                }}
                className="heatmap-day w-4 h-4 rounded-sm cursor-pointer overflow-hidden flex relative transition-transform duration-150 hover:scale-110 hover:shadow-sm"
                onMouseEnter={(e) => handleDayMouseEnter(day, e)}
                onMouseLeave={handleDayMouseLeave}
                onClick={(e) => handleDayClick(day, e)}
                onTouchStart={(e) => {
                  // 针对触摸设备，确保提示框正确定位
                  const element = e.currentTarget as HTMLElement;
                  
                  // 阻止默认行为，避免触发悬停
                  e.preventDefault();
                  
                  // 直接更新提示框位置
                  updateTooltipPosition(element, day.date, day.completedBy, true);
                }}
                aria-label={`${formatDate(day.date)}: ${day.completedBy.length > 0 ? '已完成' : '未完成'}`}
              >
                {/* 左半圆 - 始终为创建者 */}
                <div className={`w-1/2 h-full ${day.creatorCompleted ? 'bg-green-500' : 'bg-gray-100'} transition-colors duration-150`}></div>
                {/* 右半圆 - 始终为参与者 */}
                <div className={`w-1/2 h-full ${day.joinersCompleted ? 'bg-green-500' : 'bg-gray-100'} transition-colors duration-150`}></div>
                {/* 当天标记 */}
                {day.isToday && (
                  <div className="absolute inset-0 border-2 border-blue-400 rounded-sm pointer-events-none"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-gray-500 text-sm">
          <p>此任务尚无完成记录</p>
          <p className="mt-1">完成任务后数据将显示在此处</p>
        </div>
      )}
      
      {/* 图例说明 */}
      <div className="mt-3 flex items-center justify-center space-x-4 text-xs text-gray-600">
        <div className="flex items-center">
          <div className="w-3 h-3 mr-1 flex overflow-hidden rounded-sm">
            <div className="w-1/2 h-full bg-green-500"></div>
            <div className="w-1/2 h-full bg-gray-100"></div>
          </div>
          <span>{creatorName}已完成</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 mr-1 flex overflow-hidden rounded-sm">
            <div className="w-1/2 h-full bg-gray-100"></div>
            <div className="w-1/2 h-full bg-green-500"></div>
          </div>
          <span>{joinerName}已完成</span>
        </div>
      </div>
      
      {/* 全局悬浮提示 - 使用Portal渲染到body */}
      {isMounted && tooltipPosition && tooltipPosition.visible && createPortal(
        <div 
          className={`fixed z-[99999] px-3 py-2 text-xs text-white bg-gray-800 rounded-md shadow-lg pointer-events-none max-w-[250px] w-auto ${
            tooltipPosition.isPersistent ? 'ring-2 ring-indigo-400' : ''
          }`}
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translateX(-50%) translateY(-100%)'
          }}
        >
          <div className="font-medium text-center">{formatDate(tooltipPosition.date)}</div>
          {tooltipPosition.completedBy.length > 0 ? (
            <div className="mt-1">
              <span className="block mb-1 text-center">完成者:</span>
              <div className="flex flex-wrap justify-center gap-1">
                {tooltipPosition.completedBy.map(id => (
                  <span key={id} className="px-1.5 py-0.5 rounded inline-block" style={{
                    backgroundColor: memberColors[id] ? memberColors[id].replace('bg-', '') : '#9CA3AF',
                    color: '#ffffff'
                  }}>
                    {memberNames[id] || '未知用户'}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center">未完成</div>
          )}
          <div className="absolute w-2.5 h-2.5 bg-gray-800 transform rotate-45 left-1/2 -translate-x-1/2 top-[calc(100%-2px)]"></div>
        </div>,
        document.body
      )}
      
      {/* 简单统计信息 */}
      {statistics && hasHistory && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">完成率: </span>
            <span className="font-medium">{statistics.completionRate}%</span>
          </div>
          <div>
            <span className="text-gray-500">完成天数: </span>
            <span className="font-medium">{statistics.completedDays}天</span>
          </div>
          <div>
            <span className="text-gray-500">当前连续: </span>
            <span className="font-medium">{statistics.currentStreak}天</span>
          </div>
          <div>
            <span className="text-gray-500">最长连续: </span>
            <span className="font-medium">{statistics.maxStreak}天</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemHeatmap; 