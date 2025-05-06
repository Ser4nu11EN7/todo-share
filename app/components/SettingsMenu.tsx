'use client';

import { useRef, useState, useEffect } from 'react';
import ColorSelector from './ColorSelector';

type SettingsMenuProps = {
  userName: string;
  userColor: string;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
};

const SettingsMenu = ({
  userName,
  userColor,
  onNameChange,
  onColorChange
}: SettingsMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [nameInput, setNameInput] = useState(userName);
  const [nameSaved, setNameSaved] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 打开/关闭菜单
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  // 当userName从外部更新时，同步更新nameInput
  useEffect(() => {
    setNameInput(userName);
    setNameSaved(true);
  }, [userName]);

  // 处理点击外部关闭菜单
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        // 如果有未保存的名称，提示用户保存
        if (!nameSaved && nameInput.trim() !== userName && nameInput.trim() !== '') {
          const confirmed = window.confirm('您的昵称已修改但未保存，是否保存？');
          if (confirmed) {
            handleSaveName();
          }
        }
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, nameSaved, nameInput, userName]);

  // 处理名称输入变化
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNameInput(e.target.value);
    setNameSaved(e.target.value === userName);
  };

  // 处理保存名称
  const handleSaveName = () => {
    if (nameInput.trim() !== userName && nameInput.trim() !== '') {
      onNameChange(nameInput.trim());
      setNameSaved(true);
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' && e.currentTarget === inputRef.current) {
      handleSaveName();
    }
  };

  return (
    <div className="relative" onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label="设置"
        aria-expanded={isOpen}
        aria-haspopup="true"
        tabIndex={0}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg z-10 border border-gray-200"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="settings-menu"
        >
          <div className="p-4 space-y-4">
            <h3 className="text-lg font-medium text-gray-900">个人设置</h3>
            
            <div>
              <label htmlFor="settingsUserName" className="block text-sm font-medium text-gray-700 mb-1">
                您的昵称
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  id="settingsUserName"
                  type="text"
                  value={nameInput}
                  onChange={handleNameChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="输入您的昵称"
                />
                {!nameSaved && nameInput.trim() !== '' && nameInput.trim() !== userName && (
                  <button
                    onClick={handleSaveName}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs px-2 py-1 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded transition-colors"
                    aria-label="保存昵称"
                  >
                    保存
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">此昵称将用于标识您在共享待办事项中的操作</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                颜色标识
              </label>
              <div className="mt-1">
                <ColorSelector selectedColor={userColor} onChange={onColorChange} />
              </div>
              <p className="mt-1 text-xs text-gray-500">此颜色将用于标识您的操作</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsMenu; 