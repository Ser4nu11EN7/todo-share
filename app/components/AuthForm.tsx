'use client';

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const AuthForm = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  
  const { signIn, signUp } = useAuth();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '认证过程中出现错误');
    } finally {
      setLoading(false);
    }
  };
  
  const handleToggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
  };
  
  return (
    <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {isLogin ? '登录' : '注册'}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {isLogin ? '登录以访问您的共享待办事项' : '创建一个新账户'}
        </p>
      </div>
      
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md" role="alert">
          {error}
        </div>
      )}
      
      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              电子邮箱
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="your@email.com"
              aria-label="电子邮箱"
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              密码
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="********"
              aria-label="密码"
            />
          </div>
        </div>
        
        <div>
          <button
            type="submit"
            disabled={loading}
            className="flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={isLogin ? "登录" : "注册"}
          >
            {loading ? '处理中...' : isLogin ? '登录' : '注册'}
          </button>
        </div>
      </form>
      
      <div className="text-center">
        <button
          type="button"
          onClick={handleToggleMode}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          tabIndex={0}
          aria-label={isLogin ? "切换到注册模式" : "切换到登录模式"}
          onKeyDown={(e) => e.key === 'Enter' && handleToggleMode()}
        >
          {isLogin ? '没有账户？注册' : '已有账户？登录'}
        </button>
      </div>
    </div>
  );
};

export default AuthForm; 