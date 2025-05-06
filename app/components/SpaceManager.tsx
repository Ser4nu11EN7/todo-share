'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { nanoid } from 'nanoid';
import TodoList from './TodoList';
import ColorSelector from './ColorSelector';
import DraggableSpaceList from './DraggableSpaceList';
import SettingsMenu from './SettingsMenu';

// 定义空间类型
type SpaceData = {
  id: string;
  shareId: string;
  members: string[];
  memberColors?: Record<string, string>;
  memberNames?: Record<string, string>;
  status: 'waiting' | 'active';
  createdAt: number;
  name?: string; // 添加空间名称字段
};

const SpaceManager = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [shareId, setShareId] = useState<string>('');
  const [activeSpace, setActiveSpace] = useState<SpaceData | null>(null);
  const [isCreator, setIsCreator] = useState<boolean>(false);
  const [joinId, setJoinId] = useState<string>('');
  const [userColor, setUserColor] = useState<string>('bg-blue-500');
  const [userName, setUserName] = useState<string>('');
  const [spaces, setSpaces] = useState<SpaceData[]>([]); // 存储用户的所有空间
  const [spaceName, setSpaceName] = useState<string>(''); // 空间名称
  const [confirmAction, setConfirmAction] = useState<{type: 'leave' | 'dissolve' | null, confirmed: boolean}>({
    type: null,
    confirmed: false
  });
  // 添加复制提示状态
  const [copyTooltip, setCopyTooltip] = useState<string>('');

  // 共享ID复制函数
  const handleCopyShareId = (id: string) => {
    // 检查剪贴板API是否可用
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(id)
        .then(() => {
          setCopyTooltip('已复制!');
          setTimeout(() => setCopyTooltip(''), 2000);
        })
        .catch(err => {
          console.error('复制失败:', err);
          fallbackCopyTextToClipboard(id);
        });
    } else {
      // 使用备选方法
      fallbackCopyTextToClipboard(id);
    }
  };

  // 备选的复制方法
  const fallbackCopyTextToClipboard = (text: string) => {
    try {
      // 创建一个临时的textarea元素
      const textArea = document.createElement('textarea');
      textArea.value = text;
      
      // 设置样式使元素不可见
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      // 尝试执行复制命令
      const successful = document.execCommand('copy');
      
      // 显示提示
      if (successful) {
        setCopyTooltip('已复制!');
      } else {
        setCopyTooltip('复制失败，请手动复制');
      }
      
      // 移除临时元素
      document.body.removeChild(textArea);
    } catch (err) {
      console.error('备选复制方法失败:', err);
      setCopyTooltip('复制失败，请手动复制');
    }
    
    // 设置定时器清除提示
    setTimeout(() => setCopyTooltip(''), 2000);
  };

  // 查询用户当前的所有共享空间
  useEffect(() => {
    const fetchUserSpaces = async () => {
      if (!user) return;

      setLoading(true);
      setError('');
      
      try {
        // 查询用户所属的所有空间
        const userSpacesRef = collection(db, 'spaces');
        const q = query(userSpacesRef, where('members', 'array-contains', user.uid));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const spacesData = querySnapshot.docs.map(doc => {
            const data = doc.data() as SpaceData;
            return {
              ...data,
              id: doc.id
            };
          });
          
          setSpaces(spacesData);
          
          // 如果有活动空间，保持选中
          if (activeSpace) {
            const currentSpace = spacesData.find(space => space.id === activeSpace.id);
            if (currentSpace) {
              setActiveSpace(currentSpace);
              setIsCreator(currentSpace.members[0] === user.uid);
              
              // 设置用户名和空间名称
              if (currentSpace.memberNames && currentSpace.memberNames[user.uid]) {
                setUserName(currentSpace.memberNames[user.uid]);
              }
              
              if (currentSpace.name) {
                setSpaceName(currentSpace.name);
              }
            } else {
              setActiveSpace(null);
            }
          } else if (spacesData.length > 0) {
            // 如果没有活动空间但有空间列表，设置第一个为活动空间
            const firstSpace = spacesData[0];
            setActiveSpace(firstSpace);
            setIsCreator(firstSpace.members[0] === user.uid);
            
            // 设置用户名和空间名称
            if (firstSpace.memberNames && firstSpace.memberNames[user.uid]) {
              setUserName(firstSpace.memberNames[user.uid]);
            } else if (user.displayName) {
              setUserName(user.displayName);
            } else {
              setUserName(firstSpace.members[0] === user.uid ? '创建者' : '伙伴');
            }
            
            if (firstSpace.name) {
              setSpaceName(firstSpace.name);
            }
          } else {
            setActiveSpace(null);
          }
        } else {
          setSpaces([]);
          setActiveSpace(null);
        }
      } catch (err) {
        setError('获取共享空间信息时出错');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserSpaces();
  }, [user]);

  // 处理创建新的共享空间
  const handleCreateSpace = async () => {
    if (!user) return;
    
    setLoading(true);
    setError('');
    
    try {
      // 生成唯一的共享ID
      const newShareId = nanoid(10);
      
      // 设置初始用户名
      const initialUserName = user.displayName || '创建者';
      setUserName(initialUserName);
      
      // 创建用户名映射
      const memberNames: Record<string, string> = {
        [user.uid]: initialUserName
      };
      
      // 创建颜色映射
      const memberColors: Record<string, string> = {
        [user.uid]: userColor
      };
      
      const defaultSpaceName = `待办空间 ${new Date().toLocaleDateString()}`;
      setSpaceName(defaultSpaceName);
      
      // 创建新的空间记录
      const newSpaceRef = doc(collection(db, 'spaces'));
      await setDoc(newSpaceRef, {
        shareId: newShareId,
        members: [user.uid],
        memberColors,
        memberNames,
        status: 'waiting',
        createdAt: Date.now(),
        name: defaultSpaceName
      });
      
      // 将新创建的空间设置为活动空间
      const newSpace: SpaceData = {
        id: newSpaceRef.id,
        shareId: newShareId,
        members: [user.uid],
        memberColors,
        memberNames,
        status: 'waiting',
        createdAt: Date.now(),
        name: defaultSpaceName
      };
      
      setActiveSpace(newSpace);
      setShareId(newShareId);
      setIsCreator(true);
      setSpaces(prevSpaces => [...prevSpaces, newSpace]);
    } catch (err) {
      setError('创建共享空间时出错');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 处理加入现有共享空间
  const handleJoinSpace = async () => {
    if (!user || !joinId) return;
    
    setLoading(true);
    setError('');
    
    try {
      // 查询具有指定共享ID的空间
      const spacesRef = collection(db, 'spaces');
      const q = query(spacesRef, where('shareId', '==', joinId));
      const querySnapshot = await getDocs(q);
      
      // 检查是否找到空间
      if (querySnapshot.empty) {
        setError('找不到该共享ID对应的空间');
        setLoading(false);
        return;
      }
      
      const spaceDoc = querySnapshot.docs[0];
      const spaceData = spaceDoc.data() as SpaceData;
      
      // 检查用户是否已在该空间
      if (spaceData.members.includes(user.uid)) {
        setError('您已经是该空间的成员');
        setLoading(false);
        return;
      }
      
      // 设置用户名
      const joinUserName = user.displayName || '伙伴';
      
      // 更新成员颜色和名称
      const memberColors = spaceData.memberColors || {};
      memberColors[user.uid] = userColor;
      
      const memberNames = spaceData.memberNames || {};
      memberNames[user.uid] = joinUserName;
      
      // 更新空间，添加当前用户为成员
      // 不再检查和修改status状态，允许多人加入
      const spaceRef = doc(db, 'spaces', spaceDoc.id);
      await updateDoc(spaceRef, {
        members: arrayUnion(user.uid),
        memberColors,
        memberNames
      });
      
      // 设置活动空间
      const updatedSpace: SpaceData = {
        ...spaceData,
        id: spaceDoc.id,
        members: [...spaceData.members, user.uid],
        memberColors,
        memberNames,
        status: spaceData.status // 保持原状态
      };
      
      if (updatedSpace.name) {
        setSpaceName(updatedSpace.name);
      }
      
      setActiveSpace(updatedSpace);
      setIsCreator(false);
      setSpaces(prevSpaces => [...prevSpaces, updatedSpace]);
      
      // 清空输入框
      setJoinId('');
    } catch (err) {
      setError('加入共享空间时出错');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 处理用户颜色变更
  const handleColorChange = async (newColor: string) => {
    if (!user || !activeSpace) return;
    
    try {
      const spaceRef = doc(db, 'spaces', activeSpace.id);
      const spaceDoc = await getDoc(spaceRef);
      
      if (!spaceDoc.exists()) return;
      
      const currentData = spaceDoc.data();
      const memberColors = currentData.memberColors || {};
      
      // 更新当前用户的颜色
      memberColors[user.uid] = newColor;
      
      await updateDoc(spaceRef, { memberColors });
      
      // 更新本地状态
      const updatedSpace = {
        ...activeSpace,
        memberColors
      };
      setActiveSpace(updatedSpace);
      setUserColor(newColor);
    } catch (err) {
      console.error('更新用户颜色时出错:', err);
      setError('无法更新您的颜色设置');
    }
  };
  
  // 处理用户名称变更
  const handleNameChange = async (newName: string) => {
    if (!user || !activeSpace || !newName.trim()) return;
    
    try {
      setLoading(true);
      const spaceRef = doc(db, 'spaces', activeSpace.id);
      const spaceDoc = await getDoc(spaceRef);
      
      if (!spaceDoc.exists()) {
        setLoading(false);
        return;
      }
      
      const currentData = spaceDoc.data();
      const memberNames = currentData.memberNames || {};
      
      // 更新当前用户的名称
      memberNames[user.uid] = newName.trim();
      
      await updateDoc(spaceRef, { memberNames });
      
      // 更新本地状态
      const updatedSpace = {
        ...activeSpace,
        memberNames
      };
      setActiveSpace(updatedSpace);
      
      // 更新空间列表中的成员名称
      setSpaces(prevSpaces => 
        prevSpaces.map(space => 
          space.id === activeSpace.id 
            ? {...space, memberNames: {...space.memberNames, [user.uid]: newName.trim()}} 
            : space
        )
      );
      
      setUserName(newName.trim());
      setLoading(false);
    } catch (err) {
      console.error('更新用户名称时出错:', err);
      setError('无法更新您的名称');
      setLoading(false);
    }
  };
  
  // 获取当前用户颜色和名称
  useEffect(() => {
    if (activeSpace?.memberColors && user) {
      const savedColor = activeSpace.memberColors[user.uid];
      if (savedColor) {
        setUserColor(savedColor);
      }
      
      if (activeSpace.memberNames) {
        const savedName = activeSpace.memberNames[user.uid];
        if (savedName) {
          setUserName(savedName);
        }
      }
    }
  }, [activeSpace, user]);

  // 处理空间名称变更
  const handleSpaceNameChange = async (newName: string) => {
    if (!user || !activeSpace || !newName.trim()) return;
    
    try {
      const spaceRef = doc(db, 'spaces', activeSpace.id);
      const spaceDoc = await getDoc(spaceRef);
      
      if (!spaceDoc.exists()) return;
      
      // 更新空间名称
      await updateDoc(spaceRef, { name: newName.trim() });
      
      // 更新本地状态
      const updatedSpace = {
        ...activeSpace,
        name: newName.trim()
      };
      setActiveSpace(updatedSpace);
      
      // 更新空间列表中的名称
      setSpaces(prevSpaces => 
        prevSpaces.map(space => 
          space.id === activeSpace.id ? {...space, name: newName.trim()} : space
        )
      );
      
      setSpaceName(newName.trim());
    } catch (err) {
      console.error('更新空间名称时出错:', err);
      setError('无法更新空间名称');
    }
  };
  
  // 处理切换活动空间
  const handleSwitchSpace = (space: SpaceData) => {
    setActiveSpace(space);
    setIsCreator(space.members[0] === user?.uid);
    
    // 设置用户名和空间名称
    if (space.memberNames && user && space.memberNames[user.uid]) {
      setUserName(space.memberNames[user.uid]);
    }
    
    if (space.name) {
      setSpaceName(space.name);
    } else {
      setSpaceName('');
    }
    
    // 设置用户颜色
    if (space.memberColors && user && space.memberColors[user.uid]) {
      setUserColor(space.memberColors[user.uid]);
    }
  };
  
  // 处理退出空间
  const handleLeaveSpace = async () => {
    if (!user || !activeSpace) return;
    
    if (!confirmAction.confirmed && confirmAction.type !== 'leave') {
      setConfirmAction({type: 'leave', confirmed: false});
      return;
    }
    
    setLoading(true);
    
    try {
      const spaceRef = doc(db, 'spaces', activeSpace.id);
      const spaceDoc = await getDoc(spaceRef);
      
      if (!spaceDoc.exists()) {
        setError('空间不存在');
        setLoading(false);
        return;
      }
      
      const spaceData = spaceDoc.data() as SpaceData;
      
      // 如果是创建者，不能直接退出，只能解散
      if (spaceData.members[0] === user.uid) {
        setError('作为创建者，您不能退出空间，只能解散空间');
        setLoading(false);
        return;
      }
      
      // 移除用户
      const updatedMembers = spaceData.members.filter(id => id !== user.uid);
      
      // 更新空间成员
      await updateDoc(spaceRef, {
        members: updatedMembers,
        status: 'waiting' // 重置状态为等待中
      });
      
      // 从本地空间列表中移除
      setSpaces(prevSpaces => prevSpaces.filter(space => space.id !== activeSpace.id));
      
      // 如果还有其他空间，切换到第一个
      if (spaces.length > 1) {
        const nextSpace = spaces.find(space => space.id !== activeSpace.id);
        if (nextSpace) {
          handleSwitchSpace(nextSpace);
        } else {
          setActiveSpace(null);
        }
      } else {
        setActiveSpace(null);
      }
      
      setConfirmAction({type: null, confirmed: false});
    } catch (err) {
      setError('退出空间时出错');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // 处理解散空间
  const handleDissolveSpace = async () => {
    if (!user || !activeSpace) return;
    
    if (!confirmAction.confirmed && confirmAction.type !== 'dissolve') {
      setConfirmAction({type: 'dissolve', confirmed: false});
      return;
    }
    
    setLoading(true);
    
    try {
      const spaceRef = doc(db, 'spaces', activeSpace.id);
      const spaceDoc = await getDoc(spaceRef);
      
      if (!spaceDoc.exists()) {
        setError('空间不存在');
        setLoading(false);
        return;
      }
      
      const spaceData = spaceDoc.data() as SpaceData;
      
      // 只有创建者可以解散空间
      if (spaceData.members[0] !== user.uid) {
        setError('只有创建者可以解散空间');
        setLoading(false);
        return;
      }
      
      // 删除空间
      // 首先获取该空间的所有待办事项
      const todosRef = collection(db, 'todos');
      const q = query(todosRef, where('spaceId', '==', activeSpace.id));
      const todosSnapshot = await getDocs(q);
      
      // 在一个批处理中删除所有相关数据
      const batch = writeBatch(db);
      
      // 添加删除待办事项的操作
      todosSnapshot.docs.forEach(todoDoc => {
        batch.delete(doc(db, 'todos', todoDoc.id));
      });
      
      // 添加删除空间的操作
      batch.delete(spaceRef);
      
      // 提交批处理
      await batch.commit();
      
      // 从本地空间列表中移除
      setSpaces(prevSpaces => prevSpaces.filter(space => space.id !== activeSpace.id));
      
      // 如果还有其他空间，切换到第一个
      if (spaces.length > 1) {
        const nextSpace = spaces.find(space => space.id !== activeSpace.id);
        if (nextSpace) {
          handleSwitchSpace(nextSpace);
        } else {
          setActiveSpace(null);
        }
      } else {
        setActiveSpace(null);
      }
      
      setConfirmAction({type: null, confirmed: false});
    } catch (err) {
      setError('解散空间时出错');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 渲染等待伙伴加入界面
  const renderWaitingState = () => (
    <div className="p-6 text-center space-y-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold text-gray-900">等待伙伴加入</h2>
      <div className="p-4 bg-gray-100 rounded-md">
        <p className="text-sm text-gray-700 mb-2">分享以下ID给您的伙伴：</p>
        <div className="flex items-center justify-center space-x-2 relative">
          <span className="font-mono text-lg font-bold text-indigo-600">{shareId}</span>
          <button
            onClick={() => handleCopyShareId(shareId)}
            className="p-2 text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors"
            aria-label="复制共享ID"
            tabIndex={0}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          {copyTooltip && (
            <div className="absolute -right-12 -top-8 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-md">
              {copyTooltip}
            </div>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-600">您的待办事项列表将在伙伴加入后激活</p>
    </div>
  );

  // 渲染初始界面（创建或加入空间）
  const renderInitialState = () => (
    <div className="p-6 space-y-8 bg-white rounded-lg shadow-md">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 text-center">创建共享空间</h2>
        <p className="text-sm text-gray-600">创建一个新的共享待办事项空间，并邀请一位伙伴加入。</p>
        <button
          onClick={handleCreateSpace}
          disabled={loading}
          className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          aria-label="创建空间"
          tabIndex={0}
        >
          {loading ? '处理中...' : '创建空间'}
        </button>
      </div>
      
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">或者</span>
        </div>
      </div>
      
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 text-center">加入共享空间</h2>
        <p className="text-sm text-gray-600">使用伙伴分享给您的ID加入现有的共享空间。</p>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="joinId" className="block text-sm font-medium text-gray-700">
              共享ID
            </label>
            <input
              id="joinId"
              type="text"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="输入共享ID"
              aria-label="共享ID"
            />
          </div>
          
          <button
            onClick={handleJoinSpace}
            disabled={loading || !joinId}
            className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            aria-label="加入空间"
            tabIndex={0}
          >
            {loading ? '处理中...' : '加入空间'}
          </button>
        </div>
      </div>
    </div>
  );

  // 渲染空间列表
  const renderSpacesList = () => (
    <div className="pb-4 overflow-x-auto">
      <div className="flex space-x-4 min-w-max">
        {spaces.map(space => (
          <div 
            key={space.id}
            onClick={() => handleSwitchSpace(space)}
            className={`flex-shrink-0 w-48 p-4 rounded-lg shadow-sm cursor-pointer transition-all duration-200 ${
              activeSpace?.id === space.id ? 'bg-indigo-100 border-2 border-indigo-500' : 'bg-white hover:bg-gray-50 border border-gray-200'
            }`}
            tabIndex={0}
            aria-label={`切换到空间: ${space.name || '未命名空间'}`}
            onKeyDown={(e) => e.key === 'Enter' && handleSwitchSpace(space)}
          >
            <h3 className="text-md font-medium text-gray-900 truncate mb-1">
              {space.name || '未命名空间'}
            </h3>
            <p className="text-xs text-gray-500">
              {space.status === 'waiting' ? '等待加入' : '已有2人'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {space.members[0] === user?.uid ? '(您创建的)' : '(您加入的)'}
            </p>
          </div>
        ))}
        <div 
          onClick={handleCreateSpace}
          className="flex-shrink-0 w-48 p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
          tabIndex={0}
          aria-label="创建新空间"
          onKeyDown={(e) => e.key === 'Enter' && handleCreateSpace()}
        >
          <div className="text-center">
            <svg className="w-6 h-6 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="block mt-1 text-sm font-medium text-gray-500">创建新空间</span>
          </div>
        </div>
        <div 
          onClick={() => document.getElementById('joinSpaceModal')?.classList.remove('hidden')}
          className="flex-shrink-0 w-48 p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
          tabIndex={0}
          aria-label="加入现有空间"
          onKeyDown={(e) => e.key === 'Enter' && document.getElementById('joinSpaceModal')?.classList.remove('hidden')}
        >
          <div className="text-center">
            <svg className="w-6 h-6 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span className="block mt-1 text-sm font-medium text-gray-500">加入空间</span>
          </div>
        </div>
      </div>
    </div>
  );
  
  // 渲染活动空间内容
  const renderActiveSpaceContent = () => {
    if (!activeSpace) return null;
    
    // 获取另一个成员的信息
    const otherMember = activeSpace.members.find(memberId => memberId !== user?.uid);
    const otherMemberName = otherMember && activeSpace.memberNames ? 
      activeSpace.memberNames[otherMember] : '等待加入';
    
    return (
      <>
        <div className="p-4 mb-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <input
                type="text"
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                onBlur={() => handleSpaceNameChange(spaceName)}
                className="text-lg font-medium text-gray-900 border-b border-transparent focus:border-indigo-500 focus:outline-none"
                placeholder="输入空间名称"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <SettingsMenu
                userName={userName}
                userColor={userColor}
                onNameChange={handleNameChange}
                onColorChange={handleColorChange}
              />
              
              {isCreator ? (
                <button
                  onClick={handleDissolveSpace}
                  className="inline-flex items-center px-2 py-1 text-sm text-red-700 bg-red-100 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  aria-label="解散空间"
                  tabIndex={0}
                >
                  {confirmAction.type === 'dissolve' && !confirmAction.confirmed ? '确认解散?' : '解散空间'}
                </button>
              ) : (
                <button
                  onClick={handleLeaveSpace}
                  className="inline-flex items-center px-2 py-1 text-sm text-red-700 bg-red-100 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  aria-label="退出空间"
                  tabIndex={0}
                >
                  {confirmAction.type === 'leave' && !confirmAction.confirmed ? '确认退出?' : '退出空间'}
                </button>
              )}
            </div>
          </div>
          
          {activeSpace.status === 'waiting' ? (
            <div className="px-3 py-2 text-sm text-yellow-800 bg-yellow-100 rounded-md">
              等待伙伴加入，请分享ID: 
              <span className="font-medium ml-1">{activeSpace.shareId}</span>
              <button
                onClick={() => handleCopyShareId(activeSpace.shareId)}
                className="ml-2 text-yellow-800 hover:text-yellow-900 focus:outline-none"
                aria-label="复制共享ID"
                tabIndex={0}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copyTooltip && (
                  <span className="ml-1 text-xs">{copyTooltip}</span>
                )}
              </button>
            </div>
          ) : (
            <div className="flex justify-between text-sm text-gray-600">
              <div className="flex items-center">
                <span>共享ID: {activeSpace.shareId}</span>
                <button
                  onClick={() => handleCopyShareId(activeSpace.shareId)}
                  className="ml-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  aria-label="复制共享ID"
                  tabIndex={0}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {copyTooltip && (
                    <span className="ml-1 text-xs">{copyTooltip}</span>
                  )}
                </button>
              </div>
              <span>{new Date(activeSpace.createdAt).toLocaleDateString()} 创建</span>
            </div>
          )}
          
          {/* 显示空间成员信息 */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${userColor} mr-1`}></div>
              <span className="text-sm font-medium">{userName || '您'} (您)</span>
            </div>
            
            {otherMember && (
              <div className="flex items-center ml-4">
                <div className={`w-3 h-3 rounded-full ${activeSpace.memberColors?.[otherMember] || 'bg-gray-400'} mr-1`}></div>
                <span className="text-sm font-medium">{otherMemberName}</span>
              </div>
            )}
          </div>
        </div>

        {activeSpace.status === 'active' && (
          <TodoList 
            spaceId={activeSpace.id} 
            userColor={userColor}
            memberColors={activeSpace.memberColors} 
            memberNames={activeSpace.memberNames}
          />
        )}
      </>
    );
  };
  
  // 根据状态显示不同内容
  if (loading && !activeSpace && spaces.length === 0) {
    return <div className="text-center py-8">正在加载...</div>;
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {error && (
        <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-md" role="alert">
          {error}
        </div>
      )}

      {spaces.length > 0 ? (
        <>
          <DraggableSpaceList
            spaces={spaces}
            activeSpaceId={activeSpace?.id || null}
            userId={user?.uid || null}
            onSpaceSelect={handleSwitchSpace}
            onCreateSpace={handleCreateSpace}
            onJoinSpace={() => document.getElementById('joinSpaceModal')?.classList.remove('hidden')}
          />
          {activeSpace && renderActiveSpaceContent()}
        </>
      ) : (
        renderInitialState()
      )}
      
      {/* 浮动按钮组 */}
      <div className="fixed bottom-6 right-6 z-10 flex flex-col space-y-3">
        {/* 创建空间按钮 */}
        <div className="relative group">
          <button
            onClick={handleCreateSpace}
            className="flex items-center justify-center w-14 h-14 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all"
            aria-label="创建新空间"
            title="创建新空间"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
          <span className="absolute top-0 right-full mr-2 whitespace-nowrap bg-gray-800 text-white text-xs rounded px-2 py-1 invisible group-hover:visible">
            创建新空间
          </span>
        </div>
        
        {/* 加入空间按钮 */}
        <div className="relative group">
          <button
            onClick={() => document.getElementById('joinSpaceModal')?.classList.remove('hidden')}
            className="flex items-center justify-center w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
            aria-label="加入空间"
            title="加入新空间"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </button>
          <span className="absolute top-0 right-full mr-2 whitespace-nowrap bg-gray-800 text-white text-xs rounded px-2 py-1 invisible group-hover:visible">
            加入新空间
          </span>
        </div>
      </div>
      
      {/* 加入空间模态框 */}
      <div id="joinSpaceModal" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">加入新空间</h3>
            <button 
              onClick={() => document.getElementById('joinSpaceModal')?.classList.add('hidden')}
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
              aria-label="关闭"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="modalJoinId" className="block text-sm font-medium text-gray-700">
                共享ID
              </label>
              <input
                id="modalJoinId"
                type="text"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="输入共享ID"
                aria-label="共享ID"
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => document.getElementById('joinSpaceModal')?.classList.add('hidden')}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                取消
              </button>
              <button
                onClick={() => {
                  handleJoinSpace();
                  document.getElementById('joinSpaceModal')?.classList.add('hidden');
                }}
                disabled={loading || !joinId}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? '处理中...' : '加入空间'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpaceManager; 