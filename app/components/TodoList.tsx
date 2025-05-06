'use client';

import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  doc, 
  onSnapshot,
  getDoc
} from 'firebase/firestore';
import TodoItem from './TodoItem';
import { useAuth } from '../context/AuthContext';
import RecurrenceSelector, { RecurrenceConfig } from './RecurrenceSelector';
import { resetTasks, setInitialResetTime } from '../utils/taskReset';

// 定义待办事项类型
export type Todo = {
  id: string;
  text: string;
  completed: boolean;
  completedBy: string[];
  deletedBy: string[];
  createdAt: number;
  createdById?: string;
  spaceId: string;
  recurrence?: RecurrenceConfig;
  completionHistory?: Record<string, {
    completed: boolean;
    completedBy: string[];
  }>;
};

type TodoListProps = {
  spaceId: string;
  userColor?: string;
  memberColors?: Record<string, string>;
  memberNames?: Record<string, string>;
};

const TodoList = ({ 
  spaceId, 
  userColor = 'bg-blue-500', 
  memberColors = {},
  memberNames = {}
}: TodoListProps) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [recurrence, setRecurrence] = useState<RecurrenceConfig>({ type: 'once' });
  const { user } = useAuth();

  // 获取并监听待办事项变化
  useEffect(() => {
    if (!spaceId) return;

    setLoading(true);
    
    // 创建查询，按时间排序
    const todosRef = collection(db, 'todos');
    const q = query(
      todosRef, 
      where('spaceId', '==', spaceId),
      orderBy('createdAt', 'desc')
    );

    // 使用onSnapshot实时监听数据变化
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const todoItems: Todo[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        todoItems.push({
          id: doc.id,
          text: data.text,
          completed: data.completed,
          completedBy: data.completedBy || [],
          deletedBy: data.deletedBy || [],
          createdAt: data.createdAt,
          spaceId: data.spaceId,
          recurrence: data.recurrence || { type: 'once' },
          completionHistory: data.completionHistory || {}
        });
      });
      
      setTodos(todoItems);
      setLoading(false);
    }, (err) => {
      console.error('监听待办事项时出错:', err);
      setError('无法加载待办事项，请刷新页面重试');
      setLoading(false);
    });
    
    // 清理订阅
    return () => unsubscribe();
  }, [spaceId]);

  // 自动重置任务检查
  useEffect(() => {
    if (!spaceId) return;
    
    // 在组件加载时检查和重置任务
    resetTasks(spaceId);
    
    // 设置定期检查
    const checkInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        resetTasks(spaceId);
      }
    }, 15 * 60 * 1000); // 每15分钟检查一次
    
    // 当用户重新访问页面时检查
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resetTasks(spaceId);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(checkInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [spaceId]);

  // 添加新的待办事项
  const handleAddTodo = async () => {
    if (!newTodo.trim() || !spaceId || !user) return;
    
    try {
      // 为非一次性任务设置下次重置时间
      const todoRecurrence = setInitialResetTime(recurrence);
      
      // 添加文档到Firestore
      await addDoc(collection(db, 'todos'), {
        text: newTodo.trim(),
        completed: false,
        completedBy: [],
        deletedBy: [],
        createdAt: Date.now(),
        createdById: user.uid,
        spaceId: spaceId,
        recurrence: todoRecurrence,
        completionHistory: {}
      });
      
      // 清空输入框和重置重复配置
      setNewTodo('');
      setRecurrence({ type: 'once' });
    } catch (err) {
      console.error('添加待办事项时出错:', err);
      setError('添加待办事项失败，请重试');
    }
  };

  // 切换待办事项完成状态
  const handleToggleTodo = async (todoId: string, isCompleted: boolean) => {
    if (!user) return;
    
    try {
      const todoRef = doc(db, 'todos', todoId);
      const todoDoc = await getDoc(todoRef);
      
      if (!todoDoc.exists()) {
        setError('该待办事项不存在');
        return;
      }
      
      const todoData = todoDoc.data();
      let completedBy = todoData.completedBy || [];
      // 获取今天的日期字符串
      const today = new Date().toISOString().split('T')[0];
      // 获取或创建完成历史记录
      const completionHistory = todoData.completionHistory || {};
      
      if (isCompleted) {
        // 如果已完成，则移除用户ID
        completedBy = completedBy.filter((id: string) => id !== user.uid);
        
        // 更新今天的完成记录，如果其他人也没完成，则标记为未完成
        if (completionHistory[today]) {
          // 从今天的完成记录中移除当前用户
          const todayCompletedBy = completionHistory[today].completedBy.filter((id: string) => id !== user.uid);
          
          if (todayCompletedBy.length === 0) {
            // 如果今天没有人完成，则整个记录标记为未完成
            completionHistory[today] = {
              completed: false,
              completedBy: []
            };
          } else {
            // 如果还有其他人完成，则只更新完成人员列表
            completionHistory[today] = {
              completed: true,
              completedBy: todayCompletedBy
            };
          }
        }
        
        // 更新Firestore文档 (对于取消完成的情况)
        await updateDoc(todoRef, {
          completedBy,
          // 设置completed字段保持向后兼容
          completed: completedBy.length > 0,
          completionHistory
        });
      } else {
        // 如果未完成，则添加用户ID
        if (!completedBy.includes(user.uid)) {
          completedBy.push(user.uid);
        }
        
        // 记录完成历史
        completionHistory[today] = {
          completed: true,
          completedBy: [...completedBy]
        };
        
        // 更新Firestore文档
        await updateDoc(todoRef, {
          completedBy,
          // 设置completed字段保持向后兼容
          completed: completedBy.length > 0,
          completionHistory
        });
      }
    } catch (err) {
      console.error('更新待办事项状态时出错:', err);
      setError('更新待办事项状态失败');
    }
  };

  // 删除待办事项
  const handleDeleteTodo = async (todoId: string) => {
    if (!user) return;
    
    try {
      const todoRef = doc(db, 'todos', todoId);
      const todoDoc = await getDoc(todoRef);
      
      if (!todoDoc.exists()) {
        setError('该待办事项不存在');
        return;
      }
      
      const todoData = todoDoc.data();
      let deletedBy = todoData.deletedBy || [];
      
      // 检查是否为创建者且在三分钟内
      const isCreator = todoData.createdById === user.uid;
      const creationTime = todoData.createdAt || 0;
      const currentTime = Date.now();
      const threeMinutesInMs = 3 * 60 * 1000; // 3分钟，单位毫秒
      const isWithinThreeMinutes = (currentTime - creationTime) <= threeMinutesInMs;
      
      // 如果是创建者且在三分钟内，允许直接删除
      if (isCreator && isWithinThreeMinutes) {
        await deleteDoc(todoRef);
        return;
      }
      
      // 检查用户是否已标记删除
      const userMarkedDelete = deletedBy.includes(user.uid);
      
      if (userMarkedDelete) {
        // 如果用户已标记删除，则取消标记
        deletedBy = deletedBy.filter((id: string) => id !== user.uid);
        await updateDoc(todoRef, { deletedBy });
      } else {
        // 如果用户未标记删除，则添加标记
        deletedBy.push(user.uid);
        
        // 检查是否两个用户都标记了删除
        if (deletedBy.length >= 2) {
          // 如果是，则真正删除待办事项
          await deleteDoc(todoRef);
        } else {
          // 否则，只更新标记
          await updateDoc(todoRef, { deletedBy });
        }
      }
    } catch (err) {
      console.error('处理待办事项删除时出错:', err);
      setError('删除操作失败');
    }
  };

  // 编辑待办事项文本
  const handleEditTodo = async (todoId: string, newText: string, newRecurrence?: RecurrenceConfig) => {
    if (!user) return;
    
    try {
      const todoRef = doc(db, 'todos', todoId);
      const todoDoc = await getDoc(todoRef);
      
      if (!todoDoc.exists()) {
        setError('该待办事项不存在');
        return;
      }
      
      const updates: any = { text: newText };
      
      // 如果提供了新的重复配置，则更新
      if (newRecurrence) {
        updates.recurrence = setInitialResetTime(newRecurrence);
      }
      
      await updateDoc(todoRef, updates);
    } catch (err) {
      console.error('编辑待办事项时出错:', err);
      setError('编辑待办事项失败');
    }
  };

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAddTodo();
  };

  // 处理键盘事件，按Enter提交
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddTodo();
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md space-y-6">
      <div className="flex flex-col space-y-2">
        <h2 className="text-xl font-semibold text-gray-900 text-center">共享待办事项</h2>
        
        {/* 显示团队成员信息 */}
        <div className="flex justify-center items-center gap-4 text-sm text-gray-600 border-b border-gray-200 pb-2">
          <div className="flex items-center">
            <span>团队成员:</span>
          </div>
          
          {user && (
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${userColor} mr-1`}></div>
              <span>{memberNames[user.uid] || '您'}</span>
            </div>
          )}
          
          {Object.keys(memberNames || {}).filter(id => user && id !== user.uid).map(memberId => (
            <div key={memberId} className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${memberColors[memberId] || 'bg-gray-400'} mr-1`}></div>
              <span>{memberNames[memberId]}</span>
            </div>
          ))}
        </div>
      </div>
      
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md" role="alert">
          {error}
        </div>
      )}
      
      {/* 添加新的待办事项 */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-start">
          <input
            type="text"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="添加新的待办事项..."
            className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            disabled={loading}
            aria-label="新的待办事项"
          />
          <button
            type="submit"
            disabled={!newTodo.trim() || loading}
            className="ml-3 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="添加待办事项"
          >
            添加
          </button>
        </div>
        
        {/* 重复设置 */}
        <div className="flex items-center">
          <span className="text-sm text-gray-600 mr-2">重复:</span>
          <RecurrenceSelector
            value={recurrence}
            onChange={setRecurrence}
            disabled={loading}
          />
        </div>
      </form>
      
      {/* 待办事项列表 */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-gray-500">加载中...</p>
        </div>
      ) : todos.length > 0 ? (
        <ul className="space-y-3">
          {todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={handleToggleTodo}
              onDelete={handleDeleteTodo}
              onEdit={handleEditTodo}
              userColor={userColor}
              memberColors={memberColors}
              memberNames={memberNames}
            />
          ))}
        </ul>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>暂无待办事项，开始添加吧！</p>
        </div>
      )}
    </div>
  );
};

export default TodoList; 