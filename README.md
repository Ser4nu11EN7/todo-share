# 双人共享待办事项应用

一个简单、高效的双人协作待办事项管理工具，基于React、Firebase和TailwindCSS构建。

## 核心特点

- **严格的双人限制**：每个共享列表空间只允许两个用户 - 创建者和通过唯一ID加入的伙伴。
- **唯一ID共享**：创建者获得一个唯一ID，分享给伙伴来加入共享空间。
- **平等权限**：两个用户拥有相同的权限，可以添加、编辑、标记完成和删除任何待办事项。
- **实时更新**：使用Firebase的实时数据库功能，确保两个用户实时看到对方的更改。
- **用户认证**：通过Firebase Authentication进行简单的邮箱/密码登录。

## 技术栈

- [React](https://reactjs.org/) / [Next.js](https://nextjs.org/)
- [Firebase](https://firebase.google.com/)
  - Authentication（用户认证）
  - Firestore（数据存储）
- [TailwindCSS](https://tailwindcss.com/)（UI样式）
- [TypeScript](https://www.typescriptlang.org/)

## 设置步骤

### 1. 克隆项目

```bash
git clone <仓库URL>
cd todo-share
```

### 2. 安装依赖

```bash
npm install
```

### 3. 设置Firebase

1. 在[Firebase控制台](https://console.firebase.google.com/)创建一个新项目
2. 启用Authentication（邮箱/密码认证方式）
3. 创建Firestore数据库
4. 获取Firebase配置

### 4. 配置环境变量

在项目根目录创建`.env.local`文件，添加以下内容：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=你的API密钥
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=你的Auth域名
NEXT_PUBLIC_FIREBASE_PROJECT_ID=你的项目ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=你的存储桶
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=你的消息发送者ID
NEXT_PUBLIC_FIREBASE_APP_ID=你的应用ID
```

### 5. 启动开发服务器

```bash
npm run dev
```

应用将在 [http://localhost:3000](http://localhost:3000) 运行。

## Firestore安全规则

以下是推荐的基本安全规则（需要在Firebase控制台中设置）：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 空间规则
    match /spaces/{spaceId} {
      // 只允许空间成员访问
      allow read, update: if request.auth != null && request.auth.uid in resource.data.members;
      // 允许任何认证用户创建空间
      allow create: if request.auth != null;
      // 只允许空间成员删除
      allow delete: if request.auth != null && request.auth.uid in resource.data.members;
    }
    
    // 待办事项规则
    match /todos/{todoId} {
      // 通过空间ID检查用户权限
      function isSpaceMember(spaceId) {
        let space = get(/databases/$(database)/documents/spaces/$(spaceId));
        return request.auth.uid in space.data.members;
      }
      
      // 只允许相关空间的成员读取、创建、更新和删除
      allow read, write: if request.auth != null && isSpaceMember(resource.data.spaceId);
    }
  }
}
```

## 使用说明

1. 注册账户或登录
2. 创建一个新的共享空间，或使用ID加入现有空间
3. 开始添加和管理待办事项！
