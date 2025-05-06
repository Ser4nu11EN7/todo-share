'use client';

import { useState } from 'react';

type ColorOption = {
  name: string;
  class: string;
};

type ColorSelectorProps = {
  selectedColor: string;
  onChange: (colorClass: string) => void;
};

const ColorSelector: React.FC<ColorSelectorProps> = ({ selectedColor, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const colorOptions: ColorOption[] = [
    { name: '蓝色', class: 'bg-blue-500' },
    { name: '绿色', class: 'bg-green-500' },
    { name: '紫色', class: 'bg-purple-500' },
    { name: '黄色', class: 'bg-yellow-500' },
    { name: '粉色', class: 'bg-pink-500' },
    { name: '靛蓝', class: 'bg-indigo-500' },
    { name: '红色', class: 'bg-red-500' },
    { name: '橙色', class: 'bg-orange-500' },
    { name: '青色', class: 'bg-teal-500' },
  ];
  
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };
  
  const handleSelect = (colorClass: string) => {
    onChange(colorClass);
    setIsOpen(false);
  };
  
  const selectedColorOption = colorOptions.find(color => color.class === selectedColor) || colorOptions[0];
  
  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center space-x-2 px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        onClick={toggleDropdown}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="选择颜色"
      >
        <div className={`w-4 h-4 rounded-sm ${selectedColor}`}></div>
        <span className="text-sm text-gray-700">{selectedColorOption.name}</span>
        <svg 
          className="w-4 h-4 text-gray-400" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg">
          <div className="p-2 grid grid-cols-3 gap-1">
            {colorOptions.map((color) => (
              <button
                key={color.class}
                className={`w-8 h-8 rounded-md flex items-center justify-center ${color.class} hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                onClick={() => handleSelect(color.class)}
                aria-label={`选择${color.name}`}
              >
                {selectedColor === color.class && (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorSelector; 