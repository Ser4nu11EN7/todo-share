'use client';

import { useState, useRef, useEffect } from 'react';

export type RecurrenceType = 'once' | 'daily' | 'custom' | 'weekly';

export interface RecurrenceConfig {
  type: RecurrenceType;
  interval?: number;       // 适用于custom类型，如每X天
  weekdays?: number[];     // 适用于weekly类型，0-6表示周日到周六
  lastCompleted?: number;  // 上次完成的时间戳
  nextReset?: number;      // 下次重置的时间戳
}

interface RecurrenceSelectorProps {
  value: RecurrenceConfig;
  onChange: (config: RecurrenceConfig) => void;
  disabled?: boolean;
}

const RecurrenceSelector = ({ value, onChange, disabled = false }: RecurrenceSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<RecurrenceType>(value?.type || 'once');
  const [interval, setInterval] = useState<number>(value?.interval || 1);
  const [weekdays, setWeekdays] = useState<number[]>(value?.weekdays || [1]);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 初始化状态
  useEffect(() => {
    if (value) {
      setType(value.type);
      if (value.interval) setInterval(value.interval);
      if (value.weekdays) setWeekdays(value.weekdays);
    }
  }, [value]);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 处理重复类型变更
  const handleTypeChange = (newType: RecurrenceType) => {
    setType(newType);
    
    let newValue: RecurrenceConfig = { type: newType };
    
    if (newType === 'custom') {
      newValue = { ...newValue, interval };
    } else if (newType === 'weekly') {
      newValue = { ...newValue, weekdays };
    }
    
    onChange(newValue);
    if (newType === 'once') {
      setIsOpen(false);
    }
  };

  // 处理自定义间隔变更
  const handleIntervalChange = (newInterval: number) => {
    const validInterval = Math.max(1, newInterval);
    setInterval(validInterval);
    onChange({ 
      type: 'custom', 
      interval: validInterval,
      weekdays: value.weekdays,
      lastCompleted: value.lastCompleted,
      nextReset: value.nextReset
    });
  };

  // 处理每周重复日期变更
  const handleWeekdayToggle = (day: number) => {
    let newWeekdays;
    if (weekdays.includes(day)) {
      // 确保至少保留一天
      if (weekdays.length > 1) {
        newWeekdays = weekdays.filter(d => d !== day);
      } else {
        return; // 不允许删除最后一天
      }
    } else {
      newWeekdays = [...weekdays, day].sort((a, b) => a - b);
    }
    
    setWeekdays(newWeekdays);
    onChange({ 
      type: 'weekly', 
      weekdays: newWeekdays,
      interval: value.interval,
      lastCompleted: value.lastCompleted,
      nextReset: value.nextReset
    });
  };

  // 格式化显示文本
  const getDisplayText = () => {
    switch (type) {
      case 'once':
        return '一次性';
      case 'daily':
        return '每天';
      case 'custom':
        return `每 ${interval} 天`;
      case 'weekly':
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const selectedDays = weekdays.map(d => days[d]).join(', ');
        return `每周 ${selectedDays}`;
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center text-sm ${disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md px-2 py-1`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        disabled={disabled}
      >
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>{getDisplayText()}</span>
        <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute z-10 mt-1 w-56 bg-white rounded-md shadow-lg overflow-hidden">
          <div className="p-2 space-y-1 divide-y divide-gray-100">
            <div className="py-1">
              <button 
                className={`w-full text-left px-3 py-2 text-sm rounded-md ${type === 'once' ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-100'}`}
                onClick={() => handleTypeChange('once')}
              >
                一次性
              </button>
              <button 
                className={`w-full text-left px-3 py-2 text-sm rounded-md ${type === 'daily' ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-100'}`}
                onClick={() => handleTypeChange('daily')}
              >
                每天
              </button>
            </div>
            
            <div className="py-1">
              <button 
                className={`w-full text-left px-3 py-2 text-sm rounded-md ${type === 'custom' ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-100'}`}
                onClick={() => handleTypeChange('custom')}
              >
                自定义间隔
              </button>
              
              {type === 'custom' && (
                <div className="flex items-center mt-2 px-3">
                  <span className="text-sm text-gray-700">每</span>
                  <input 
                    type="number" 
                    min="1" 
                    value={interval} 
                    onChange={(e) => handleIntervalChange(parseInt(e.target.value) || 1)}
                    className="w-16 mx-2 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    aria-label="间隔天数"
                  />
                  <span className="text-sm text-gray-700">天</span>
                </div>
              )}
            </div>
            
            <div className="py-1">
              <button 
                className={`w-full text-left px-3 py-2 text-sm rounded-md ${type === 'weekly' ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-100'}`}
                onClick={() => handleTypeChange('weekly')}
              >
                每周指定日
              </button>
              
              {type === 'weekly' && (
                <div className="flex flex-wrap gap-1 mt-2 px-3 pb-1">
                  {['日', '一', '二', '三', '四', '五', '六'].map((day, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`w-7 h-7 text-xs rounded-full flex items-center justify-center ${
                        weekdays.includes(i) ? 'bg-indigo-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                      onClick={() => handleWeekdayToggle(i)}
                      aria-pressed={weekdays.includes(i)}
                      aria-label={`周${day}`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecurrenceSelector; 