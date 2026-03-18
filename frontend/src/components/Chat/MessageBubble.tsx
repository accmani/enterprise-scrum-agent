import React from 'react';
import clsx from 'clsx';
import { Bot, User } from 'lucide-react';
import type { Message } from '../../types';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  return (
    <div className={clsx('flex gap-3 mb-4', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={clsx(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
        isUser ? 'bg-indigo-600' : 'bg-gray-700'
      )}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>
      <div className={clsx(
        'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
        isUser
          ? 'bg-indigo-600 text-white rounded-tr-sm'
          : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-sm'
      )}>
        {message.content}
      </div>
    </div>
  );
}
