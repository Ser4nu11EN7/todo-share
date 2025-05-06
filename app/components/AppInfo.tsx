'use client';

import { useState } from 'react';
import { getFirebaseConfig } from '../utils/env';

const AppInfo = () => {
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const config = getFirebaseConfig();
  
  const toggleConfig = () => {
    setShowConfig(!showConfig);
  };
  
  // 检查配置是否完整
  const isConfigValid = !!config.apiKey && !!config.authDomain && !!config.projectId;
  
  return (
    <div className="mt-8 p-4 bg-gray-50 rounded-lg shadow-sm text-sm text-gray-600">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Firebase配置状态</h3>
        <button 
          onClick={toggleConfig}
          className="text-indigo-600 hover:text-indigo-800 text-xs"
          aria-label={showConfig ? "隐藏配置信息" : "显示配置信息"}
        >
          {showConfig ? '隐藏详情' : '显示详情'}
        </button>
      </div>
      
      <div className="mt-2">
        <p className={`font-medium ${isConfigValid ? 'text-green-600' : 'text-red-600'}`}>
          {isConfigValid ? '✓ 环境变量加载成功' : '✗ 环境变量加载失败'}
        </p>
        
        {showConfig && (
          <div className="mt-2 space-y-1 bg-gray-100 p-2 rounded">
            <p>API Key: {config.apiKey ? '✓ 已设置' : '未设置'}</p>
            <p>Auth Domain: {config.authDomain ? '✓ 已设置' : '未设置'}</p>
            <p>Project ID: {config.projectId ? '✓ 已设置' : '未设置'}</p>
            <p>Storage Bucket: {config.storageBucket ? '✓ 已设置' : '未设置'}</p>
            <p>Messaging Sender ID: {config.messagingSenderId ? '✓ 已设置' : '未设置'}</p>
            <p>App ID: {config.appId ? '✓ 已设置' : '未设置'}</p>
            <p>Measurement ID: {config.measurementId ? '✓ 已设置' : '可选，未设置'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppInfo; 