import { collection, query, where, getDocs, updateDoc, doc, getDoc, setDoc, DocumentReference } from 'firebase/firestore';
import { db } from '../firebase/config';
import { RecurrenceConfig } from '../components/RecurrenceSelector';

// 获取需要重置的任务列表
export const getTasksToReset = async (spaceId: string) => {
  const now = Date.now();
  const todosRef = collection(db, 'todos');
  
  // 查询需要重置的任务:
  // 1. 已完成的任务
  // 2. 不是一次性任务
  // 3. 下次重置时间已过期
  const q = query(
    todosRef,
    where('spaceId', '==', spaceId),
    where('completed', '==', true),
    where('recurrence.type', '!=', 'once'),
    where('recurrence.nextReset', '<', now)
  );
  
  return getDocs(q);
};

// 计算下次重置时间
export const calculateNextReset = (recurrence: RecurrenceConfig): number => {
  const now = new Date();
  const resetHour = 4; // 凌晨4点重置
  let nextReset = new Date(now);
  
  // 设置为今天凌晨4点
  nextReset.setHours(resetHour, 0, 0, 0);
  
  // 如果当前时间已经过了今天的重置时间，则设置为明天
  if (now.getHours() >= resetHour) {
    nextReset.setDate(nextReset.getDate() + 1);
  }
  
  // 根据重复类型调整下次重置时间
  if (recurrence.type === 'custom' && recurrence.interval) {
    // 对于自定义间隔，计算下一个重置日
    const lastCompleted = recurrence.lastCompleted 
      ? new Date(recurrence.lastCompleted) 
      : new Date();
    
    const daysSinceLastCompleted = Math.floor(
      (now.getTime() - lastCompleted.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const daysUntilNextReset = recurrence.interval - (daysSinceLastCompleted % recurrence.interval);
    
    if (daysUntilNextReset > 0) {
      nextReset.setDate(nextReset.getDate() + daysUntilNextReset - 1);
    }
  } else if (recurrence.type === 'weekly' && recurrence.weekdays?.length) {
    // 对于每周指定日，找到下一个匹配的日期
    let found = false;
    let daysToAdd = 1;
    const currentDay = now.getDay();
    
    while (!found && daysToAdd < 8) {
      const nextDay = (currentDay + daysToAdd) % 7;
      if (recurrence.weekdays.includes(nextDay)) {
        found = true;
        break;
      }
      daysToAdd++;
    }
    
    // 如果找到了下一个匹配的日期，则设置nextReset
    if (found) {
      nextReset.setDate(nextReset.getDate() + daysToAdd);
    }
  }
  
  return nextReset.getTime();
};

// 在应用空闲时重置任务
export const resetTasks = async (spaceId: string) => {
  // 如果浏览器支持requestIdleCallback，使用它
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return new Promise((resolve) => {
      // @ts-ignore - TS可能不认识requestIdleCallback
      window.requestIdleCallback(async () => {
        await scheduledReset(spaceId);
        resolve(true);
      }, { timeout: 2000 }); // 2秒超时，确保任务最终会执行
    });
  } else {
    // 回退到普通的setTimeout
    return new Promise((resolve) => {
      setTimeout(async () => {
        await scheduledReset(spaceId);
        resolve(true);
      }, 100);
    });
  }
};

// 实际执行重置操作
const scheduledReset = async (spaceId: string) => {
  try {
    const tasksSnapshot = await getTasksToReset(spaceId);
    
    if (tasksSnapshot.empty) return;
    
    const batch: Promise<void>[] = [];
    
    tasksSnapshot.forEach(docSnapshot => {
      const todoData = docSnapshot.data();
      const today = new Date().toISOString().split('T')[0];
      
      // 记录完成历史
      const completionHistory = todoData.completionHistory || {};
      
      if (todoData.completed) {
        completionHistory[today] = {
          completed: true,
          completedBy: todoData.completedBy || []
        };
      }
      
      // 计算下次重置时间
      const nextReset = calculateNextReset(todoData.recurrence);
      
      // 添加到批量更新
      batch.push(updateDoc(doc(db, 'todos', docSnapshot.id), {
        completed: false,
        completedBy: [],
        'recurrence.lastCompleted': todoData.completed ? Date.now() : todoData.recurrence.lastCompleted,
        'recurrence.nextReset': nextReset,
        completionHistory
      }));
    });
    
    // 执行所有更新
    await Promise.all(batch);
    
  } catch (error) {
    console.error('重置任务出错:', error);
  }
};

// 当创建或更新任务时，计算并设置下次重置时间
export const setInitialResetTime = (recurrence: RecurrenceConfig): RecurrenceConfig => {
  if (recurrence.type === 'once') {
    return recurrence;
  }
  
  const nextReset = calculateNextReset(recurrence);
  return {
    ...recurrence,
    nextReset
  };
}; 