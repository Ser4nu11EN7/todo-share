'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  position?: TooltipPosition;
  className?: string;
  persistOnHover?: boolean; // 是否在鼠标离开时保持显示
}

const Tooltip = ({ 
  children, 
  content, 
  position = 'top', 
  className = '',
  persistOnHover = false // 默认鼠标离开时关闭
}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  
  // 客户端挂载检测
  useEffect(() => {
    setIsMounted(true);
    
    // 检测是否为触摸设备
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    
    return () => {
      setIsMounted(false);
    };
  }, []);

  // 计算提示框位置 - 简化版，分离桌面和移动设备的处理
  const updateTooltipPosition = () => {
    if (!triggerRef.current) return;
    
    const rect = triggerRef.current.getBoundingClientRect();
    let x: number;
    let y: number;
    
    // 基于rect计算位置（视口坐标）
    switch (position) {
      case 'top':
        x = rect.left + rect.width / 2;
        y = rect.top - 10;
        break;
      case 'bottom':
        x = rect.left + rect.width / 2;
        y = rect.bottom + 10;
        break;
      case 'left':
        x = rect.left - 10;
        y = rect.top + rect.height / 2;
        break;
      case 'right':
        x = rect.right + 10;
        y = rect.top + rect.height / 2;
        break;
      default:
        x = rect.left + rect.width / 2;
        y = rect.top - 10;
    }
    
    setTooltipPosition({ x, y });
  };

  // 处理鼠标事件
  const handleMouseEnter = () => {
    updateTooltipPosition();
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    // 如果未设置persistOnHover，则鼠标离开时关闭提示框
    if (!persistOnHover) {
      setIsVisible(false);
    }
  };
  
  // 处理点击事件（用于触摸设备）
  const handleClick = (e: React.MouseEvent) => {
    if (isTouchDevice) {
      e.preventDefault();
      updateTooltipPosition();
      setIsVisible(true);
    }
  };
  
  // 处理触摸事件
  const handleTouch = (e: React.TouchEvent) => {
    if (isTouchDevice) {
      e.preventDefault();
      updateTooltipPosition();
      setIsVisible(true);
    }
  };

  // 设置点击空白区域隐藏提示框（针对触摸设备）
  useEffect(() => {
    if (isTouchDevice && isVisible) {
      const handleOutsideClick = (e: MouseEvent) => {
        if (
          triggerRef.current && 
          !triggerRef.current.contains(e.target as Node)
        ) {
          setIsVisible(false);
        }
      };
      
      document.addEventListener('click', handleOutsideClick);
      return () => {
        document.removeEventListener('click', handleOutsideClick);
      };
    }
  }, [isVisible, isTouchDevice]);

  // 计算提示框和箭头样式
  const getTooltipStyle = () => {
    const { x, y } = tooltipPosition;
    let transform = '';
    let arrowStyle = {};
    
    switch (position) {
      case 'top':
        transform = 'translate(-50%, -100%)';
        arrowStyle = {
          bottom: '-5px',
          left: '50%',
          transform: 'translateX(-50%) rotate(45deg)'
        };
        break;
      case 'bottom':
        transform = 'translate(-50%, 0)';
        arrowStyle = {
          top: '-5px',
          left: '50%',
          transform: 'translateX(-50%) rotate(45deg)'
        };
        break;
      case 'left':
        transform = 'translate(-100%, -50%)';
        arrowStyle = {
          right: '-5px',
          top: '50%',
          transform: 'translateY(-50%) rotate(45deg)'
        };
        break;
      case 'right':
        transform = 'translate(0, -50%)';
        arrowStyle = {
          left: '-5px',
          top: '50%',
          transform: 'translateY(-50%) rotate(45deg)'
        };
        break;
    }
    
    return {
      tooltipStyle: {
        position: 'fixed' as const,
        left: `${x}px`,
        top: `${y}px`,
        transform,
        zIndex: 99999
      },
      arrowStyle
    };
  };

  return (
    <div 
      ref={triggerRef}
      className={`inline-block relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onTouchStart={handleTouch}
    >
      {children}
      
      {isMounted && isVisible && createPortal(
        <div 
          ref={tooltipRef}
          className="pointer-events-none transition-opacity duration-200"
          style={{
            ...getTooltipStyle().tooltipStyle,
            opacity: isVisible ? 1 : 0
          }}
        >
          <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
            {content}
            <div 
              className="absolute w-2.5 h-2.5 bg-gray-800" 
              style={getTooltipStyle().arrowStyle}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Tooltip; 