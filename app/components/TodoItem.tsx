'use client';

import { Todo } from './TodoList';
import { useAuth } from '../context/AuthContext';
import { useState, useRef, useEffect } from 'react';
import RecurrenceSelector, { RecurrenceConfig } from './RecurrenceSelector';
import dynamic from 'next/dynamic';
import Tooltip from './ui/Tooltip';

// 懒加载ItemHeatmap组件
const ItemHeatmap = dynamic(() => import('./ItemHeatmap'), {
  loading: () => <div className="text-center py-2 text-gray-500 text-sm">加载热力图...</div>,
  ssr: false
});

type TodoItemProps = {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newText: string, newRecurrence?: RecurrenceConfig) => void;
  userColor?: string;
  memberColors?: Record<string, string>;
  memberNames?: Record<string, string>;
};

const TodoItem = ({ 
  todo, 
  onToggle, 
  onDelete, 
  onEdit,
  userColor = 'bg-blue-500', 
  memberColors = {},
  memberNames = {}
}: TodoItemProps) => {
  const { user } = useAuth();
  const userId = user?.uid || '';
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const [editRecurrence, setEditRecurrence] = useState<RecurrenceConfig>(todo.recurrence || { type: 'once' });
  const editInputRef = useRef<HTMLInputElement>(null);
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  const [isHeatmapOpen, setIsHeatmapOpen] = useState(false);
  
  // 使用传入的用户颜色或默认颜色
  const currentUserColor = userColor;
  
  // 当前用户是否已标记完成
  const userCompleted = todo.completedBy?.includes(userId) || false;
  
  // 当前用户是否已标记删除
  const userMarkedDelete = todo.deletedBy?.includes(userId) || false;
  
  // 是否显示删除线 (至少一个人标记删除)
  const showDeleteLine = (todo.deletedBy?.length || 0) > 0;
  
  // 计算待办事项文本的样式
  const textStyle = showDeleteLine ? 'line-through text-gray-500' : '';
  
  // 计算是否为创建者且在三分钟内可快速删除
  const isCreator = todo.createdById === userId;
  const creationTime = todo.createdAt || 0;
  const currentTime = Date.now();
  const threeMinutesInMs = 3 * 60 * 1000; // 3分钟，单位毫秒
  const timeLeft = Math.max(0, threeMinutesInMs - (currentTime - creationTime));
  const canQuickDelete = isCreator && timeLeft > 0;
  const quickDeleteTimeLeftSeconds = Math.ceil(timeLeft / 1000);
  
  // 添加倒计时更新器
  const [timeLeftDisplay, setTimeLeftDisplay] = useState(quickDeleteTimeLeftSeconds);
  
  // 如果在快速删除窗口内，添加倒计时定时器
  useEffect(() => {
    if (!canQuickDelete) return;
    
    // 每秒更新倒计时显示
    const timer = setInterval(() => {
      const newCurrentTime = Date.now();
      const newTimeLeft = Math.max(0, threeMinutesInMs - (newCurrentTime - creationTime));
      const newTimeLeftSeconds = Math.ceil(newTimeLeft / 1000);
      
      setTimeLeftDisplay(newTimeLeftSeconds);
      
      // 如果时间到了，清除定时器
      if (newTimeLeft <= 0) {
        clearInterval(timer);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [canQuickDelete, creationTime, threeMinutesInMs]);
  
  // 编辑模式激活时自动聚焦输入框
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [isEditing]);
  
  // 当todo变化时更新本地状态
  useEffect(() => {
    setEditText(todo.text);
    setEditRecurrence(todo.recurrence || { type: 'once' });
  }, [todo]);

  const handleToggle = () => {
    if (!isEditing) {
      onToggle(todo.id, userCompleted);
    }
  };
  
  const handleDelete = () => {
    onDelete(todo.id);
  };
  
  const handleEdit = () => {
    setIsEditing(true);
  };
  
  const handleSaveEdit = () => {
    if (editText.trim() !== '') {
      onEdit(todo.id, editText.trim(), editRecurrence);
      setIsEditing(false);
    }
  };
  
  const handleCancelEdit = () => {
    setEditText(todo.text);
    setEditRecurrence(todo.recurrence || { type: 'once' });
    setIsEditing(false);
  };
  
  const handleToggleHeatmap = () => {
    setIsHeatmapOpen(!isHeatmapOpen);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent, action: 'toggle' | 'delete' | 'edit' | 'heatmap') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (action === 'toggle') {
        handleToggle();
      } else if (action === 'delete') {
        handleDelete();
      } else if (action === 'edit' && isEditing) {
        handleSaveEdit();
      } else if (action === 'heatmap') {
        handleToggleHeatmap();
      }
    } else if (e.key === 'Escape' && isEditing) {
      handleCancelEdit();
    }
  };
  
  // 获取所有用户的完成状态信息
  const allCompletedUsers = todo.completedBy || [];
  
  // 获取其他用户的完成状态（除当前用户外）
  const otherCompletedUsers = allCompletedUsers.filter(uid => uid !== userId);
  
  // 获取用户显示名称，如果没有提供则使用默认名称
  const getUserName = (uid: string) => {
    return memberNames[uid] || '其他用户';
  };

  // 获取用户颜色
  const getUserColor = (uid: string) => {
    return memberColors[uid] || 'bg-gray-500';
  };
  
  // 获取重复类型显示文本
  const getRecurrenceText = () => {
    const recurrence = todo.recurrence || { type: 'once' };
    switch (recurrence.type) {
      case 'once':
        return '一次性'; // 一次性任务显示文本
      case 'daily':
        return '每天';
      case 'custom':
        return `每${recurrence.interval}天`;
      case 'weekly':
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const selectedDays = recurrence.weekdays?.map(d => days[d]).join(', ') || '';
        return `每周${selectedDays}`;
    }
  };
  
  // 渲染完成标记小方块
  const renderCompletionMarker = (uid: string, isCurrent = false) => {
    const color = getUserColor(uid);
    const name = getUserName(uid);
    
    return (
      <Tooltip
        key={uid}
        content={isCurrent ? '您已标记完成' : `${name}已标记完成`}
        position="top"
      >
        <div 
          className={`w-5 h-5 rounded-md ${color} flex items-center justify-center transition-transform duration-200 hover:scale-110 mx-1`}
          onMouseEnter={() => setHoveredUserId(uid)}
          onMouseLeave={() => setHoveredUserId(null)}
          role="img"
          aria-label={`${isCurrent ? '您' : name}已标记完成`}
        >
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </Tooltip>
    );
  };
  
  // 检查是否为周期性任务
  const isRecurringTask = todo.recurrence?.type !== 'once';
  
  return (
    <li className="flex flex-col bg-gray-50 rounded-md shadow-sm hover:bg-gray-100 transition-colors overflow-hidden">
      {/* 主要任务区域 */}
      <div className="p-4 flex items-start justify-between">
        {/* 左侧区域：完成框、周期图标和项目名称 */}
        <div className="flex items-center flex-grow">
          {/* 1. 完成框 - 用于勾选/取消完成 */}
          <div 
            className={`flex-shrink-0 w-5 h-5 border rounded-md cursor-pointer flex items-center justify-center ${
              userCompleted ? currentUserColor : 'border-gray-300'
            }`}
            onClick={!isEditing ? handleToggle : undefined}
            onKeyDown={!isEditing ? (e) => handleKeyDown(e, 'toggle') : undefined}
            tabIndex={!isEditing ? 0 : -1}
            role={!isEditing ? "checkbox" : undefined}
            aria-checked={!isEditing ? userCompleted : undefined}
            aria-label={!isEditing ? `标记待办事项: ${todo.text}` : undefined}
            title={userCompleted ? `取消标记完成` : '标记完成'}
          >
            {userCompleted && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          
          {/* 2. 项目名称和重复类型 */}
          {isEditing ? (
            <div className="flex-1 flex flex-col ml-3">
              <input
                ref={editInputRef}
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'edit')}
                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="编辑待办事项"
              />
              <div className="mt-2">
                <RecurrenceSelector
                  value={editRecurrence}
                  onChange={setEditRecurrence}
                />
              </div>
              <div className="flex mt-2">
                <button
                  onClick={handleSaveEdit}
                  className="p-1 text-green-600 hover:text-green-800 focus:outline-none"
                  aria-label="保存更改"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1 text-red-600 hover:text-red-800 focus:outline-none ml-1"
                  aria-label="取消编辑"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center ml-3">
              {/* 周期图标 */}
              {isRecurringTask && (
                <Tooltip content={getRecurrenceText()} position="top">
                  <button 
                    className="inline-flex mr-2 text-gray-500 focus:outline-none" 
                    onClick={() => alert(getRecurrenceText())} // 点击时显示信息，适合手机端
                    aria-label={getRecurrenceText()}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </Tooltip>
              )}
              
              {/* 项目文本 */}
              <span className={textStyle}>{todo.text}</span>
            </div>
          )}
        </div>
        
        {/* 右侧区域：完成标记、热力图、编辑和删除按钮 */}
        {!isEditing && (
          <div className="flex items-center ml-2">
            {/* 我的完成情况 */}
            {userCompleted && renderCompletionMarker(userId, true)}
            
            {/* 其他用户的完成情况 */}
            {otherCompletedUsers.map(uid => renderCompletionMarker(uid))}
            
            {/* 热力图切换按钮 */}
            {isRecurringTask && (
              <Tooltip content={isHeatmapOpen ? "收起热力图" : "展开热力图"} position="top">
                <button
                  onClick={handleToggleHeatmap}
                  onKeyDown={(e) => handleKeyDown(e, 'heatmap')}
                  className={`flex items-center justify-center w-8 h-8 ml-2 mr-2 rounded-md border-2 focus:outline-none transition-all transform hover:scale-110 ${
                    isHeatmapOpen 
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-md' 
                      : 'border-indigo-400 bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  }`}
                  aria-expanded={isHeatmapOpen}
                  aria-label={isHeatmapOpen ? "收起热力图" : "展开热力图"}
                  tabIndex={0}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              </Tooltip>
            )}
            
            {/* 编辑按钮 */}
            <Tooltip content="编辑" position="top">
              <button
                onClick={handleEdit}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full focus:outline-none"
                aria-label={`编辑待办事项: ${todo.text}`}
                tabIndex={0}
                onKeyDown={(e) => handleKeyDown(e, 'edit')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </Tooltip>
            
            {/* 删除按钮 */}
            <Tooltip content={
              userMarkedDelete 
                ? "取消删除" 
                : canQuickDelete 
                  ? `快速删除 (还剩${Math.floor(timeLeftDisplay/60)}分${timeLeftDisplay%60}秒)` 
                  : "删除"
            } position="top">
              <button
                onClick={handleDelete}
                onKeyDown={(e) => handleKeyDown(e, 'delete')}
                className={`ml-1 p-1.5 rounded-full focus:outline-none ${
                  userMarkedDelete 
                    ? 'text-red-700 bg-red-100' 
                    : canQuickDelete
                      ? 'text-red-600 bg-red-50 hover:bg-red-100'
                      : 'text-red-500 hover:text-red-700 hover:bg-red-100'
                }`}
                aria-label={
                  userMarkedDelete 
                    ? "取消删除标记" 
                    : canQuickDelete 
                      ? `快速删除 (还剩${timeLeftDisplay}秒)` 
                      : "标记删除"
                }
                tabIndex={0}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </Tooltip>
          </div>
        )}
      </div>
      
      {/* 任务热力图区域 */}
      {isRecurringTask && (
        <ItemHeatmap 
          todo={todo}
          isOpen={isHeatmapOpen}
          memberColors={memberColors}
          memberNames={memberNames}
          userId={userId}
        />
      )}
    </li>
  );
};

export default TodoItem;